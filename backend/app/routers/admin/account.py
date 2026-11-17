"""Admin account profile, password change, and session management endpoints."""
from typing import Dict, List

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import PHONE_REGEX
from app.db import get_db
from app.deps import current_admin, current_session
from app.errors import ApiError
from app.models.admin import Admin, AdminSession
from app.schemas.account import (
    ChangePasswordRequest,
    SessionOut,
    UpdateAccountRequest,
)
from app.schemas.auth import AdminOut
from app.services.audit import log_audit
from app.services.auth.passwords import (
    hash_password,
    validate_password_policy,
    verify_password,
)
from app.services.auth.sessions import revoke_all_sessions, revoke_session
from app.utils.net import client_ip
from app.utils.time import iso, utcnow

router = APIRouter(prefix="/api/admin", tags=["Admin Account"])


@router.patch("/account", response_model=AdminOut, summary="Update admin profile")
def update_account(
    request: Request,
    body: UpdateAccountRequest,
    admin: Admin = Depends(current_admin),
    db: Session = Depends(get_db),
) -> AdminOut:
    """
    Update display name, phone, or email.
    Email change requires valid current_password.
    Phone is validated against E.164. Duplicate phone/email returns 409.
    """
    changed_fields: List[str] = []

    if body.display_name is not None:
        name_clean = body.display_name.strip()
        if not name_clean:
            raise ApiError(
                status_code=422,
                detail="Validation failed",
                errors=[{"field": "display_name", "msg": "Display name cannot be empty"}],
            )
        if name_clean != admin.display_name:
            admin.display_name = name_clean
            changed_fields.append("display_name")

    if body.phone is not None:
        phone_clean = body.phone.strip()
        if not phone_clean:
            if admin.phone is not None:
                admin.phone = None
                changed_fields.append("phone")
        else:
            if not PHONE_REGEX.match(phone_clean):
                raise ApiError(
                    status_code=422,
                    detail="Validation failed",
                    errors=[{"field": "phone", "msg": "Invalid E.164 phone number format"}],
                )
            if phone_clean != admin.phone:
                existing = db.scalars(
                    select(Admin).where(Admin.phone == phone_clean, Admin.id != admin.id)
                ).first()
                if existing:
                    raise ApiError(status_code=409, detail="Phone number already in use")
                admin.phone = phone_clean
                changed_fields.append("phone")

    if body.email is not None:
        email_clean = body.email.strip().lower()
        if email_clean != admin.email:
            if not body.current_password or not verify_password(
                body.current_password, admin.password_hash
            ):
                raise ApiError(status_code=403, detail="Current password is incorrect")

            existing = db.scalars(
                select(Admin).where(Admin.email == email_clean, Admin.id != admin.id)
            ).first()
            if existing:
                raise ApiError(status_code=409, detail="Email already in use")

            admin.email = email_clean
            changed_fields.append("email")

    if changed_fields:
        admin.updated_at = utcnow()
        db.commit()
        db.refresh(admin)
        log_audit(
            db,
            action="account.update",
            admin_id=admin.id,
            ip=client_ip(request),
            meta={"fields": changed_fields},
        )

    return AdminOut(
        id=admin.id,
        email=admin.email,
        phone=admin.phone,
        display_name=admin.display_name,
        last_login_at=iso(admin.last_login_at),
        created_at=iso(admin.created_at),
    )


@router.post("/account/password", status_code=204, summary="Change admin password")
def change_password(
    request: Request,
    body: ChangePasswordRequest,
    admin: Admin = Depends(current_admin),
    session: AdminSession = Depends(current_session),
    db: Session = Depends(get_db),
) -> Response:
    """
    Change current password.
    Requires correct current password and validates password policy.
    Revokes all other active sessions while preserving current session.
    """
    if not verify_password(body.current_password, admin.password_hash):
        raise ApiError(status_code=403, detail="Current password is incorrect")

    validate_password_policy(
        new_password=body.new_password,
        email=admin.email,
        current_password=body.current_password,
    )

    admin.password_hash = hash_password(body.new_password)
    admin.password_changed_at = utcnow()
    admin.updated_at = utcnow()

    revoke_all_sessions(db, admin_id=admin.id, except_session_id=session.id)
    db.commit()

    log_audit(db, action="password.change", admin_id=admin.id, ip=client_ip(request))
    return Response(status_code=204)


@router.get("/sessions", summary="List active admin sessions")
def list_sessions(
    admin: Admin = Depends(current_admin),
    current_sess: AdminSession = Depends(current_session),
    db: Session = Depends(get_db),
) -> Dict[str, List[SessionOut]]:
    """Retrieve active (unexpired, unrevoked) sessions for current admin."""
    now = utcnow()
    rows = db.scalars(
        select(AdminSession)
        .where(
            AdminSession.admin_id == admin.id,
            AdminSession.revoked_at.is_(None),
            AdminSession.expires_at > now,
        )
        .order_by(AdminSession.created_at.desc())
    ).all()

    items = [
        SessionOut(
            id=s.id,
            created_at=iso(s.created_at),
            last_used_at=iso(s.last_used_at),
            expires_at=iso(s.expires_at),
            ip=s.ip,
            user_agent=s.user_agent,
            current=(s.id == current_sess.id),
        )
        for s in rows
    ]
    return {"items": items}


@router.delete("/sessions/{session_id}", status_code=204, summary="Revoke a session")
def delete_session(
    session_id: str,
    request: Request,
    admin: Admin = Depends(current_admin),
    db: Session = Depends(get_db),
) -> Response:
    """Revoke a specific session owned by the authenticated admin."""
    target_session = db.scalars(
        select(AdminSession).where(
            AdminSession.id == session_id,
            AdminSession.admin_id == admin.id,
        )
    ).first()

    if target_session is None or target_session.revoked_at is not None:
        raise ApiError(status_code=404, detail="Session not found")

    revoke_session(db, target_session)
    log_audit(
        db,
        action="session.revoke",
        admin_id=admin.id,
        target=target_session.id,
        ip=client_ip(request),
    )
    return Response(status_code=204)
