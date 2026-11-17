"""Audit logging service for security and administrative actions."""
import logging
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models.admin import AuditLog
from app.utils.time import utcnow

logger = logging.getLogger(__name__)


def log_audit(
    db: Session,
    action: str,
    admin_id: Optional[int] = None,
    target: Optional[str] = None,
    meta: Optional[Dict[str, Any]] = None,
    ip: Optional[str] = None,
) -> AuditLog:
    """
    Persist an entry into audit_log.
    Guarantees secrets are never logged.
    """
    now = utcnow()
    entry = AuditLog(
        admin_id=admin_id,
        action=action,
        target=target,
        meta=meta,
        ip=ip,
        created_at=now,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
