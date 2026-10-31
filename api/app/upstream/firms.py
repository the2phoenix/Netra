"""NASA FIRMS upstream client for active fire hotspots.

Per trd.md sections 4.5, HAZ-02 and testing.md T-INT-06.
"""

import csv
import io
import logging
from typing import List, Optional
import httpx
from app.models import FireItem

logger = logging.getLogger("netra.upstream.firms")


class NoFirmsKeyError(Exception):
    """Raised when FIRMS API key is not configured."""
    pass


def parse_firms_csv(csv_text: str, limit: int = 20000) -> List[FireItem]:
    """Parse FIRMS CSV into list of FireItem, sorted by highest FRP first."""
    items: List[FireItem] = []
    reader = csv.DictReader(io.StringIO(csv_text.strip()))

    for row in reader:
        try:
            lat = float(row.get("latitude", 0))
            lon = float(row.get("longitude", 0))
            frp = float(row.get("frp", 0.0) or 0.0)
            confidence = row.get("confidence", "nominal")
            acq_time = f"{row.get('acq_date', '')} {row.get('acq_time', '')}".strip()
            satellite = row.get("satellite", "VIIRS")

            items.append(
                FireItem(
                    lat=lat,
                    lon=lon,
                    frp=frp,
                    confidence=confidence,
                    acq_time=acq_time,
                    satellite=satellite,
                )
            )
        except Exception:
            continue

    # Sort highest FRP (Fire Radiative Power) first per TRD 4.5
    items.sort(key=lambda x: x.frp, reverse=True)
    return items[:limit]


async def fetch_fires_from_firms(
    client: httpx.AsyncClient, map_key: str, day_range: int = 1, limit: int = 20000
) -> List[FireItem]:
    """Fetch active fire hotspots from NASA FIRMS API."""
    if not map_key:
        raise NoFirmsKeyError("FIRMS_MAP_KEY is not configured.")

    # Query global VIIRS NRT
    url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{map_key}/VIIRS_SNPP_NRT/world/{day_range}"
    headers = {"User-Agent": "netra-demo/0.1 (student project; pair-programming build)"}

    response = await client.get(url, headers=headers, timeout=12.0)
    response.raise_for_status()

    return parse_firms_csv(response.text, limit=limit)
