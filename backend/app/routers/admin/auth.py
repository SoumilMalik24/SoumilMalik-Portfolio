"""Admin authentication endpoints: login, logout, me, and password reset."""
import re

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.deps import current_admin, current_session
from app.errors import ApiError
from app.models.admin import Admin, AdminSession
from app.schemas.auth import (
    AdminOut,
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    ResetPasswordRequest,
)
from app.services.audit import log_audit
from app.services.auth.lockout import (
    check_account_lock,
    record_failed_attempt,
    record_successful_login,
)
from app.services.auth.passwords import (
    check_needs_rehash,
    hash_password,
    verify_dummy,
    verify_password,
)
from app.services.auth.reset import create_reset_token, redeem_reset_token
from app.services.auth.sessions import (
    create_session,
    revoke_all_sessions,
    revoke_session,
)
from app.services.mailer import send_password_reset_email
from app.utils.net import client_ip
from app.utils.ratelimit import (
    forgot_pw_email_limiter,
    forgot_pw_ip_limiter,
    login_ip_failure_limiter,
)
from app.utils.time import iso, utcnow  # noqa: F401 - patched by tests

router = APIRouter(prefix="/api/admin/auth", tags=["Admin Auth"])


@router.post("/login", response_model=LoginResponse, summary="Admin login")
def login(
    request: Request,
    body: LoginRequest,
    db: Session = Depends(get_db),
) -> LoginResponse:
    """
    Authenticate admin credentials via email or phone.
    Enforces IP-based rate limiting, timing equalization, account lockout, and session issuance.
    """
    ip = client_ip(request)

    # 1. IP limiter: max 10 failed attempts per IP per 15 min
    is_limited, retry_after = login_ip_failure_limiter.is_limited(ip)
    if is_limited:
        raise ApiError(
            status_code=429,
            detail="Too many attempts",
            headers={"Retry-After": str(retry_after)},
        )

    # 2. Normalize identifier
    clean_id = body.identifier.strip()
    if "@" in clean_id:
        identifier_type = "email"
        normalized_id = clean_id.lower()
        admin = db.scalars(
            select(Admin).where(Admin.email == normalized_id, Admin.is_active.is_(True))
        ).first()
    else:
        identifier_type = "phone"
        normalized_id = re.sub(r"[\s\-\(\)]", "", clean_id)
        admin = db.scalars(
            select(Admin).where(Admin.phone == normalized_id, Admin.is_active.is_(True))
        ).first()

    # 3. Load active admin or equalize timing
    if admin is None:
        verify_dummy(body.password)
        login_ip_failure_limiter.record(ip)
        log_audit(
            db,
            action="login.fail",
            admin_id=None,
            ip=ip,
            meta={"identifier_type": identifier_type},
        )
        raise ApiError(status_code=401, detail="Invalid credentials")

    # 4. Check account lockout
    is_locked, retry_after = check_account_lock(db, admin)
    if is_locked:
        raise ApiError(
            status_code=423,
            detail="Account temporarily locked",
            headers={"Retry-After": str(retry_after)},
        )

    # 5. Verify password
    if not verify_password(body.password, admin.password_hash):
        login_ip_failure_limiter.record(ip)
        locked = record_failed_attempt(db, admin)
        log_audit(
            db,
            action="login.fail",
            admin_id=admin.id,
            ip=ip,
            meta={"identifier_type": identifier_type},
        )
        if locked:
            log_audit(
                db,
                action="login.locked",
                admin_id=admin.id,
                ip=ip,
                meta={"identifier_type": identifier_type},
            )
        raise ApiError(status_code=401, detail="Invalid credentials")

    # 6. Success: reset counters, rehash if needed, create session
    record_successful_login(db, admin, ip=ip)
    login_ip_failure_limiter.reset(ip)

    if check_needs_rehash(admin.password_hash):
        admin.password_hash = hash_password(body.password)
        db.commit()

    raw_token, session = create_session(
        db,
        admin_id=admin.id,
        ip=ip,
        user_agent=request.headers.get("user-agent"),
    )
    log_audit(db, action="login.success", admin_id=admin.id, ip=ip)

    admin_out = AdminOut(
        id=admin.id,
        email=admin.email,
        phone=admin.phone,
        display_name=admin.display_name,
        last_login_at=iso(admin.last_login_at),
        created_at=iso(admin.created_at),
    )
    return LoginResponse(
        token=raw_token,
        expires_at=iso(session.expires_at),
        admin=admin_out,
    )


@router.post("/logout", status_code=204, summary="Logout current session")
def logout(
    request: Request,
    admin: Admin = Depends(current_admin),
    session: AdminSession = Depends(current_session),
    db: Session = Depends(get_db),
) -> Response:
    """Revoke the current authentication session."""
    revoke_session(db, session)
    log_audit(db, action="logout", admin_id=admin.id, ip=client_ip(request))
    return Response(status_code=204)


@router.post("/logout-all", status_code=204, summary="Logout all sessions")
def logout_all(
    request: Request,
    admin: Admin = Depends(current_admin),
    db: Session = Depends(get_db),
) -> Response:
    """Revoke all active sessions for the authenticated admin."""
    revoke_all_sessions(db, admin_id=admin.id)
    log_audit(db, action="logout.all", admin_id=admin.id, ip=client_ip(request))
    return Response(status_code=204)


@router.get("/me", response_model=AdminOut, summary="Get current admin profile")
def me(admin: Admin = Depends(current_admin)) -> AdminOut:
    """Return the profile of the currently authenticated admin."""
    return AdminOut(
        id=admin.id,
        email=admin.email,
        phone=admin.phone,
        display_name=admin.display_name,
        last_login_at=iso(admin.last_login_at),
        created_at=iso(admin.created_at),
    )


@router.post("/password/forgot", status_code=202, summary="Request password reset")
def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> JSONResponse:
    """
    Request a password reset link.
    Always returns 202 Accepted to prevent user enumeration.
    """
    ip = client_ip(request)
    email_clean = body.email.strip().lower()

    allowed_ip, retry_ip = forgot_pw_ip_limiter.check_and_record(ip)
    allowed_email, retry_email = forgot_pw_email_limiter.check_and_record(email_clean)
    if not allowed_ip or not allowed_email:
        raise ApiError(
            status_code=429,
            detail="Too many attempts",
            headers={"Retry-After": str(max(retry_ip, retry_email))},
        )

    admin = db.scalars(
        select(Admin).where(Admin.email == email_clean, Admin.is_active.is_(True))
    ).first()

    if admin is not None:
        settings = get_settings()
        raw_token = create_reset_token(db, admin.id, ip=ip)
        reset_link = f"{settings.PUBLIC_ADMIN_URL}?reset={raw_token}"
        background_tasks.add_task(send_password_reset_email, admin.email, reset_link)
        log_audit(db, action="password.reset.request", admin_id=admin.id, ip=ip)

    return JSONResponse(status_code=202, content={"status": "ok"})


@router.post("/password/reset", status_code=204, summary="Complete password reset")
def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    db: Session = Depends(get_db),
) -> Response:
    """Reset password using a valid reset token."""
    ip = client_ip(request)
    admin = redeem_reset_token(db, raw_token=body.token, new_password=body.new_password, ip=ip)
    log_audit(db, action="password.reset", admin_id=admin.id, ip=ip)
    return Response(status_code=204)
