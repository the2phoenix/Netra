"""Integration tests for NETRA FastAPI routes per testing.md."""

import pytest
import respx
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.config import settings
from app.upstream.celestrak import CELESTRAK_BASE_URL, parse_tle_text

SAMPLE_TLE = """ISS (ZARYA)
1 25544U 98067A   26304.17644455  .00006183  00000+0  11976-3 0  9995
2 25544  51.6332 347.1486 0007016 330.4977  29.5614 15.49124187592838
TIANGONG
1 48274U 21035A   26304.18244792  .00012437  00000+0  14216-3 0  9992
2 48274  41.4728 290.7241 0005721  58.2036 301.9366 15.59765241198547
"""


@pytest.mark.asyncio
async def test_health_endpoint():
    """T-INT-01 check /api/health structure."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert "feeds" in data
        assert "celestrak" in data["feeds"]


@pytest.mark.asyncio
@respx.mock
async def test_satellites_endpoint_mocked():
    """T-INT-08 check /api/satellites returns compliant response model."""
    respx.get(CELESTRAK_BASE_URL).respond(status_code=200, text=SAMPLE_TLE)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Note: lifespan setup
        from app import main
        main.cache = main.TTLCache()
        main.client = AsyncClient(timeout=8.0)

        res = await client.get("/api/satellites?group=stations")
        assert res.status_code == 200
        data = res.json()
        assert data["group"] == "stations"
        assert data["count"] == 2
        assert len(data["items"]) == 2
        assert data["items"][0]["name"] == "ISS (ZARYA)"
        assert data["items"][0]["norad_cat_id"] == 25544
        assert data["items"][0]["inclination"] == 51.6332


@pytest.mark.asyncio
async def test_satellites_invalid_group():
    """T-API-10 Unknown group returns 400."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/satellites?group=invalid_group_xyz")
        assert res.status_code == 400
        data = res.json()
        assert data["error"] == "invalid_group"


def test_t_api_09_starlink_stride_sampling():
    """T-API-09 Starlink stride sampling returns at most limit and spans the full list."""
    # Generate 3000 mock satellites
    lines = []
    for i in range(1, 3001):
        lines.append(f"SAT-{i:05d}")
        lines.append(f"1 {i:05d}U 20001A   26304.17644455  .00006183  00000+0  11976-3 0  9995")
        lines.append(f"2 {i:05d}  53.0000 {i%360:08.4f} 0001000  30.0000  30.0000 15.0000000010000")

    tle_text = "\n".join(lines)
    sampled = parse_tle_text(tle_text, limit=1500)

    assert len(sampled) == 1500
    # First sat should be sat 1
    assert sampled[0].norad_cat_id == 1
    # Last sat should be near sat 3000
    assert sampled[-1].norad_cat_id > 2900


@pytest.mark.asyncio
async def test_offline_mode_playback():
    """T-INT-07 OFFLINE_MODE=true serves fixtures with replay=True."""
    settings.offline_mode = True
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get("/api/satellites?group=stations")
            assert res.status_code == 200
            data = res.json()
            assert data["replay"] is True
            assert data["source"] == "fixtures"
            assert data["count"] >= 1

            # Test offline mode for group=all returns multi-constellation
            res_all = await client.get("/api/satellites?group=all")
            assert res_all.status_code == 200
            data_all = res_all.json()
            assert data_all["replay"] is True
            assert data_all["count"] > 100

            # Test offline mode for flights
            res_flt = await client.get("/api/flights")
            assert res_flt.status_code == 200
            data_flt = res_flt.json()
            assert data_flt["replay"] is True
            assert data_flt["source"] == "fixtures"
            assert data_flt["count"] > 500
    finally:
        settings.offline_mode = False


def test_t_api_05_07_flight_normalizer():
    """T-API-05, T-API-06, T-API-07 aircraft normalizer tests."""
    from app.upstream.adsb import normalize_aircraft

    # T-API-05: alt_baro "ground" -> alt_ft 0, on_ground True
    ground_raw = {"hex": "abc123", "flight": "BAW1", "lat": 51.47, "lon": -0.45, "alt_baro": "ground"}
    ac_ground = normalize_aircraft(ground_raw)
    assert ac_ground is not None
    assert ac_ground.alt_ft == 0
    assert ac_ground.on_ground is True

    # T-API-06: drops items without lat or lon
    no_lat = {"hex": "abc124", "lon": -0.45, "alt_baro": 10000}
    assert normalize_aircraft(no_lat) is None

    no_lon = {"hex": "abc125", "lat": 51.47, "alt_baro": 10000}
    assert normalize_aircraft(no_lon) is None

    # T-API-07: drops registration and owner
    with_reg = {
        "hex": "abc126",
        "flight": "AIC101",
        "lat": 28.56,
        "lon": 77.10,
        "alt_baro": 37000,
        "r": "VT-EXA",
        "owner": "Private Corp",
    }
    ac_reg = normalize_aircraft(with_reg)
    assert ac_reg is not None
    assert not hasattr(ac_reg, "r")
    assert not hasattr(ac_reg, "owner")
    assert "r" not in ac_reg.model_dump()
    assert "owner" not in ac_reg.model_dump()


def test_t_api_08_hub_merge_deduplication():
    """T-API-08 Hub merge keeps the item with smallest seen_s for a duplicate hex."""
    from app.models import AircraftItem
    from app.upstream.adsb import merge_hub_results

    ac_older = AircraftItem(
        hex="abc123",
        callsign="TEST1",
        lat=51.0,
        lon=0.0,
        alt_ft=30000,
        gs_kt=450,
        track_deg=90,
        seen_s=15.0,
    )
    ac_newer = AircraftItem(
        hex="abc123",
        callsign="TEST1",
        lat=51.1,
        lon=0.1,
        alt_ft=30000,
        gs_kt=450,
        track_deg=90,
        seen_s=1.5,
    )

    merged = merge_hub_results([[ac_older], [ac_newer]])
    assert len(merged) == 1
    assert merged[0].seen_s == 1.5
    assert merged[0].lat == 51.1


@pytest.mark.asyncio
async def test_get_hubs_endpoint():
    """Check /api/meta/hubs returns 12 hubs."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/meta/hubs")
        assert res.status_code == 200
        data = res.json()
        assert len(data["hubs"]) == 12


@pytest.mark.asyncio
async def test_t_int_06_fires_disabled_without_key():
    """T-INT-06 No FIRMS key returns 503 fires_disabled."""
    saved_key = settings.firms_map_key
    settings.firms_map_key = ""
    settings.offline_mode = False
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get("/api/fires")
            assert res.status_code == 503
            data = res.json()
            assert data["error"] == "fires_disabled"
            assert data["reason"] == "no_key"

            # Check health shows off
            res_health = await client.get("/api/health")
            data_health = res_health.json()
            assert data_health["feeds"]["firms"]["state"] == "off"
            assert data_health["feeds"]["firms"]["reason"] == "no_key"
    finally:
        settings.firms_map_key = saved_key


def test_usgs_geojson_parsing():
    """Check USGS parser correctly extracts id, mag, place, time, lat, lon, depth."""
    from app.upstream.usgs import parse_usgs_geojson

    mock_geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "id": "us7000test1",
                "properties": {
                    "mag": 5.4,
                    "place": "10 km SSW of Eureka, CA",
                    "time": 1730452000000,
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [-124.2, 40.7, 18.5],
                },
            }
        ],
    }

    items = parse_usgs_geojson(mock_geojson)
    assert len(items) == 1
    assert items[0].id == "us7000test1"
    assert items[0].mag == 5.4
    assert items[0].place == "10 km SSW of Eureka, CA"
    assert items[0].lat == 40.7
    assert items[0].lon == -124.2
    assert items[0].depth_km == 18.5


def test_firms_csv_parsing():
    """Check FIRMS CSV parser sorts by highest FRP first."""
    from app.upstream.firms import parse_firms_csv

    mock_csv = """latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,daynight
-3.45,-62.20,340.5,0.4,0.4,2026-11-01,1730,N,nominal,2.0NRT,295.1,45.2,D
-3.50,-62.25,365.2,0.4,0.4,2026-11-01,1730,N,high,2.0NRT,310.2,185.7,D
"""
    items = parse_firms_csv(mock_csv)
    assert len(items) == 2
    # Highest FRP first
    assert items[0].frp == 185.7
    assert items[0].confidence == "high"
    assert items[1].frp == 45.2


@pytest.mark.asyncio
async def test_offline_mode_quakes_and_fires():
    """Check offline mode returns fixtures for quakes and fires."""
    settings.offline_mode = True
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res_q = await client.get("/api/quakes?min_mag=2.5")
            assert res_q.status_code == 200
            data_q = res_q.json()
            assert data_q["count"] >= 10
            assert data_q["source"] == "fixtures"

            res_f = await client.get("/api/fires")
            assert res_f.status_code == 200
            data_f = res_f.json()
            assert data_f["count"] >= 50
            assert data_f["source"] == "fixtures"
    finally:
        settings.offline_mode = False
