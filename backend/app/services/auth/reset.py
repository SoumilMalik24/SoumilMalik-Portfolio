"""Password reset token generation and redemption service."""
import hashlib
import secrets
import uuid
from datetime import timedelta
from typing import Optional

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models.admin import Admin, PasswordResetToken
from app.services.auth.passwords import hash_password, validate_password_policy
from app.services.auth.sessions import revoke_all_sessions
from app.utils.time import utcnow


def hash_token(raw_token: str) -> str:
    """Return SHA-256 hex digest of a reset token."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def create_reset_token(db: Session, admin_id: int, ip: Optional[str] = None) -> str:
    """
    Delete any pending unused reset tokens for this admin, generate a new 30-minute token,
    and persist its SHA-256 hash. Returns the raw token string.
    """
    now = utcnow()
    # Delete unused tokens for this admin
    db.execute(
        delete(PasswordResetToken).where(
            PasswordResetToken.admin_id == admin_id,
            PasswordResetToken.used_at.is_(None),
        )
    )

    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_token(raw_token)
    token_id = str(uuid.uuid4())
    expires_at = now + timedelta(minutes=30)

    token_row = PasswordResetToken(
        id=token_id,
        admin_id=admin_id,
        token_hash=token_hash,
        expires_at=expires_at,
        used_at=None,
        created_at=now,
        ip=ip,
    )
    db.add(token_row)
    db.commit()
    return raw_token


def redeem_reset_token(
    db: Session,
    raw_token: str,
    new_password: str,
    ip: Optional[str] = None,
) -> Admin:
    """
    Validate and redeem a password reset token.
    Enforces password policy, sets new hash, revokes ALL existing sessions,
    clears lockout flags, and marks the token as used.
    """
    now = utcnow()
    token_hash = hash_token(raw_token)
    token_row = db.scalars(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
    ).first()

    if (
        token_row is None
        or token_row.used_at is not None
        or token_row.expires_at <= now
    ):
        raise ApiError(status_code=400, detail="Invalid or expired reset link")

    admin = token_row.admin
    if admin is None or not admin.is_active:
        raise ApiError(status_code=400, detail="Invalid or expired reset link")

    # Policy validation raises ApiError(422) if invalid
    validate_password_policy(new_password=new_password, email=admin.email)

    admin.password_hash = hash_password(new_password)
    admin.password_changed_at = now
    admin.failed_logins = 0
    admin.locked_until = None

    token_row.used_at = now
    revoke_all_sessions(db, admin.id)

    db.commit()
    db.refresh(admin)
    return admin
