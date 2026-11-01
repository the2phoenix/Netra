"""TTL Cache with Stale-While-Error and per-key concurrency locking.

Per trd.md section 5.1 and testing.md T-API-01..T-API-04.
"""

import asyncio
import json
import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, Optional, Tuple

logger = logging.getLogger("netra.cache")


class UpstreamUnavailable(Exception):
    """Raised when upstream fails and no cached or stale entry is available."""
    pass


@dataclass
class CacheEntry:
    value: Any
    fetched_at: float
    ttl_s: float
    last_error: Optional[str] = None


class TTLCache:
    def __init__(self, disk_dir: Optional[Path] = None):
        self._entries: Dict[str, CacheEntry] = {}
        self._locks: Dict[str, asyncio.Lock] = {}
        self._meta_lock: Optional[asyncio.Lock] = None
        self._disk_dir = disk_dir
        if self._disk_dir:
            self._disk_dir.mkdir(parents=True, exist_ok=True)

    def _get_meta_lock(self) -> asyncio.Lock:
        # Lazily instantiate inside the running event loop
        if self._meta_lock is None:
            self._meta_lock = asyncio.Lock()
        return self._meta_lock

    async def _get_lock(self, key: str) -> asyncio.Lock:
        meta_lock = self._get_meta_lock()
        async with meta_lock:
            if key not in self._locks:
                self._locks[key] = asyncio.Lock()
            return self._locks[key]

    def _read_disk(self, key: str) -> Optional[CacheEntry]:
        if not self._disk_dir:
            return None
        file_path = self._disk_dir / f"{key}.json"
        if not file_path.exists():
            return None
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return CacheEntry(
                    value=data["value"],
                    fetched_at=data["fetched_at"],
                    ttl_s=data["ttl_s"],
                    last_error=data.get("last_error"),
                )
        except Exception as e:
            logger.warning(f"Failed to read disk cache for {key}: {e}")
            return None

    def _write_disk(self, key: str, entry: CacheEntry) -> None:
        if not self._disk_dir:
            return
        file_path = self._disk_dir / f"{key}.json"
        try:
            payload = {
                "value": entry.value,
                "fetched_at": entry.fetched_at,
                "ttl_s": entry.ttl_s,
                "last_error": entry.last_error,
            }
            def _serialize(obj):
                if hasattr(obj, "model_dump"):
                    return obj.model_dump()
                if hasattr(obj, "dict"):
                    return obj.dict()
                return str(obj)

            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, default=_serialize)
        except Exception as e:
            logger.warning(f"Failed to write disk cache for {key}: {e}")

    async def get(
        self,
        key: str,
        ttl_s: float,
        fetch: Callable[[], Awaitable[Any]],
        now_fn: Callable[[], float] = time.time,
    ) -> Tuple[Any, bool, float]:
        """Fetch from cache or call upstream with stale-while-error resilience.

        Returns:
            Tuple of (value, is_stale, age_s)
        """
        now = now_fn()
        entry = self._entries.get(key)

        # 1. Check if fresh in memory
        if entry is not None:
            age = now - entry.fetched_at
            if age < ttl_s:
                return entry.value, False, age

        # 2. Acquire lock for this key
        lock = await self._get_lock(key)
        async with lock:
            # Re-check under lock
            now = now_fn()
            entry = self._entries.get(key)
            if entry is not None:
                age = now - entry.fetched_at
                if age < ttl_s:
                    return entry.value, False, age

            # 3. If memory empty, try disk backup
            if entry is None and self._disk_dir:
                entry = self._read_disk(key)
                if entry is not None:
                    self._entries[key] = entry
                    age = now - entry.fetched_at
                    if age < ttl_s:
                        return entry.value, False, age

            # 4. Fetch from upstream
            try:
                new_value = await fetch()
                new_entry = CacheEntry(
                    value=new_value,
                    fetched_at=now,
                    ttl_s=ttl_s,
                    last_error=None,
                )
                self._entries[key] = new_entry
                self._write_disk(key, new_entry)
                return new_value, False, 0.0

            except Exception as e:
                logger.error(f"Upstream fetch failed for '{key}': {e}")
                # Stale fallback: serve memory or disk entry if available
                fallback_entry = self._entries.get(key) or (self._read_disk(key) if self._disk_dir else None)
                if fallback_entry is not None:
                    fallback_entry.last_error = str(e)
                    self._entries[key] = fallback_entry
                    age = now - fallback_entry.fetched_at
                    return fallback_entry.value, True, age

                raise UpstreamUnavailable(f"Upstream failed for {key} and no cached data: {e}") from e

    def set_manual(self, key: str, value: Any, ttl_s: float, fetched_at: Optional[float] = None) -> None:
        """Manually populate cache (e.g. for background poller or tests)."""
        ts = fetched_at if fetched_at is not None else time.time()
        entry = CacheEntry(value=value, fetched_at=ts, ttl_s=ttl_s)
        self._entries[key] = entry
        self._write_disk(key, entry)

    def get_existing(self, key: str, now_fn: Callable[[], float] = time.time) -> Optional[Tuple[Any, bool, float]]:
        """Return current entry without calling upstream."""
        entry = self._entries.get(key) or (self._read_disk(key) if self._disk_dir else None)
        if entry is None:
            return None
        age = now_fn() - entry.fetched_at
        is_stale = age >= entry.ttl_s or entry.last_error is not None
        return entry.value, is_stale, age
