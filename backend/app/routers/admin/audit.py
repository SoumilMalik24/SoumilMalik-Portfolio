"""Admin audit log query endpoint."""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import current_admin
from app.models.admin import Admin, AuditLog
from app.schemas.account import AuditLogOut
from app.schemas.common import Page
from app.utils.time import iso

router = APIRouter(prefix="/api/admin", tags=["Admin Audit"])


@router.get("/audit", response_model=Page[AuditLogOut], summary="List audit log entries")
def get_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    action: Optional[str] = Query(None),
    _: Admin = Depends(current_admin),
    db: Session = Depends(get_db),
) -> Page[AuditLogOut]:
    """Retrieve paginated audit log entries, newest first."""
    stmt = select(AuditLog)
    count_stmt = select(func.count(AuditLog.id))

    if action:
        stmt = stmt.where(AuditLog.action == action)
        count_stmt = count_stmt.where(AuditLog.action == action)

    total = db.scalar(count_stmt) or 0
    rows = db.scalars(
        stmt.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()

    items = [
        AuditLogOut(
            id=r.id,
            action=r.action,
            target=r.target,
            meta=r.meta,
            ip=r.ip,
            created_at=iso(r.created_at),
        )
        for r in rows
    ]

    return Page[AuditLogOut](items=items, total=total)
