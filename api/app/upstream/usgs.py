"""USGS upstream client for live earthquake feeds.

Per trd.md sections 4.4, HAZ-01 and testing.md T-INT-05.
"""

import logging
from typing import List, Optional
import httpx
from app.models import QuakeItem

logger = logging.getLogger("netra.upstream.usgs")

USGS_BASE_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary"


def parse_usgs_geojson(data: dict) -> List[QuakeItem]:
    """Parse USGS GeoJSON FeatureCollection into list of QuakeItem."""
    features = data.get("features", [])
    items: List[QuakeItem] = []

    for f in features:
        try:
            quake_id = str(f.get("id", ""))
            props = f.get("properties", {})
            geom = f.get("geometry", {})
            coords = geom.get("coordinates", [])

            if len(coords) < 2 or not quake_id:
                continue

            lon = float(coords[0])
            lat = float(coords[1])
            depth_km = float(coords[2]) if len(coords) >= 3 else 10.0

            mag_raw = props.get("mag")
            if mag_raw is None:
                continue
            mag = round(float(mag_raw), 1)

            place = str(props.get("place") or "Unknown location").strip()
            quake_time = int(props.get("time") or 0)

            items.append(
                QuakeItem(
                    id=quake_id,
                    mag=mag,
                    place=place,
                    time=quake_time,
                    lat=lat,
                    lon=lon,
                    depth_km=round(depth_km, 1),
                )
            )
        except Exception as e:
            logger.debug(f"Skipping malformed quake feature: {e}")
            continue

    return items


async def fetch_quakes_from_usgs(
    client: httpx.AsyncClient, min_mag: float = 2.5, window: str = "day"
) -> List[QuakeItem]:
    """Fetch live earthquakes from USGS summary GeoJSON feed."""
    # Map to USGS standard filenames
    if min_mag >= 4.5:
        feed_name = f"4.5_{window}.geojson"
    elif min_mag >= 2.5:
        feed_name = f"2.5_{window}.geojson"
    elif min_mag >= 1.0:
        feed_name = f"1.0_{window}.geojson"
    else:
        feed_name = f"all_{window}.geojson"

    url = f"{USGS_BASE_URL}/{feed_name}"
    headers = {"User-Agent": "netra-demo/0.1 (student project; pair-programming build)"}

    response = await client.get(url, headers=headers, timeout=8.0)
    response.raise_for_status()

    return parse_usgs_geojson(response.json())
