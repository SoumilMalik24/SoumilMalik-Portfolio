"""Tests for programmatic Alembic migrations verification."""
from pathlib import Path

import sqlalchemy as sa
from alembic import command
from alembic.config import Config


def test_alembic_upgrade_creates_phase1_tables_and_columns(tmp_path):
    """
    Run 'alembic upgrade head' on a fresh temporary SQLite database
    and verify every Phase 1 table and new column is created.
    """
    mig_db_file = tmp_path / "test_migration.db"
    mig_db_url = f"sqlite:///{mig_db_file}"

    ini_path = Path("alembic.ini").resolve()
    cfg = Config(str(ini_path))
    cfg.set_main_option("sqlalchemy.url", mig_db_url)

    # Run migration
    command.upgrade(cfg, "head")

    engine = sa.create_engine(mig_db_url)
    inspector = sa.inspect(engine)
    table_names = set(inspector.get_table_names())

    expected_tables = {
        "admins",
        "admin_sessions",
        "password_reset_tokens",
        "audit_log",
        "system_kv",
        "sessions",
        "section_dwell",
        "conversations",
        "messages",
        "content_sections",
        "content_revisions",
        "publishes",
        "assets",
        "kb_chunks",
        "contact_messages",
    }
    assert expected_tables.issubset(table_names), f"Missing tables: {expected_tables - table_names}"

    # Verify new columns on conversations
    conv_cols = {col["name"] for col in inspector.get_columns("conversations")}
    expected_conv_cols = {"id", "visitor_id", "started_at", "last_at", "message_count", "starred", "archived", "note", "ip_hash"}
    assert expected_conv_cols.issubset(conv_cols), f"Missing conversation columns: {expected_conv_cols - conv_cols}"

    # Verify new columns on messages
    msg_cols = {col["name"] for col in inspector.get_columns("messages")}
    expected_msg_cols = {
        "id", "conversation_id", "role", "content", "created_at",
        "unanswered", "section", "mood", "model", "latency_ms", "tokens_in", "tokens_out"
    }
    assert expected_msg_cols.issubset(msg_cols), f"Missing message columns: {expected_msg_cols - msg_cols}"

    # Verify admins columns
    admin_cols = {col["name"] for col in inspector.get_columns("admins")}
    expected_admin_cols = {
        "id", "email", "phone", "display_name", "password_hash",
        "is_active", "failed_logins", "locked_until", "password_changed_at",
        "last_login_at", "last_login_ip", "totp_secret_enc", "totp_enabled",
        "created_at", "updated_at"
    }
    assert expected_admin_cols.issubset(admin_cols), f"Missing admin columns: {expected_admin_cols - admin_cols}"
