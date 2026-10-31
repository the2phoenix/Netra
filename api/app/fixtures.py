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

FALLBACK_GPS_TLE = """NAVSTAR 43 (USA 132)
1 24876U 97035A   26304.15000000 -.00000050  00000+0  00000+0 0  9999
2 24876  55.4200  45.1200 0052000 210.1200 149.8800  2.00565000210005
NAVSTAR 47 (USA 154)
1 26605U 00071A   26304.15000000 -.00000050  00000+0  00000+0 0  9999
2 26605  55.1200 105.4200 0061000 190.4500 169.5500  2.00565000190008
NAVSTAR 53 (USA 166)
1 27663U 03005A   26304.15000000 -.00000050  00000+0  00000+0 0  9999
2 27663  54.9800 165.8200 0048000 230.1500 129.8500  2.00565000185002
"""

FALLBACK_WEATHER_TLE = """NOAA 20 (JPSS-1)
1 43013U 17073A   26304.18000000  .00000075  00000+0  34120-4 0  9993
2 43013  98.7200 310.4500 0001450  75.1200 285.0100 14.19560000450001
GOES 16
1 41866U 16071A   26304.18000000  .00000010  00000+0  00000+0 0  9991
2 41866   0.0500 284.8000 0001200  45.0000 315.0000  1.00270000350004
"""


def generate_synthetic_fixtures(group: str, count: int = 100) -> List[SatelliteItem]:
    """Generate realistic deterministic synthetic satellite elements for offline fallback."""
    from app.upstream.celestrak import parse_tle_text

    lines = []
    base_id = 70000
    if group == "starlink":
        base_id = 71000
        inc = 53.0
        mm = 15.05
    elif group == "geo":
        base_id = 72000
        inc = 0.5
        mm = 1.0027
    elif group == "science":
        base_id = 73000
        inc = 65.0
        mm = 14.5
    elif group == "gps-ops":
        base_id = 74000
        inc = 55.0
        mm = 2.0056
    else:
        base_id = 75000
        inc = 45.0
        mm = 15.0

    for i in range(count):
        norad = base_id + i
        raan = (i * (360.0 / count)) % 360.0
        name = f"{group.upper()}-{i+1:04d}"
        lines.append(name)
        lines.append(f"1 {norad:05d}U 24001A   26304.17000000  .00005000  00000+0  10000-3 0  9991")
        lines.append(f"2 {norad:05d}  {inc:07.4f} {raan:08.4f} 0005000  45.0000 315.0000 {mm:11.8f}10001")

    return parse_tle_text("\n".join(lines), group=group, limit=count)


def load_satellite_fixtures(group: str) -> Optional[List[SatelliteItem]]:
    """Load satellite items from disk fixture or fallback."""
    from app.upstream.celestrak import parse_tle_text

    if group == "all":
        items = []
        for g in ["stations", "gps-ops", "weather", "science", "geo", "starlink"]:
            sub = load_satellite_fixtures(g)
            if sub:
                items.extend(sub)
        return items

    fixture_file = settings.fixtures_dir / f"satellites_{group}.json"
    if fixture_file.exists():
        try:
            with open(fixture_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return [SatelliteItem(**item) for item in data.get("items", [])]
        except Exception:
            pass

    # Built-in fallbacks
    if group == "stations":
        return parse_tle_text(FALLBACK_STATIONS_TLE, group="stations")
    elif group == "gps-ops":
        return parse_tle_text(FALLBACK_GPS_TLE, group="gps-ops") + generate_synthetic_fixtures("gps-ops", 28)
    elif group == "weather":
        return parse_tle_text(FALLBACK_WEATHER_TLE, group="weather") + generate_synthetic_fixtures("weather", 30)
    elif group == "geo":
        return generate_synthetic_fixtures("geo", 50)
    elif group == "science":
        return generate_synthetic_fixtures("science", 50)
    elif group == "starlink":
        return generate_synthetic_fixtures("starlink", 200)

    return []
