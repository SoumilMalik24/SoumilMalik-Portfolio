"""Admin metrics analytics endpoint."""
from typing import Any, Dict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import current_admin
from app.models.admin import Admin
from app.services.metrics import compute_metrics

router = APIRouter(prefix="/api/admin", tags=["Admin Metrics"])


@router.get("/metrics", summary="Aggregated website telemetry dashboard")
def get_metrics(
    days: int = 7,
    tz: int = 0,
    _: Admin = Depends(current_admin),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Compute and return telemetry metrics for the specified day range and timezone."""
    return compute_metrics(db, days=days, tz=tz)
