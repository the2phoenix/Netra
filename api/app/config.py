"""Configuration settings for NETRA backend."""

import os
from pathlib import Path
from pydantic import BaseModel


def _load_env_files():
    for p in [Path(".env"), Path("api/.env"), Path("../.env")]:
        if p.is_file():
            try:
                for line in p.read_text(encoding="utf-8").splitlines():
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k, v = k.strip(), v.strip().strip("'\"")
                        if k and k not in os.environ:
                            os.environ[k] = v
            except Exception:
                pass


_load_env_files()


class Settings(BaseModel):
    # API Keys & Flags
    firms_map_key: str = os.getenv("FIRMS_MAP_KEY", "")
    offline_mode: bool = os.getenv("OFFLINE_MODE", "false").lower() in ("true", "1", "yes")
    include_registration: bool = os.getenv("INCLUDE_REGISTRATION", "false").lower() in ("true", "1", "yes")

    # OpenSky Network OAuth2 Credentials
    opensky_client_id: str = os.getenv("OPENSKY_CLIENT_ID", "")
    opensky_client_secret: str = os.getenv("OPENSKY_CLIENT_SECRET", "")

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
