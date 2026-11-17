"""Public health, root, and system runtime status endpoints."""
from typing import Dict

from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.system import HealthResponse, StatusResponse
from app.constants import APP_VERSION
from app.services.kb import index as kb_index
from app.utils.time import iso, utcnow

router = APIRouter(tags=["Health"])


@router.get("/", summary="Root status check")
def root() -> Dict[str, str]:
    """Root entry-point to verify the service is running."""
    return {"status": "Portfolio API is running"}


@router.get("/health", response_model=HealthResponse, summary="Liveness probe")
def health() -> HealthResponse:
    """Liveness probe for monitoring and reverse proxies. Performs no DB or network work."""
    return HealthResponse(status="ok")


@router.get("/api/status", response_model=StatusResponse, summary="Runtime system status")
def status_endpoint(request: Request, db: Session = Depends(get_db)) -> StatusResponse:
    """Check service runtime health, DB connection status, and Kirby availability."""
    booted_at = getattr(request.app.state, "booted_at", None)
    if booted_at is None:
        booted_at = utcnow()

    uptime_s = round(max(0.0, (utcnow() - booted_at).total_seconds()), 2)

    db_status = "ok"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_status = "down"

    kirby_status = kb_index.kirby_state()

    return StatusResponse(
        booted_at=iso(booted_at),
        uptime_s=uptime_s,
        version=APP_VERSION,
        db=db_status,
        kirby=kirby_status,
    )
