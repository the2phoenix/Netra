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
    finally:
        settings.offline_mode = False
