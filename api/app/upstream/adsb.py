"""ADS-B upstream client for live aircraft tracking.

Per trd.md sections 4.3, 5.2, 5.4, FLT-01, FLT-02 and testing.md T-API-05..08.
"""

import asyncio
import logging
from typing import Dict, List, Optional
import httpx
from app.models import AircraftItem, HubItem

logger = logging.getLogger("netra.upstream.adsb")

# 12 major international hubs per trd.md 5.2
HUBS: List[HubItem] = [
    HubItem(name="London Heathrow", code="LHR", lat=51.47, lon=-0.45, radius_nm=250),
    HubItem(name="Frankfurt", code="FRA", lat=50.03, lon=8.57, radius_nm=250),
    HubItem(name="New York JFK", code="JFK", lat=40.64, lon=-73.78, radius_nm=250),
    HubItem(name="Chicago O'Hare", code="ORD", lat=41.97, lon=-87.90, radius_nm=250),
    HubItem(name="Los Angeles", code="LAX", lat=33.94, lon=-118.41, radius_nm=250),
    HubItem(name="Dubai", code="DXB", lat=25.25, lon=55.36, radius_nm=250),
    HubItem(name="Delhi Indira Gandhi", code="DEL", lat=28.56, lon=77.10, radius_nm=250),
    HubItem(name="Singapore Changi", code="SIN", lat=1.36, lon=103.99, radius_nm=250),
    HubItem(name="Tokyo Haneda", code="HND", lat=35.55, lon=139.78, radius_nm=250),
    HubItem(name="Sydney Kingsford Smith", code="SYD", lat=-33.95, lon=151.18, radius_nm=250),
    HubItem(name="Sao Paulo Guarulhos", code="GRU", lat=-23.43, lon=-46.47, radius_nm=250),
    HubItem(name="Johannesburg OR Tambo", code="JNB", lat=-26.13, lon=28.24, radius_nm=250),
]

ADSB_LOL_BASE = "https://api.adsb.lol/v2"


def normalize_aircraft(raw: dict) -> Optional[AircraftItem]:
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
    )


def merge_hub_results(hub_lists: List[List[AircraftItem]]) -> List[AircraftItem]:
    """Merge aircraft from multiple hubs, keeping the one with smallest seen_s for duplicates (T-API-08)."""
    best_by_hex: Dict[str, AircraftItem] = {}

    for aircraft_list in hub_lists:
        for ac in aircraft_list:
            existing = best_by_hex.get(ac.hex)
            if existing is None or ac.seen_s < existing.seen_s:
                best_by_hex[ac.hex] = ac

    return list(best_by_hex.values())


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


async def fetch_all_flights(client: httpx.AsyncClient) -> List[AircraftItem]:
    """Fetch and merge flights from all 12 hubs concurrently."""
    tasks = [fetch_hub_aircraft(client, hub) for hub in HUBS]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    valid_lists = []
    for r in results:
        if isinstance(r, list):
            valid_lists.append(r)

    merged = merge_hub_results(valid_lists)
    if not merged:
        raise httpx.RequestError("All ADS-B hub fetches failed or returned empty.")
    return merged

