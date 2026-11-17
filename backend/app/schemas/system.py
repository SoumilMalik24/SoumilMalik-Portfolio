"""System health and status schemas."""
from pydantic import BaseModel, ConfigDict


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "ok"

    model_config = ConfigDict(extra="ignore")


class StatusResponse(BaseModel):
    """Service runtime status response."""
    booted_at: str
    uptime_s: float
    version: str
    db: str
    kirby: str

    model_config = ConfigDict(extra="ignore")
