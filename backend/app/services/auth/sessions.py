"""Admin session lifecycle, token generation, and validation."""
import hashlib
import secrets
import uuid
from datetime import timedelta
from typing import Optional, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.errors import ApiError
from app.models.admin import Admin, AdminSession
from app.utils.time import utcnow


def hash_token(raw_token: str) -> str:
    """Return SHA-256 hex digest of a bearer token."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def create_session(
    db: Session,
    admin_id: int,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Tuple[str, AdminSession]:
    """
    Generate a new high-entropy raw bearer token and persist an AdminSession.
    Returns (raw_token, session_model).
    """
    settings = get_settings()
    now = utcnow()
    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_token(raw_token)
    session_id = str(uuid.uuid4())
    expires_at = now + timedelta(hours=settings.SESSION_MAX_HOURS)

    session = AdminSession(
        id=session_id,
        admin_id=admin_id,
        token_hash=token_hash,
        created_at=now,
        last_used_at=now,
        expires_at=expires_at,
        revoked_at=None,
        ip=ip,
        user_agent=user_agent[:255] if user_agent else None,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return raw_token, session


def get_session_by_token(db: Session, raw_token: str) -> Optional[AdminSession]:
    """Retrieve session by raw bearer token."""
    token_hash = hash_token(raw_token)
    return db.scalars(
        select(AdminSession).where(AdminSession.token_hash == token_hash)
    ).first()


def validate_session(
    db: Session,
    session: AdminSession,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Admin:
    """
    Validate session expiration, idle timeout, revoked status, and active admin.
    Updates last_used_at if older than 60 seconds.
    Raises ApiError(401, 'Unauthorized') on any failure.
    """
    settings = get_settings()
    now = utcnow()

    if session.revoked_at is not None:
        raise ApiError(status_code=401, detail="Unauthorized")

    if now >= session.expires_at:
        raise ApiError(status_code=401, detail="Unauthorized")

    idle_seconds = (now - session.last_used_at).total_seconds()
    if idle_seconds > (settings.SESSION_IDLE_MINUTES * 60):
        raise ApiError(status_code=401, detail="Unauthorized")

    admin = session.admin
    if admin is None or not admin.is_active:
        raise ApiError(status_code=401, detail="Unauthorized")

    # Update last_used_at only if older than 60s
    if idle_seconds > 60:
        session.last_used_at = now
        if ip:
            session.ip = ip
        if user_agent:
            session.user_agent = user_agent[:255]
        db.commit()

    return admin


def revoke_session(db: Session, session: AdminSession) -> None:
    """Mark a session as revoked."""
    session.revoked_at = utcnow()
    db.commit()


def revoke_all_sessions(
    db: Session,
    admin_id: int,
    except_session_id: Optional[str] = None,
) -> None:
    """Revoke all sessions for an admin, optionally excluding one."""
    now = utcnow()
    stmt = (
        select(AdminSession)
        .where(AdminSession.admin_id == admin_id, AdminSession.revoked_at.is_(None))
    )
    if except_session_id:
        stmt = stmt.where(AdminSession.id != except_session_id)

    sessions = db.scalars(stmt).all()
    for s in sessions:
        s.revoked_at = now
    db.commit()
