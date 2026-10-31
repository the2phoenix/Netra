"""Pydantic data models for NETRA API.

Per trd.md section 4.
"""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    error: str
    message: str


class FeedHealth(BaseModel):
    state: str = Field(description="live | stale | off")
    last_ok: Optional[str] = None
    age_s: Optional[int] = None
    reason: Optional[str] = None


class HealthResponse(BaseModel):
    status: str = "ok"
    offline: bool = False
    uptime_s: int
    feeds: Dict[str, FeedHealth]


class SatelliteItem(BaseModel):
    name: str
    norad_cat_id: int
    line1: str
    line2: str
    group: Optional[str] = None
    epoch: Optional[str] = None
    inclination: Optional[float] = None
    mean_motion: Optional[float] = None
    eccentricity: Optional[float] = None
    period_min: Optional[float] = None


class SatellitesResponse(BaseModel):
    fetched_at: str
    source: str = "celestrak"
    stale: bool = False
    age_s: int = 0
    replay: bool = False
    group: str
    count: int
    items: List[SatelliteItem]


class AircraftItem(BaseModel):
    hex: str
    callsign: Optional[str] = None
    type: Optional[str] = None
    lat: float
    lon: float
    alt_ft: int
    gs_kt: float
    track_deg: float
    vs_fpm: int = 0
    squawk: Optional[str] = None
    seen_s: float = 0.0
    on_ground: bool = False


class FlightsResponse(BaseModel):
    fetched_at: str
    source: str = "adsb.lol"
    stale: bool = False
    age_s: int = 0
    replay: bool = False
    sampled: bool = True
    hubs: int = 12
    count: int
    items: List[AircraftItem]


class HubItem(BaseModel):
    name: str
    code: str
    lat: float
    lon: float
    radius_nm: int = 250


class HubsResponse(BaseModel):
    hubs: List[HubItem]
