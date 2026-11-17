"""Tests for account profile updates, password changes, sessions, and audit logging."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.admin import Admin
from app.services.auth.passwords import hash_password
from app.services.auth.sessions import create_session
from app.utils.time import utcnow


def test_update_account_display_name_and_phone(
    client: TestClient, test_admin: Admin, auth_headers: dict, db: Session
):
    """PATCH /api/admin/account updates display_name and phone."""
    payload = {
        "display_name": "Updated Name",
        "phone": "+14155552671",
    }
    res = client.patch("/api/admin/account", json=payload, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["display_name"] == "Updated Name"
    assert data["phone"] == "+14155552671"

    db.refresh(test_admin)
    assert test_admin.display_name == "Updated Name"
    assert test_admin.phone == "+14155552671"


def test_update_account_invalid_phone_returns_422(
    client: TestClient, auth_headers: dict
):
    """Invalid phone format returns 422."""
    res = client.patch(
        "/api/admin/account", json={"phone": "not-e164-phone"}, headers=auth_headers
    )
    assert res.status_code == 422
    assert any(e["field"] == "phone" for e in res.json()["errors"])


def test_update_account_duplicate_email_and_phone_returns_409(
    client: TestClient, test_admin: Admin, admin_password: str, auth_headers: dict, db: Session
):
    """Updating email or phone to one already used by another admin returns 409."""
    other = Admin(
        email="other@example.com",
        phone="+12345678901",
        display_name="Other Admin",
        password_hash=hash_password("Pass12345678!"),
        is_active=True,
        failed_logins=0,
        password_changed_at=utcnow(),
        created_at=utcnow(),
        updated_at=utcnow(),
    )
    db.add(other)
    db.commit()

    # Duplicate phone -> 409
    res_phone = client.patch(
        "/api/admin/account", json={"phone": "+12345678901"}, headers=auth_headers
    )
    assert res_phone.status_code == 409

    # Duplicate email -> 409
    res_email = client.patch(
        "/api/admin/account",
        json={"email": "other@example.com", "current_password": admin_password},
        headers=auth_headers,
    )
    assert res_email.status_code == 409


def test_update_email_requires_current_password(
    client: TestClient, test_admin: Admin, auth_headers: dict
):
    """Email change without or with incorrect current password returns 403."""
    # Without current password -> 403
    res_no_pw = client.patch(
        "/api/admin/account",
        json={"email": "brandnew@example.com"},
        headers=auth_headers,
    )
    assert res_no_pw.status_code == 403

    # With wrong current password -> 403
    res_bad_pw = client.patch(
        "/api/admin/account",
        json={"email": "brandnew@example.com", "current_password": "WrongPassword!"},
        headers=auth_headers,
    )
    assert res_bad_pw.status_code == 403


def test_change_password_workflow(
    client: TestClient, test_admin: Admin, admin_password: str, auth_headers: dict, db: Session
):
    """Change password validates current password, policy, and revokes other sessions."""
    tok2, sess2 = create_session(db, test_admin.id)

    # Wrong current password -> 403
    res_bad = client.post(
        "/api/admin/account/password",
        json={"current_password": "IncorrectPassword!", "new_password": "NewStrongPass999!"},
        headers=auth_headers,
    )
    assert res_bad.status_code == 403

    # Successful password change -> 204
    new_pw = "NewStrongPassword777!"
    res_ok = client.post(
        "/api/admin/account/password",
        json={"current_password": admin_password, "new_password": new_pw},
        headers=auth_headers,
    )
    assert res_ok.status_code == 204

    # Current session STILL works
    assert client.get("/api/admin/auth/me", headers=auth_headers).status_code == 200

    # Other session (sess2) was revoked -> 401
    assert client.get("/api/admin/auth/me", headers={"Authorization": f"Bearer {tok2}"}).status_code == 401


def test_list_and_delete_sessions(
    client: TestClient, test_admin: Admin, auth_headers: dict, db: Session
):
    """GET /sessions identifies current session; DELETE revokes target session; unknown id returns 404."""
    tok2, sess2 = create_session(db, test_admin.id, ip="192.168.1.5", user_agent="Mozilla")

    # List sessions
    res = client.get("/api/admin/sessions", headers=auth_headers)
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) == 2

    # Exactly one session has current == True
    current_items = [s for s in items if s["current"] is True]
    assert len(current_items) == 1

    # Delete other session
    del_res = client.delete(f"/api/admin/sessions/{sess2.id}", headers=auth_headers)
    assert del_res.status_code == 204

    # sess2 now revoked
    assert client.get("/api/admin/auth/me", headers={"Authorization": f"Bearer {tok2}"}).status_code == 401

    # Delete unknown session id -> 404
    del_404 = client.delete("/api/admin/sessions/nonexistent-session-id", headers=auth_headers)
    assert del_404.status_code == 404


def test_audit_logs_pagination_and_filter(
    client: TestClient, auth_headers: dict
):
    """GET /api/admin/audit returns paginated logs with action filtering."""
    # Trigger account updates to generate audit entries
    client.patch("/api/admin/account", json={"display_name": "Audit 1"}, headers=auth_headers)
    client.patch("/api/admin/account", json={"display_name": "Audit 2"}, headers=auth_headers)
    client.patch("/api/admin/account", json={"display_name": "Audit 3"}, headers=auth_headers)

    # Pagination: limit=2
    res_page = client.get("/api/admin/audit?limit=2&offset=0", headers=auth_headers)
    assert res_page.status_code == 200
    data = res_page.json()
    assert "items" in data
    assert "total" in data
    assert len(data["items"]) == 2
    assert data["total"] >= 3

    # Filter by action
    res_filter = client.get(
        "/api/admin/audit?action=account.update", headers=auth_headers
    )
    assert res_filter.status_code == 200
    filter_data = res_filter.json()
    assert all(item["action"] == "account.update" for item in filter_data["items"])
