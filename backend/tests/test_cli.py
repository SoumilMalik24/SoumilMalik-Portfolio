"""Tests for administrative command-line interface commands."""
import io
import sys

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.cli import main
from app.models.admin import Admin, AdminSession
from app.services.auth.passwords import verify_password
from app.services.auth.sessions import create_session


def test_cli_create_admin_success_scrypt_hash(db: Session, monkeypatch):
    """create-admin with --password-stdin creates a scrypt hash and persists admin."""
    monkeypatch.setattr("sys.stdin", io.StringIO("SuperSecureAdmin123!\n"))

    main(["create-admin", "--email", "cli_user@example.com", "--name", "CLI User", "--password-stdin"])

    admin = db.scalars(select(Admin).where(Admin.email == "cli_user@example.com")).first()
    assert admin is not None
    assert admin.display_name == "CLI User"
    assert admin.password_hash.startswith("$scrypt$ln=10,")
    assert verify_password("SuperSecureAdmin123!", admin.password_hash)


def test_cli_create_admin_duplicate_email_exits_nonzero(db: Session, monkeypatch):
    """create-admin exits non-zero on duplicate email."""
    monkeypatch.setattr("sys.stdin", io.StringIO("PasswordOne123!\n"))
    main(["create-admin", "--email", "dup@example.com", "--name", "First", "--password-stdin"])

    monkeypatch.setattr("sys.stdin", io.StringIO("PasswordTwo123!\n"))
    with pytest.raises(SystemExit) as exc_info:
        main(["create-admin", "--email", "dup@example.com", "--name", "Second", "--password-stdin"])
    assert exc_info.value.code != 0


def test_cli_create_admin_weak_password_rejected(monkeypatch):
    """create-admin rejects passwords violating password policy."""
    monkeypatch.setattr("sys.stdin", io.StringIO("short\n"))
    with pytest.raises(SystemExit) as exc_info:
        main(["create-admin", "--email", "weak@example.com", "--name", "Weak", "--password-stdin"])
    assert exc_info.value.code != 0


def test_cli_reset_password_revokes_sessions(db: Session, monkeypatch):
    """reset-password updates password and revokes all active sessions."""
    monkeypatch.setattr("sys.stdin", io.StringIO("InitialPassword123!\n"))
    main(["create-admin", "--email", "reset_me@example.com", "--name", "Reset User", "--password-stdin"])

    admin = db.scalars(select(Admin).where(Admin.email == "reset_me@example.com")).first()
    _, sess = create_session(db, admin_id=admin.id)
    assert sess.revoked_at is None

    # Reset password via CLI
    monkeypatch.setattr("sys.stdin", io.StringIO("BrandNewPassword456!\n"))
    main(["reset-password", "--email", "reset_me@example.com", "--password-stdin"])

    db.expire_all()
    admin_after = db.scalars(select(Admin).where(Admin.email == "reset_me@example.com")).first()
    assert verify_password("BrandNewPassword456!", admin_after.password_hash)

    sess_after = db.get(AdminSession, sess.id)
    assert sess_after.revoked_at is not None


def test_cli_list_admins_output_contains_email(monkeypatch, capsys):
    """list-admins prints tabular output containing registered emails."""
    monkeypatch.setattr("sys.stdin", io.StringIO("PassForList1234!\n"))
    main(["create-admin", "--email", "listed@example.com", "--name", "Listed User", "--password-stdin"])

    main(["list-admins"])
    captured = capsys.readouterr()
    assert "listed@example.com" in captured.out
    assert "Listed User" in captured.out


def test_cli_set_active_toggles_flag(db: Session, monkeypatch):
    """set-active toggles is_active status of admin."""
    monkeypatch.setattr("sys.stdin", io.StringIO("PassSetActive123!\n"))
    main(["create-admin", "--email", "active_test@example.com", "--name", "Active User", "--password-stdin"])

    main(["set-active", "--email", "active_test@example.com", "--active", "false"])
    db.expire_all()
    admin = db.scalars(select(Admin).where(Admin.email == "active_test@example.com")).first()
    assert admin.is_active is False
