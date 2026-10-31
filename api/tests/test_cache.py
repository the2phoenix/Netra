"""Unit tests for cache per testing.md T-API-01..T-API-04."""

import asyncio
import pytest
from app.cache import TTLCache, UpstreamUnavailable


@pytest.mark.asyncio
async def test_t_api_01_cache_hit_inside_ttl():
    """T-API-01: Cache returns fresh value inside TTL without calling upstream."""
    cache = TTLCache()
    calls = 0

    async def fetch():
        nonlocal calls
        calls += 1
        return {"data": "test"}

    now = 1000.0

    # First read fetches from upstream
    val, stale, age = await cache.get("test_key", ttl_s=10.0, fetch=fetch, now_fn=lambda: now)
    assert calls == 1
    assert val == {"data": "test"}
    assert stale is False

    # Next 9 reads inside TTL should NOT call upstream
    for i in range(1, 10):
        val, stale, age = await cache.get("test_key", ttl_s=10.0, fetch=fetch, now_fn=lambda: now + i)
        assert calls == 1
        assert val == {"data": "test"}
        assert stale is False
        assert age == float(i)


@pytest.mark.asyncio
async def test_t_api_02_concurrent_reads_coalesce():
    """T-API-02: Concurrent reads of an expired key cause one upstream call (lock)."""
    cache = TTLCache()
    calls = 0

    async def slow_fetch():
        nonlocal calls
        calls += 1
        await asyncio.sleep(0.05)
        return {"data": f"call_{calls}"}

    # Launch 10 concurrent reads
    tasks = [
        cache.get("concurrent_key", ttl_s=10.0, fetch=slow_fetch)
        for _ in range(10)
    ]
    results = await asyncio.gather(*tasks)

    # Exactly 1 upstream call
    assert calls == 1
    for val, stale, _ in results:
        assert val == {"data": "call_1"}
        assert stale is False


@pytest.mark.asyncio
async def test_t_api_03_upstream_raises_returns_stale():
    """T-API-03: Upstream raises: stale entry returned with stale: true."""
    cache = TTLCache()
    should_fail = False

    async def fetch():
        if should_fail:
            raise RuntimeError("Upstream 500 error")
        return {"data": "good_data"}

    now = 1000.0

    # First fetch succeeds
    val, stale, _ = await cache.get("stale_key", ttl_s=10.0, fetch=fetch, now_fn=lambda: now)
    assert val == {"data": "good_data"}
    assert stale is False

    # Simulate expired TTL + upstream failure
    should_fail = True
    now = 1020.0  # 20 seconds later (> 10s TTL)

    val, stale, age = await cache.get("stale_key", ttl_s=10.0, fetch=fetch, now_fn=lambda: now)
    assert val == {"data": "good_data"}
    assert stale is True
    assert age == 20.0


@pytest.mark.asyncio
async def test_t_api_04_upstream_raises_no_entry_throws():
    """T-API-04: Upstream raises and no entry exists: UpstreamUnavailable."""
    cache = TTLCache()

    async def failing_fetch():
        raise ConnectionError("Network down")

    with pytest.raises(UpstreamUnavailable):
        await cache.get("empty_key", ttl_s=10.0, fetch=failing_fetch)
