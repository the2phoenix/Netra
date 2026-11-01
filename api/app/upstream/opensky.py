"""OpenSky Network OAuth2 upstream client for live global aircraft tracking."""

import logging
import time
from typing import List, Optional
import httpx
from app.config import settings
from app.models import AircraftItem

logger = logging.getLogger("netra.upstream.opensky")

OPENSKY_TOKEN_URL = (
    "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token"
)
OPENSKY_STATES_URL = "https://opensky-network.org/api/states/all"

_TOKEN: Optional[str] = None
_TOKEN_EXPIRES_AT: float = 0.0

_STATES_CACHE: List[AircraftItem] = []
_LAST_STATES_FETCH: float = 0.0


def normalize_opensky_state(state: list) -> Optional[AircraftItem]:
    """Parse OpenSky state vector into AircraftItem (drops owner and private data per T-API-07)."""
    if not isinstance(state, (list, tuple)) or len(state) < 11:
        return None

    hex_code = state[0]
    callsign = state[1].strip() if state[1] else None
    lon = state[5]
    lat = state[6]
    baro_alt = state[7]
    on_ground = bool(state[8])
    velocity = state[9]
    true_track = state[10]
    vertical_rate = state[11] if len(state) > 11 else None
    squawk = str(state[14]).strip() if len(state) > 14 and state[14] else None

    if not hex_code or lat is None or lon is None:
        return None

    try:
        lat = float(lat)
        lon = float(lon)
        if not (-90.0 <= lat <= 90.0) or not (-180.0 <= lon <= 180.0):
            return None
    except (ValueError, TypeError):
        return None

    alt_ft = int(baro_alt * 3.28084) if baro_alt is not None else 0
    if alt_ft < 0:
        alt_ft = 0
    gs_kt = float(velocity * 1.94384) if velocity is not None else 0.0
    track_deg = float(true_track) % 360.0 if true_track is not None else 0.0
    vs_fpm = int(vertical_rate * 196.85) if vertical_rate is not None else 0

    return AircraftItem(
        hex=str(hex_code).lower().strip(),
        callsign=callsign,
        type=None,
        lat=lat,
        lon=lon,
        alt_ft=alt_ft,
        gs_kt=gs_kt,
        track_deg=track_deg,
        vs_fpm=vs_fpm,
        squawk=squawk,
        seen_s=0.0,
        on_ground=on_ground,
    )


def sample_global_flights(items: List[AircraftItem], limit: int = 3000) -> List[AircraftItem]:
    """Equitably sample global flights across 12 longitude bands so all continents have balanced representation."""
    airborne = [ac for ac in items if not ac.on_ground]
    if not airborne:
        return items[:limit]

    bands: List[List[AircraftItem]] = [[] for _ in range(12)]
    for ac in airborne:
        band_idx = int((ac.lon + 180.0) / 30.0) % 12
        bands[band_idx].append(ac)

    sampled: List[AircraftItem] = []
    max_len = max([len(b) for b in bands], default=0)
    for idx in range(max_len):
        for b in bands:
            if idx < len(b):
                sampled.append(b[idx])
                if len(sampled) >= limit:
                    return sampled

    return sampled


async def get_opensky_token(client: httpx.AsyncClient) -> Optional[str]:
    """Obtain or return cached OAuth2 Bearer token using client_credentials grant."""
    global _TOKEN, _TOKEN_EXPIRES_AT

    now = time.time()
    if _TOKEN and now < (_TOKEN_EXPIRES_AT - 60.0):
        return _TOKEN

    client_id = settings.opensky_client_id
    client_secret = settings.opensky_client_secret
    if not client_id or not client_secret:
        return None

    try:
        data = {
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
        }
        resp = await client.post(OPENSKY_TOKEN_URL, data=data, timeout=8.0)
        resp.raise_for_status()
        token_data = resp.json()
        token = token_data.get("access_token")
        expires_in = token_data.get("expires_in", 1800)
        if token:
            _TOKEN = token
            _TOKEN_EXPIRES_AT = now + float(expires_in)
            logger.info("Successfully refreshed OpenSky OAuth2 token (expires in %ds)", int(expires_in))
            return _TOKEN
    except Exception as e:
        logger.warning(f"Failed to obtain OpenSky OAuth2 token: {e}")
        return None

    return None


async def fetch_opensky_aircraft(client: httpx.AsyncClient, limit: int = 2500) -> List[AircraftItem]:
    """Fetch live aircraft from OpenSky Network, cache for 15s, and sample equitably across globe."""
    global _STATES_CACHE, _LAST_STATES_FETCH

    now = time.time()
    # Cache OpenSky responses for 15 seconds to respect rate limits
    if _STATES_CACHE and (now - _LAST_STATES_FETCH < 15.0):
        return _STATES_CACHE

    token = await get_opensky_token(client)
    headers = {"User-Agent": "netra-surveillance/1.0"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        resp = await client.get(OPENSKY_STATES_URL, headers=headers, timeout=12.0)
        resp.raise_for_status()
        data = resp.json()
        raw_states = data.get("states", []) or []
        items: List[AircraftItem] = []
        for state in raw_states:
            ac = normalize_opensky_state(state)
            if ac:
                items.append(ac)

        if items:
            sampled = sample_global_flights(items, limit=limit)
            _STATES_CACHE = sampled
            _LAST_STATES_FETCH = now
            logger.info("OpenSky retrieved %d flights; sampled %d global tracks.", len(items), len(sampled))
            return _STATES_CACHE
    except Exception as e:
        logger.warning(f"OpenSky states fetch failed: {e}")

    return _STATES_CACHE

