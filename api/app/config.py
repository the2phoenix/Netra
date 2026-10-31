"""Configuration settings for NETRA backend."""

import os
from pathlib import Path
from pydantic import BaseModel


class Settings(BaseModel):
    # API Keys & Flags
    firms_map_key: str = os.getenv("FIRMS_MAP_KEY", "")
    offline_mode: bool = os.getenv("OFFLINE_MODE", "false").lower() in ("true", "1", "yes")
    include_registration: bool = os.getenv("INCLUDE_REGISTRATION", "false").lower() in ("true", "1", "yes")

    # Tuning & TTLs
    flight_hub_interval_s: int = int(os.getenv("FLIGHT_HUB_INTERVAL_S", "3"))
    flight_cache_ttl_s: int = int(os.getenv("FLIGHT_CACHE_TTL_S", "5"))
    quake_cache_ttl_s: int = int(os.getenv("QUAKE_CACHE_TTL_S", "60"))
    fire_cache_ttl_s: int = int(os.getenv("FIRE_CACHE_TTL_S", "600"))
    sat_min_refresh_s: int = int(os.getenv("SAT_MIN_REFRESH_S", "7500"))

    # File paths
    cache_dir: Path = Path(os.getenv("CACHE_DIR", "./data/cache"))
    fixtures_dir: Path = Path(os.getenv("FIXTURES_DIR", "./api/fixtures"))
    log_level: str = os.getenv("LOG_LEVEL", "info")


settings = Settings()
