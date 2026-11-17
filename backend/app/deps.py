"""FastAPI dependency injection utilities."""
from typing import Optional, Tuple

from fastapi import Depends, Header, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import ApiError
from app.models.admin import Admin, AdminSession
from app.services.auth.sessions import get_session_by_token, validate_session
from app.utils.net import client_ip


def _extract_session(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> Tuple[Admin, AdminSession]:
    """Verify bearer token from Authorization header and return (Admin, AdminSession)."""
    if not authorization:
        raise ApiError(status_code=401, detail="Unauthorized")

    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise ApiError(status_code=401, detail="Unauthorized")

    raw_token = parts[1].strip()
    session = get_session_by_token(db, raw_token)
    if session is None:
        raise ApiError(status_code=401, detail="Unauthorized")

    ip = client_ip(request)
    ua = request.headers.get("user-agent")
    admin = validate_session(db, session, ip=ip, user_agent=ua)
    return admin, session


def current_admin(
    admin_and_session: Tuple[Admin, AdminSession] = Depends(_extract_session),
) -> Admin:
    """FastAPI dependency yielding authenticated Admin model."""
    return admin_and_session[0]


def current_session(
    admin_and_session: Tuple[Admin, AdminSession] = Depends(_extract_session),
) -> AdminSession:
    """FastAPI dependency yielding current AdminSession model."""
    return admin_and_session[1]


__all__ = ["current_admin", "current_session", "get_db"]
