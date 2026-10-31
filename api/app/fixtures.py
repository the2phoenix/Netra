"""Offline fixtures loader for NETRA.

Per trd.md section 5.3, BAK-02 and testing.md T-INT-07.
"""

import json
from pathlib import Path
from typing import List, Optional
from app.config import settings
from app.models import SatelliteItem


# Minimal offline fixture for ISS if no recorded fixture exists
FALLBACK_STATIONS_TLE = """ISS (ZARYA)
1 25544U 98067A   26304.17644455  .00006183  00000+0  11976-3 0  9995
2 25544  51.6332 347.1486 0007016 330.4977  29.5614 15.49124187592838
TIANGONG
1 48274U 21035A   26304.18244792  .00012437  00000+0  14216-3 0  9992
2 48274  41.4728 290.7241 0005721  58.2036 301.9366 15.59765241198547
"""


def load_satellite_fixtures(group: str) -> Optional[List[SatelliteItem]]:
    """Load satellite items from disk fixture or fallback."""
    from app.upstream.celestrak import parse_tle_text

    fixture_file = settings.fixtures_dir / f"satellites_{group}.json"
    if fixture_file.exists():
        try:
            with open(fixture_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return [SatelliteItem(**item) for item in data.get("items", [])]
        except Exception:
            pass

    # Fallback for stations
    if group == "stations":
        return parse_tle_text(FALLBACK_STATIONS_TLE)

    return []
