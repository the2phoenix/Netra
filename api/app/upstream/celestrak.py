"""CelesTrak upstream client for orbital elements.

Per trd.md section 4.2, 5.4 and testing.md T-API-09.
"""

import logging
from typing import List
import httpx
from app.models import SatelliteItem

logger = logging.getLogger("netra.upstream.celestrak")

ALLOWED_GROUPS = {
    "stations",
    "gps-ops",
    "weather",
    "noaa",
    "science",
    "geo",
    "starlink",
    "active",
}

CELESTRAK_BASE_URL = "https://celestrak.org/NORAD/elements/gp.php"


def parse_tle_text(text: str, limit: int = 1500) -> List[SatelliteItem]:
    """Parse 3-line or 2-line TLE blocks into SatelliteItem list with stride sampling."""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    items: List[SatelliteItem] = []

    i = 0
    while i < len(lines):
        # 3-line format: Name, Line 1, Line 2
        if lines[i].startswith("1 ") and i + 1 < len(lines) and lines[i + 1].startswith("2 "):
            name = f"SAT-{lines[i][2:7].strip()}"
            line1 = lines[i]
            line2 = lines[i + 1]
            i += 2
        elif (
            i + 2 < len(lines)
            and lines[i + 1].startswith("1 ")
            and lines[i + 2].startswith("2 ")
        ):
            name = lines[i]
            line1 = lines[i + 1]
            line2 = lines[i + 2]
            i += 3
        else:
            i += 1
            continue

        try:
            norad_id = int(line1[2:7].strip())
            # Parse inclination (deg), eccentricity (decimal point assumed), mean motion (revs/day)
            inclination = float(line2[8:16].strip())
            ecc_raw = line2[26:33].strip()
            eccentricity = float(f"0.{ecc_raw}")
            mean_motion = float(line2[52:63].strip())
            period_min = round(1440.0 / mean_motion, 2) if mean_motion > 0 else None

            items.append(
                SatelliteItem(
                    name=name,
                    norad_cat_id=norad_id,
                    line1=line1,
                    line2=line2,
                    epoch=line1[18:32].strip(),
                    inclination=inclination,
                    mean_motion=mean_motion,
                    eccentricity=eccentricity,
                    period_min=period_min,
                )
            )
        except Exception as e:
            logger.debug(f"Skipping malformed TLE block for {name}: {e}")
            continue

    # Stride sampling if exceeds limit (e.g. Starlink, testing.md T-API-09)
    if len(items) > limit:
        stride = len(items) / limit
        sampled = [items[int(k * stride)] for k in range(limit)]
        return sampled

    return items


async def fetch_satellites_from_celestrak(
    client: httpx.AsyncClient, group: str, limit: int = 1500
) -> List[SatelliteItem]:
    """Fetch orbital elements for a group from CelesTrak with polite User-Agent."""
    if group not in ALLOWED_GROUPS:
        raise ValueError(f"group must be one of: {', '.join(sorted(ALLOWED_GROUPS))}")

    params = {"GROUP": group, "FORMAT": "tle"}
    headers = {"User-Agent": "netra-demo/0.1 (student project; pair-programming build)"}

    response = await client.get(
        CELESTRAK_BASE_URL,
        params=params,
        headers=headers,
        timeout=8.0,
    )
    response.raise_for_status()

    return parse_tle_text(response.text, limit=limit)
