"""Account lockout tracking and failed attempt handling."""
from datetime import timedelta
from typing import Tuple

from sqlalchemy.orm import Session

from app.models.admin import Admin
from app.utils.time import utcnow


def check_account_lock(db: Session, admin: Admin) -> Tuple[bool, int]:
    """
    Check if an admin account is currently locked out.
    If the lockout period has expired, automatically clears failed_logins.
    Returns (is_locked, retry_after_seconds).
    """
    now = utcnow()
    if admin.locked_until:
        if admin.locked_until > now:
            retry_after = max(1, int((admin.locked_until - now).total_seconds()))
            return True, retry_after
        else:
            admin.failed_logins = 0
            admin.locked_until = None
            db.commit()

    return False, 0


def record_failed_attempt(db: Session, admin: Admin) -> bool:
    """
    Increment failed login counter. If threshold of 5 is reached,
    locks account for 15 minutes. Returns True if account is now locked.
    """
    now = utcnow()
    admin.failed_logins += 1
    locked = False
    if admin.failed_logins >= 5:
        admin.locked_until = now + timedelta(minutes=15)
        locked = True
    db.commit()
    return locked


def record_successful_login(db: Session, admin: Admin, ip: str | None = None) -> None:
    """Clear failed login attempts and reset lockout status upon successful authentication."""
    admin.failed_logins = 0
    admin.locked_until = None
    admin.last_login_at = utcnow()
    admin.last_login_ip = ip
    db.commit()
