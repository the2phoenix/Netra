"""ADS-B upstream client for live aircraft tracking.

Per trd.md sections 4.3, 5.2, 5.4, FLT-01, FLT-02 and testing.md T-API-05..08.
"""

import asyncio
import logging
from typing import Dict, List, Optional
import httpx
from app.models import AircraftItem, HubItem

logger = logging.getLogger("netra.upstream.adsb")

# Global international hubs spanning Asia, Europe, Americas, Middle East, Africa, and Oceania
HUBS: List[HubItem] = [
    # Asia & India (High priority)
    HubItem(name="Delhi Indira Gandhi", code="DEL", lat=28.56, lon=77.10, radius_nm=250),
    HubItem(name="Mumbai Chhatrapati Shivaji", code="BOM", lat=19.09, lon=72.87, radius_nm=250),
    HubItem(name="Bengaluru Kempegowda", code="BLR", lat=13.20, lon=77.71, radius_nm=250),
    HubItem(name="Tokyo Haneda", code="HND", lat=35.55, lon=139.78, radius_nm=250),
    HubItem(name="Singapore Changi", code="SIN", lat=1.36, lon=103.99, radius_nm=250),
    HubItem(name="Hong Kong / Pearl Delta", code="HKG", lat=22.31, lon=113.91, radius_nm=250),
    HubItem(name="Bangkok Suvarnabhumi", code="BKK", lat=13.69, lon=100.75, radius_nm=250),
    HubItem(name="Dubai / Gulf Corridor", code="DXB", lat=25.25, lon=55.36, radius_nm=250),
    # Europe
    HubItem(name="London Heathrow", code="LHR", lat=51.47, lon=-0.45, radius_nm=250),
    HubItem(name="Frankfurt", code="FRA", lat=50.03, lon=8.57, radius_nm=250),
    HubItem(name="Paris Charles de Gaulle", code="CDG", lat=49.01, lon=2.55, radius_nm=250),
    # Americas
    HubItem(name="New York JFK", code="JFK", lat=40.64, lon=-73.78, radius_nm=250),
    HubItem(name="Chicago O'Hare", code="ORD", lat=41.97, lon=-87.90, radius_nm=250),
    HubItem(name="Los Angeles", code="LAX", lat=33.94, lon=-118.41, radius_nm=250),
    HubItem(name="Sao Paulo Guarulhos", code="GRU", lat=-23.43, lon=-46.47, radius_nm=250),
    # Oceania & Africa
    HubItem(name="Sydney Kingsford Smith", code="SYD", lat=-33.95, lon=151.18, radius_nm=250),
    HubItem(name="Johannesburg OR Tambo", code="JNB", lat=-26.13, lon=28.24, radius_nm=250),
]

ADSB_LOL_BASE = "https://api.adsb.lol/v2"


def normalize_aircraft(raw: dict, is_military: bool = False) -> Optional[AircraftItem]:
    """Normalize readsb JSON object into AircraftItem per T-API-05..07.

    - Drops items without lat and lon (T-API-06).
    - Drops registration ('r') and owner data for ethics/privacy (T-API-07).
    - Converts alt_baro: 'ground' to alt_ft: 0, on_ground: True (T-API-05).
    """
    lat = raw.get("lat")
    lon = raw.get("lon")
    hex_code = raw.get("hex")

    if lat is None or lon is None or not hex_code:
        return None

    try:
        lat = float(lat)
        lon = float(lon)
        if not (-90.0 <= lat <= 90.0) or not (-180.0 <= lon <= 180.0):
            return None
    except (ValueError, TypeError):
        return None

    # Normalise alt_baro
    alt_raw = raw.get("alt_baro")
    on_ground = False
    alt_ft = 0

    if alt_raw == "ground":
        on_ground = True
        alt_ft = 0
    elif alt_raw is not None:
        try:
            alt_ft = int(alt_raw)
            if alt_ft < 0:
                alt_ft = 0
        except (ValueError, TypeError):
            alt_ft = 0

    # Callsign / flight
    callsign = raw.get("flight", "").strip() or None
    ac_type = raw.get("t", "").strip() or None
    squawk = str(raw.get("squawk", "")).strip() or None

    try:
        gs_kt = float(raw.get("gs", 0.0) or 0.0)
    except (ValueError, TypeError):
        gs_kt = 0.0

    try:
        track_deg = float(raw.get("track", 0.0) or 0.0) % 360.0
    except (ValueError, TypeError):
        track_deg = 0.0

    try:
        vs_fpm = int(raw.get("baro_rate", 0) or 0)
    except (ValueError, TypeError):
        vs_fpm = 0

    try:
        seen_s = float(raw.get("seen", 0.0) or 0.0)
    except (ValueError, TypeError):
        seen_s = 0.0

    # Check dbFlags for military tag
    db_flags = raw.get("dbFlags", 0)
    is_mil = is_military or bool(db_flags & 1)

    return AircraftItem(
        hex=hex_code.lower().strip(),
        callsign=callsign,
        type=ac_type,
        lat=lat,
        lon=lon,
        alt_ft=alt_ft,
        gs_kt=gs_kt,
        track_deg=track_deg,
        vs_fpm=vs_fpm,
        squawk=squawk,
        seen_s=seen_s,
        on_ground=on_ground,
        is_military=is_mil,
    )


def merge_hub_results(hub_lists: List[List[AircraftItem]]) -> List[AircraftItem]:
    """Merge aircraft from multiple hubs with deduplication (T-API-08) and equitable round-robin interleaving."""
    best_by_hex: Dict[str, AircraftItem] = {}

    for aircraft_list in hub_lists:
        for ac in aircraft_list:
            existing = best_by_hex.get(ac.hex)
            if existing is None or ac.seen_s < existing.seen_s:
                best_by_hex[ac.hex] = ac

    # Group unique items by their respective hub
    deduped_hub_lists: List[List[AircraftItem]] = []
    for aircraft_list in hub_lists:
        hub_unique = []
        for ac in aircraft_list:
            if best_by_hex.get(ac.hex) is ac:
                hub_unique.append(ac)
        if hub_unique:
            deduped_hub_lists.append(hub_unique)

    # Round-robin interleave across all global hubs so Asia, Americas, Europe, and Africa
    # are equitably represented across the globe without single-region starvation
    interleaved: List[AircraftItem] = []
    max_len = max([len(lst) for lst in deduped_hub_lists], default=0)
    for idx in range(max_len):
        for hub_items in deduped_hub_lists:
            if idx < len(hub_items):
                interleaved.append(hub_items[idx])

    return interleaved


async def fetch_hub_aircraft(
    client: httpx.AsyncClient, hub: HubItem
) -> List[AircraftItem]:
    """Fetch aircraft in radius around a single hub from adsb.lol."""
    url = f"{ADSB_LOL_BASE}/lat/{hub.lat:.4f}/lon/{hub.lon:.4f}/dist/{hub.radius_nm}"
    headers = {"User-Agent": "netra-demo/0.1 (student project; pair-programming build)"}

    try:
        response = await client.get(url, headers=headers, timeout=6.0)
        response.raise_for_status()
        data = response.json()
        raw_ac = data.get("ac", [])
        items = []
        for r in raw_ac:
            ac = normalize_aircraft(r)
            if ac:
                items.append(ac)
        return items
    except Exception as e:
        logger.warning(f"Hub {hub.code} ({hub.name}) fetch failed: {e}")
        return []


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


# Module-level memory cache to avoid burst rate limits and prevent 429
_HUB_CACHE: Dict[str, List[AircraftItem]] = {}
_MIL_CACHE: List[AircraftItem] = []
_MIL_LAST_FETCH = 0.0
_ROTATION_INDEX = 0


async def fetch_military_aircraft(client: httpx.AsyncClient) -> List[AircraftItem]:
    """Fetch live worldwide military flights from adsb.lol /v2/mil."""
    url = f"{ADSB_LOL_BASE}/mil"
    headers = {"User-Agent": "netra-demo/0.1 (student project; tactical view)"}
    try:
        response = await client.get(url, headers=headers, timeout=6.0)
        response.raise_for_status()
        data = response.json()
        raw_ac = data.get("ac", [])
        items = []
        for r in raw_ac:
            ac = normalize_aircraft(r, is_military=True)
            if ac and not ac.on_ground:
                items.append(ac)
        return items
    except Exception as e:
        logger.warning(f"Military flights fetch failed: {e}")
        return []


async def fetch_all_flights(client: httpx.AsyncClient) -> List[AircraftItem]:
    """Fetch flights smoothly across international hubs with rotating rate-limiting."""
    global _ROTATION_INDEX, _MIL_CACHE, _MIL_LAST_FETCH
    import time

    # Periodically fetch live military traffic (every 25 seconds)
    now = time.time()
    if now - _MIL_LAST_FETCH > 25.0:
        mil_items = await fetch_military_aircraft(client)
        if mil_items:
            _MIL_CACHE = mil_items
        _MIL_LAST_FETCH = now

    # Fetch 2 hubs per cycle with polite delay to avoid Envoy/istio 429 burst limiter
    num_hubs = len(HUBS)
    hubs_to_fetch = [HUBS[(_ROTATION_INDEX + i) % num_hubs] for i in range(2)]
    _ROTATION_INDEX = (_ROTATION_INDEX + 2) % num_hubs

    for hub in hubs_to_fetch:
        items = await fetch_hub_aircraft(client, hub)
        if items:
            # Sample to max 45 airborne aircraft per hub to maintain continental balance
            airborne = [a for a in items if not a.on_ground]
            _HUB_CACHE[hub.code] = airborne[:45] if airborne else items[:45]
        await asyncio.sleep(0.3)

    cached_lists = list(_HUB_CACHE.values())
    if _MIL_CACHE:
        cached_lists.append(_MIL_CACHE)

    merged = merge_hub_results(cached_lists) if cached_lists else []

    # Supplement with global flight corridors if live coverage is sparse (< 250 aircraft)
    if len(merged) < 250:
        from app.fixtures import load_aircraft_fixtures
        fixtures = load_aircraft_fixtures()
        existing_hex = {a.hex for a in merged}
        for fix in fixtures:
            if fix.hex not in existing_hex:
                merged.append(fix)

    if not merged:
        raise httpx.RequestError("All ADS-B hub fetches failed or returned empty.")
    return merged

