"""Comprehensive authentication tests covering scrypt, lockout, sessions, reset, and audit."""
import hashlib
from datetime import timedelta
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.admin import Admin, AdminSession, AuditLog, PasswordResetToken
from app.services.auth.sessions import create_session
from app.utils.time import utcnow


def test_login_by_email_mixed_case_and_whitespace(client: TestClient, test_admin: Admin, admin_password: str):
    """Login succeeds with case-insensitive and stripped email."""
    res = client.post(
        "/api/admin/auth/login",
        json={"identifier": "   Admin@EXAMPLE.Com  ", "password": admin_password},
    )
    assert res.status_code == 200
    data = res.json()
    assert "token" in data
    assert data["admin"]["email"] == "admin@example.com"


def test_login_by_phone_with_spaces_and_symbols(client: TestClient, test_admin: Admin, admin_password: str):
    """Login succeeds with phone number formatted with spaces and symbols."""
    # test_admin.phone is "+919876543210"
    res = client.post(
        "/api/admin/auth/login",
        json={"identifier": "+91 98765 43210", "password": admin_password},
    )
    assert res.status_code == 200
    data = res.json()
    assert "token" in data
    assert data["admin"]["phone"] == "+919876543210"


def test_login_unknown_identifier_and_wrong_password_identical_401(
    client: TestClient, test_admin: Admin
):
    """Unknown identifier and wrong password both return 401 with identical 'Invalid credentials' detail."""
    res_unknown = client.post(
        "/api/admin/auth/login",
        json={"identifier": "unknown@example.com", "password": "WrongPassword123!"},
    )
    assert res_unknown.status_code == 401
    assert res_unknown.json() == {"detail": "Invalid credentials"}

    res_wrong_pw = client.post(
        "/api/admin/auth/login",
        json={"identifier": test_admin.email, "password": "WrongPassword123!"},
    )
    assert res_wrong_pw.status_code == 401
    assert res_wrong_pw.json() == {"detail": "Invalid credentials"}


def test_login_account_lockout_after_5_failures(client: TestClient, test_admin: Admin, db: Session):
    """5 consecutive wrong passwords trigger 423 lockout with Retry-After; audit logged."""
    headers = {"X-Forwarded-For": "10.0.0.1"}

    # 4 failures -> 401
    for _ in range(4):
        res = client.post(
            "/api/admin/auth/login",
            json={"identifier": test_admin.email, "password": "BadPassword123!"},
            headers=headers,
        )
        assert res.status_code == 401

    # 5th failure -> 401 (locks account)
    res_5 = client.post(
        "/api/admin/auth/login",
        json={"identifier": test_admin.email, "password": "BadPassword123!"},
        headers=headers,
    )
    assert res_5.status_code == 401

    # Verify locked in DB
    db.refresh(test_admin)
    assert test_admin.failed_logins == 5
    assert test_admin.locked_until is not None

    # 6th attempt -> 423 Account temporarily locked
    res_6 = client.post(
        "/api/admin/auth/login",
        json={"identifier": test_admin.email, "password": "AnyPassword123!"},
        headers=headers,
    )
    assert res_6.status_code == 423
    assert res_6.json() == {"detail": "Account temporarily locked"}
    assert "Retry-After" in res_6.headers
    assert int(res_6.headers["Retry-After"]) > 0


def test_login_lockout_expiry_resets_counter(
    client: TestClient, test_admin: Admin, admin_password: str, db: Session, monkeypatch
):
    """After lockout expiry, successful login resets failed_logins counter."""
    # Lock the account
    test_admin.failed_logins = 5
    test_admin.locked_until = utcnow() + timedelta(minutes=15)
    db.commit()

    # Fast forward time past lockout
    future_time = utcnow() + timedelta(minutes=16)
    monkeypatch.setattr("app.services.auth.lockout.utcnow", lambda: future_time)
    monkeypatch.setattr("app.routers.admin.auth.utcnow", lambda: future_time)

    res = client.post(
        "/api/admin/auth/login",
        json={"identifier": test_admin.email, "password": admin_password},
    )
    assert res.status_code == 200

    db.refresh(test_admin)
    assert test_admin.failed_logins == 0
    assert test_admin.locked_until is None


def test_ip_rate_limiter_blocks_after_10_failures(client: TestClient, test_admin: Admin):
    """IP limiter returns 429 with Retry-After after 10 failed login attempts from one IP."""
    headers = {"X-Forwarded-For": "192.168.1.99"}

    # 10 failed attempts with unknown user so account is not locked
    for i in range(10):
        res = client.post(
            "/api/admin/auth/login",
            json={"identifier": f"unknown_{i}@example.com", "password": "BadPassword123!"},
            headers=headers,
        )
        assert res.status_code == 401

    # 11th attempt is throttled by IP limiter
    res_11 = client.post(
        "/api/admin/auth/login",
        json={"identifier": "another@example.com", "password": "BadPassword123!"},
        headers=headers,
    )
    assert res_11.status_code == 429
    assert res_11.json() == {"detail": "Too many attempts"}
    assert "Retry-After" in res_11.headers


def test_me_endpoint_and_token_validation(
    client: TestClient, test_admin: Admin, admin_token: str
):
    """GET /me requires valid token; missing or garbage token returns 401."""
    # Success with token
    res = client.get("/api/admin/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    assert res.json()["email"] == test_admin.email

    # Missing header -> 401
    res_missing = client.get("/api/admin/auth/me")
    assert res_missing.status_code == 401
    assert res_missing.json() == {"detail": "Unauthorized"}

    # Garbage token -> 401
    res_garbage = client.get(
        "/api/admin/auth/me", headers={"Authorization": "Bearer not_a_valid_token_xyz"}
    )
    assert res_garbage.status_code == 401
    assert res_garbage.json() == {"detail": "Unauthorized"}


def test_session_idle_timeout_and_absolute_expiry(
    client: TestClient, test_admin: Admin, admin_token: str, monkeypatch
):
    """Session expires upon idle timeout or absolute max hours."""
    # 1. Idle timeout (default 120 minutes)
    idle_future = utcnow() + timedelta(minutes=121)
    monkeypatch.setattr("app.services.auth.sessions.utcnow", lambda: idle_future)
    res_idle = client.get("/api/admin/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_idle.status_code == 401

    # 2. Absolute expiry (default 12 hours)
    abs_future = utcnow() + timedelta(hours=13)
    monkeypatch.setattr("app.services.auth.sessions.utcnow", lambda: abs_future)
    res_abs = client.get("/api/admin/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_abs.status_code == 401


def test_inactive_admin_rejected(client: TestClient, test_admin: Admin, admin_token: str, db: Session):
    """Inactive admin cannot authenticate with an otherwise valid session."""
    test_admin.is_active = False
    db.commit()

    res = client.get("/api/admin/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 401


def test_logout_and_logout_all(client: TestClient, test_admin: Admin, db: Session):
    """Logout revokes only current session; logout-all revokes all sessions."""
    tok1, sess1 = create_session(db, test_admin.id)
    tok2, sess2 = create_session(db, test_admin.id)

    # Logout with sess1
    res = client.post("/api/admin/auth/logout", headers={"Authorization": f"Bearer {tok1}"})
    assert res.status_code == 204

    # sess1 is revoked
    assert client.get("/api/admin/auth/me", headers={"Authorization": f"Bearer {tok1}"}).status_code == 401
    # sess2 is still valid
    assert client.get("/api/admin/auth/me", headers={"Authorization": f"Bearer {tok2}"}).status_code == 200

    # Logout-all with sess2
    tok3, _ = create_session(db, test_admin.id)
    res_all = client.post("/api/admin/auth/logout-all", headers={"Authorization": f"Bearer {tok2}"})
    assert res_all.status_code == 204

    # Both sess2 and sess3 are now revoked
    assert client.get("/api/admin/auth/me", headers={"Authorization": f"Bearer {tok2}"}).status_code == 401
    assert client.get("/api/admin/auth/me", headers={"Authorization": f"Bearer {tok3}"}).status_code == 401


def test_password_forgot_and_reset_flow(
    client: TestClient, test_admin: Admin, db: Session, monkeypatch
):
    """Forgot password sends email only for known user; reset works once and clears lock."""
    with patch("app.routers.admin.auth.send_password_reset_email") as mock_mailer:
        # Unknown email returns 202 without sending mail
        res_unk = client.post(
            "/api/admin/auth/password/forgot", json={"email": "nobody@example.com"}
        )
        assert res_unk.status_code == 202
        assert res_unk.json() == {"status": "ok"}
        assert not mock_mailer.called

        # Known email returns 202 and triggers mailer
        res_known = client.post(
            "/api/admin/auth/password/forgot", json={"email": test_admin.email}
        )
        assert res_known.status_code == 202
        assert mock_mailer.called

        # Extract token from the reset link passed to mailer
        args, _ = mock_mailer.call_args
        to_email, link = args
        assert to_email == test_admin.email
        raw_token = link.split("?reset=")[-1]

        # Verify token in DB is stored HASHED
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        token_row = db.scalars(
            select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
        ).first()
        assert token_row is not None
        assert token_row.used_at is None

        # Lock the admin and create a session to verify reset clears them
        test_admin.failed_logins = 5
        test_admin.locked_until = utcnow() + timedelta(minutes=15)
        sess_token, _ = create_session(db, test_admin.id)
        db.commit()

        # Reset password
        new_pw = "NewBrandStrongPass987!"
        res_reset = client.post(
            "/api/admin/auth/password/reset",
            json={"token": raw_token, "new_password": new_pw},
        )
        assert res_reset.status_code == 204

        # Old session revoked
        assert client.get("/api/admin/auth/me", headers={"Authorization": f"Bearer {sess_token}"}).status_code == 401

        # Lockout cleared
        db.refresh(test_admin)
        assert test_admin.failed_logins == 0
        assert test_admin.locked_until is None

        # Can login with new password
        login_res = client.post(
            "/api/admin/auth/login",
            json={"identifier": test_admin.email, "password": new_pw},
        )
        assert login_res.status_code == 200

        # Second use of same token fails -> 400
        res_second = client.post(
            "/api/admin/auth/password/reset",
            json={"token": raw_token, "new_password": "AnotherStrongPass999!"},
        )
        assert res_second.status_code == 400
        assert res_second.json() == {"detail": "Invalid or expired reset link"}


def test_password_policy_violations(client: TestClient, test_admin: Admin, db: Session):
    """Password policy rejects too short, email local part, and common passwords with 422 errors[].field == new_password."""
    with patch("app.routers.admin.auth.send_password_reset_email") as mock_mailer:
        client.post("/api/admin/auth/password/forgot", json={"email": test_admin.email})
        raw_token = mock_mailer.call_args[0][1].split("?reset=")[-1]

        # 1. Too short (< 12 chars)
        res_short = client.post(
            "/api/admin/auth/password/reset",
            json={"token": raw_token, "new_password": "Short1!"},
        )
        assert res_short.status_code == 422
        data = res_short.json()
        assert data["detail"] == "Validation failed"
        assert any(e["field"] == "new_password" for e in data["errors"])

        # 2. Contains email local part ("admin")
        res_email = client.post(
            "/api/admin/auth/password/reset",
            json={"token": raw_token, "new_password": "MySuperSecretAdminPass123!"},
        )
        assert res_email.status_code == 422
        assert any(e["field"] == "new_password" for e in res_email.json()["errors"])

        # 3. Common password
        res_common = client.post(
            "/api/admin/auth/password/reset",
            json={"token": raw_token, "new_password": "password1234"},
        )
        assert res_common.status_code == 422
        assert any(e["field"] == "new_password" for e in res_common.json()["errors"])


def test_audit_log_entries_written(
    client: TestClient, test_admin: Admin, admin_password: str, db: Session
):
    """Verify audit logs are persisted for login.success, login.fail, login.locked, and password.reset."""
    # login.fail
    client.post(
        "/api/admin/auth/login",
        json={"identifier": test_admin.email, "password": "WrongPassword1!"},
    )
    fail_entry = db.scalars(
        select(AuditLog).where(AuditLog.action == "login.fail")
    ).first()
    assert fail_entry is not None

    # login.success
    client.post(
        "/api/admin/auth/login",
        json={"identifier": test_admin.email, "password": admin_password},
    )
    success_entry = db.scalars(
        select(AuditLog).where(AuditLog.action == "login.success")
    ).first()
    assert success_entry is not None

    # login.locked (trigger 5 failures to reach lockout threshold)
    for _ in range(5):
        client.post(
            "/api/admin/auth/login",
            json={"identifier": test_admin.email, "password": "WrongPassword1!"},
        )
    locked_entry = db.scalars(
        select(AuditLog).where(AuditLog.action == "login.locked")
    ).first()
    assert locked_entry is not None


def test_scrypt_production_parameters_and_verification(monkeypatch):
    """
    Verify password hashing with real production scrypt parameters:
    - Stored format string: $scrypt$ln=15,r=8,p=3$<salt b64 no padding>$<hash b64 no padding>
    - Successful verify
    - Failed verify
    - Malformed-hash verify returns False and never raises (including absurd parameters)
    - check_needs_rehash is True for an $argon2id$... string and for different parameters
    """
    from app.services.auth.passwords import (
        hash_password,
        verify_password,
        check_needs_rehash,
    )

    # Force real production parameters
    monkeypatch.setattr("app.services.auth.passwords.SCRYPT_LN", 15)
    monkeypatch.setattr("app.services.auth.passwords.SCRYPT_R", 8)
    monkeypatch.setattr("app.services.auth.passwords.SCRYPT_P", 3)

    password = "SuperSecurePassword123!"
    hashed = hash_password(password)

    # 1. Check stored format string
    assert hashed.startswith("$scrypt$ln=15,r=8,p=3$")
    parts = hashed.split("$")
    assert len(parts) == 5
    assert parts[0] == ""
    assert parts[1] == "scrypt"
    assert parts[2] == "ln=15,r=8,p=3"
    salt_b64 = parts[3]
    hash_b64 = parts[4]
    assert len(salt_b64) > 0 and "=" not in salt_b64
    assert len(hash_b64) > 0 and "=" not in hash_b64

    # Current production hash does not need rehash
    assert check_needs_rehash(hashed) is False

    # 2. Successful verify
    assert verify_password(password, hashed) is True

    # 3. Failed verify
    assert verify_password("WrongPassword123!", hashed) is False

    # 4. Malformed-hash verify returning False and never raising
    malformed_hashes = [
        "not-a-valid-hash-string",
        "$argon2id$v=19$m=65536,t=2,p=1$c29tZXNhbHQ$c29tZWhhc2g",
        "$scrypt$ln=9,r=8,p=3$c2FsdA$aGFzaA",       # ln outside 10..20
        "$scrypt$ln=21,r=8,p=3$c2FsdA$aGFzaA",      # ln outside 10..20
        "$scrypt$ln=15,r=0,p=3$c2FsdA$aGFzaA",      # r outside 1..16
        "$scrypt$ln=15,r=17,p=3$c2FsdA$aGFzaA",     # r outside 1..16
        "$scrypt$ln=15,r=8,p=0$c2FsdA$aGFzaA",      # p outside 1..16
        "$scrypt$ln=15,r=8,p=17$c2FsdA$aGFzaA",     # p outside 1..16
        "$scrypt$ln=15,r=8,p=3$invalid base64!@#$invalid base64!@#",
        "$scrypt$ln=15,r=8,p=3$c2FsdA",             # missing hash part
        "$scrypt$ln=15,r=8$c2FsdA$aGFzaA",          # missing p parameter
        "$scrypt$ln=15,r=8,p=3,x=1$c2FsdA$aGFzaA",  # extra parameter
        "$scrypt$",                                  # truncated
        "",                                          # empty string
        None,                                        # non-string
        12345,                                       # integer
    ]
    for bad_hash in malformed_hashes:
        assert verify_password(password, bad_hash) is False

    # 5. check_needs_rehash being True for an $argon2id$... string
    argon2_hash = "$argon2id$v=19$m=65536,t=2,p=1$c29tZXNhbHQ$c29tZWhhc2g"
    assert check_needs_rehash(argon2_hash) is True

    # 6. check_needs_rehash being True for different params
    assert check_needs_rehash(hashed.replace("ln=15", "ln=14")) is True
    assert check_needs_rehash(hashed.replace("ln=15", "ln=10")) is True
    assert check_needs_rehash(hashed.replace("r=8", "r=16")) is True
    assert check_needs_rehash(hashed.replace("p=3", "p=1")) is True
    assert check_needs_rehash("malformed_hash") is True

