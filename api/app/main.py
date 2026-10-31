"""FastAPI application for NETRA.

Per trd.md sections 4.1, 4.2, 5.1 and 5.4.
"""

import datetime
import logging
import time
from contextlib import asynccontextmanager
from typing import Dict, Optional
import httpx
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.cache import TTLCache, UpstreamUnavailable
from app.config import settings
from app.fixtures import (
    load_aircraft_fixtures,
    load_fire_fixtures,
    load_quake_fixtures,
    load_satellite_fixtures,
)
from app.models import (
    AircraftItem,
    ErrorResponse,
    FeedHealth,
    FireItem,
    FiresResponse,
    FlightsResponse,
    HealthResponse,
    HubsResponse,
    QuakeItem,
    QuakesResponse,
    SatelliteItem,
    SatellitesResponse,
)
from app.upstream.adsb import HUBS, fetch_all_flights
from app.upstream.celestrak import ALLOWED_GROUPS, fetch_satellites_from_celestrak
from app.upstream.firms import NoFirmsKeyError, fetch_fires_from_firms
from app.upstream.usgs import fetch_quakes_from_usgs

logging.basicConfig(level=settings.log_level.upper())
logger = logging.getLogger("netra.api")

# State holders
start_time = time.time()
client: Optional[httpx.AsyncClient] = None
cache: Optional[TTLCache] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global client, cache, start_time
    start_time = time.time()
    client = httpx.AsyncClient(timeout=8.0)
    cache = TTLCache(disk_dir=settings.cache_dir)
    logger.info("NETRA API backend initialized.")
    yield
    await client.aclose()
    logger.info("NETRA API backend shutdown.")


app = FastAPI(
    title="NETRA API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS for local web dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": "http_error", "message": detail},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "internal_error", "message": "An unexpected error occurred."},
    )


@app.get("/api/health", response_model=HealthResponse)
async def get_health() -> HealthResponse:
    now = time.time()
    uptime = int(now - start_time)

    # Check celestrak feed health
    celestrak_state = "live"
    last_ok = None
    age_s = None

    if cache:
        existing = cache.get_existing("satellites:stations")
        if existing:
            _, is_stale, age = existing
            age_s = int(age)
            celestrak_state = "stale" if is_stale else "live"
            last_ok = datetime.datetime.fromtimestamp(
                now - age, datetime.timezone.utc
            ).isoformat()

    # Check ADS-B feed health
    adsb_state = "off"
    adsb_last_ok = None
    adsb_age_s = None

    if settings.offline_mode:
        adsb_state = "live"
        adsb_age_s = 0
    elif cache:
        existing_adsb = cache.get_existing("flights:merged")
        if existing_adsb:
            _, is_stale, age = existing_adsb
            adsb_age_s = int(age)
            adsb_state = "stale" if (is_stale or age > 60) else "live"
            adsb_last_ok = datetime.datetime.fromtimestamp(
                now - age, datetime.timezone.utc
            ).isoformat()

    # Check USGS quakes feed health
    usgs_state = "off"
    usgs_last_ok = None
    usgs_age_s = None

    if settings.offline_mode:
        usgs_state = "live"
        usgs_age_s = 0
    elif cache:
        existing_usgs = cache.get_existing("quakes:day:2.5")
        if existing_usgs:
            _, is_stale, age = existing_usgs
            usgs_age_s = int(age)
            usgs_state = "stale" if (is_stale or age > 120) else "live"
            usgs_last_ok = datetime.datetime.fromtimestamp(
                now - age, datetime.timezone.utc
            ).isoformat()

    # Check FIRMS fire hotspots feed health
    firms_state = "off"
    firms_last_ok = None
    firms_age_s = None
    firms_reason = "no_key" if not settings.firms_map_key else None

    if settings.offline_mode:
        firms_state = "live"
        firms_age_s = 0
        firms_reason = None
    elif settings.firms_map_key and cache:
        existing_firms = cache.get_existing("fires:world:1")
        if existing_firms:
            _, is_stale, age = existing_firms
            firms_age_s = int(age)
            firms_state = "stale" if (is_stale or age > 900) else "live"
            firms_last_ok = datetime.datetime.fromtimestamp(
                now - age, datetime.timezone.utc
            ).isoformat()
            firms_reason = None

    feeds: Dict[str, FeedHealth] = {
        "celestrak": FeedHealth(
            state=celestrak_state,
            last_ok=last_ok,
            age_s=age_s,
        ),
        "adsb": FeedHealth(
            state=adsb_state,
            last_ok=adsb_last_ok,
            age_s=adsb_age_s,
        ),
        "usgs": FeedHealth(
            state=usgs_state,
            last_ok=usgs_last_ok,
            age_s=usgs_age_s,
        ),
        "firms": FeedHealth(
            state=firms_state,
            last_ok=firms_last_ok,
            age_s=firms_age_s,
            reason=firms_reason,
        ),
    }

    return HealthResponse(
        status="ok",
        offline=settings.offline_mode,
        uptime_s=uptime,
        feeds=feeds,
    )


@app.get(
    "/api/satellites",
    response_model=SatellitesResponse,
    responses={
        400: {"model": ErrorResponse},
        502: {"model": ErrorResponse},
    },
)
async def get_satellites(
    group: str = Query(default="all", description="Satellite constellation/group (stations, gps-ops, weather, science, geo, starlink, all)"),
    limit: int = Query(default=3000, ge=1, le=10000, description="Max satellites returned"),
):
    if group not in ALLOWED_GROUPS:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error": "invalid_group",
                "message": f"group must be one of: {', '.join(sorted(ALLOWED_GROUPS))}",
            },
        )

    # Offline mode fixture playback
    if settings.offline_mode:
        fixtures = load_satellite_fixtures(group)
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        return SatellitesResponse(
            fetched_at=now_iso,
            source="fixtures",
            stale=False,
            age_s=0,
            replay=True,
            group=group,
            count=len(fixtures),
            items=fixtures[:limit],
        )

    cache_key = f"satellites:{group}"

    async def fetch():
        assert client is not None
        return await fetch_satellites_from_celestrak(client, group=group, limit=limit)

    try:
        assert cache is not None
        items, is_stale, age_s = await cache.get(
            key=cache_key,
            ttl_s=settings.sat_min_refresh_s,
            fetch=fetch,
        )
    except UpstreamUnavailable as e:
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content={
                "error": "upstream_unavailable",
                "message": f"CelesTrak unavailable and no cached elements: {e}",
            },
        )

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    return SatellitesResponse(
        fetched_at=now_iso,
        source="celestrak",
        stale=is_stale,
        age_s=int(age_s),
        replay=False,
        group=group,
        count=len(items),
        items=items,
    )


@app.get(
    "/api/flights",
    response_model=FlightsResponse,
    responses={
        502: {"model": ErrorResponse},
    },
)
async def get_flights(
    limit: int = Query(default=3000, ge=1, le=10000, description="Max aircraft returned"),
):
    """Fetch live aircraft positions merged across 12 international hubs."""
    if settings.offline_mode:
        fixtures = load_aircraft_fixtures()
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        return FlightsResponse(
            fetched_at=now_iso,
            source="fixtures",
            stale=False,
            age_s=0,
            replay=True,
            sampled=True,
            hubs=len(HUBS),
            count=len(fixtures),
            items=fixtures[:limit],
        )

    cache_key = "flights:merged"

    async def fetch():
        assert client is not None
        return await fetch_all_flights(client)

    try:
        assert cache is not None
        # Cache flights for 5 seconds to reduce upstream load while keeping movements fresh
        items, is_stale, age_s = await cache.get(
            key=cache_key,
            ttl_s=5.0,
            fetch=fetch,
        )
    except UpstreamUnavailable as e:
        # Fallback to fixtures if upstream is completely unavailable
        logger.warning(f"ADS-B upstream unreachable ({e}), falling back to offline fixtures.")
        fixtures = load_aircraft_fixtures()
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        return FlightsResponse(
            fetched_at=now_iso,
            source="fixtures",
            stale=True,
            age_s=int(time.time() - start_time),
            replay=True,
            sampled=True,
            hubs=len(HUBS),
            count=len(fixtures),
            items=fixtures[:limit],
        )

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    return FlightsResponse(
        fetched_at=now_iso,
        source="adsb.lol",
        stale=is_stale,
        age_s=int(age_s),
        replay=False,
        sampled=True,
        hubs=len(HUBS),
        count=len(items),
        items=items[:limit],
    )


@app.get("/api/meta/hubs", response_model=HubsResponse)
async def get_hubs():
    """Returns the list of 12 sampled flight hubs."""
    return HubsResponse(hubs=HUBS)


@app.get(
    "/api/quakes",
    response_model=QuakesResponse,
    responses={
        502: {"model": ErrorResponse},
    },
)
async def get_quakes(
    min_mag: float = Query(default=2.5, ge=0.0, le=10.0, description="Minimum earthquake magnitude"),
    window: str = Query(default="day", pattern="^(hour|day|week)$", description="Time window (hour, day, week)"),
    limit: int = Query(default=500, ge=1, le=5000),
):
    """Fetch live earthquakes from USGS summary feed."""
    if settings.offline_mode:
        fixtures = load_quake_fixtures()
        filtered = [q for q in fixtures if q.mag >= min_mag]
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        return QuakesResponse(
            fetched_at=now_iso,
            source="fixtures",
            stale=False,
            age_s=0,
            replay=True,
            count=len(filtered),
            items=filtered[:limit],
        )

    cache_key = f"quakes:{window}:{min_mag}"

    async def fetch():
        assert client is not None
        return await fetch_quakes_from_usgs(client, min_mag=min_mag, window=window)

    try:
        assert cache is not None
        items, is_stale, age_s = await cache.get(
            key=cache_key,
            ttl_s=settings.quake_cache_ttl_s,
            fetch=fetch,
        )
    except UpstreamUnavailable as e:
        logger.warning(f"USGS unreachable ({e}), falling back to offline fixtures.")
        fixtures = load_quake_fixtures()
        filtered = [q for q in fixtures if q.mag >= min_mag]
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        return QuakesResponse(
            fetched_at=now_iso,
            source="fixtures",
            stale=True,
            age_s=int(time.time() - start_time),
            replay=True,
            count=len(filtered),
            items=filtered[:limit],
        )

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    return QuakesResponse(
        fetched_at=now_iso,
        source="usgs",
        stale=is_stale,
        age_s=int(age_s),
        replay=False,
        count=len(items),
        items=items[:limit],
    )


@app.get(
    "/api/fires",
    response_model=FiresResponse,
    responses={
        503: {"model": ErrorResponse},
        502: {"model": ErrorResponse},
    },
)
async def get_fires(
    day_range: int = Query(default=1, ge=1, le=7, description="Number of past days (1-7)"),
    limit: int = Query(default=20000, ge=1, le=20000, description="Max fire hotspots"),
):
    """Fetch active fire hotspots from NASA FIRMS. Requires FIRMS_MAP_KEY."""
    if not settings.firms_map_key and not settings.offline_mode:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "error": "fires_disabled",
                "reason": "no_key",
                "message": "FIRMS active fire hotspot tracking is disabled because FIRMS_MAP_KEY is not configured.",
            },
        )

    if settings.offline_mode:
        fixtures = load_fire_fixtures()
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        return FiresResponse(
            fetched_at=now_iso,
            source="fixtures",
            stale=False,
            age_s=0,
            replay=True,
            count=len(fixtures),
            items=fixtures[:limit],
        )

    cache_key = f"fires:world:{day_range}"

    async def fetch():
        assert client is not None
        return await fetch_fires_from_firms(
            client, map_key=settings.firms_map_key, day_range=day_range, limit=limit
        )

    try:
        assert cache is not None
        items, is_stale, age_s = await cache.get(
            key=cache_key,
            ttl_s=settings.fire_cache_ttl_s,
            fetch=fetch,
        )
    except UpstreamUnavailable as e:
        logger.warning(f"FIRMS unreachable ({e}), falling back to offline fixtures.")
        fixtures = load_fire_fixtures()
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        return FiresResponse(
            fetched_at=now_iso,
            source="fixtures",
            stale=True,
            age_s=int(time.time() - start_time),
            replay=True,
            count=len(fixtures),
            items=fixtures[:limit],
        )

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    return FiresResponse(
        fetched_at=now_iso,
        source="firms",
        stale=is_stale,
        age_s=int(age_s),
        replay=False,
        count=len(items),
        items=items[:limit],
    )
