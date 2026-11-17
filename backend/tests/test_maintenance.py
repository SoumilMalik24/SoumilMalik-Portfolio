"""Retention purge."""
from datetime import timedelta

from app.cli import main as cli_main
from app.models.admin import AdminSession, AuditLog, PasswordResetToken
from app.models.analytics import SectionDwellModel, SessionModel
from app.models.chat import ConversationModel, MessageModel
from app.services.maintenance import purge, purge_if_due
from app.services.system_kv import get_kv, set_kv
from app.utils.time import utcnow


def _session(db, sid, age_days):
    t = utcnow() - timedelta(days=age_days)
    db.add(SessionModel(id=sid, visitor_id="v", started_at=t, last_seen_at=t, referrer="", device="desktop",
                        is_returning=False, duration_ms=1, max_scroll_pct=1))
    db.add(SectionDwellModel(session_id=sid, section="hero", dwell_ms=5))


def _convo(db, cid, age_days, archived):
    t = utcnow() - timedelta(days=age_days)
    db.add(ConversationModel(id=cid, started_at=t, last_at=t, message_count=1, archived=archived))
    db.add(MessageModel(conversation_id=cid, role="user", content="q", created_at=t))


def test_purge_rules(db, test_admin):
    now = utcnow()
    _session(db, "s_old", 400)
    _session(db, "s_new", 10)
    _convo(db, "c_old_archived", 400, True)
    _convo(db, "c_old_active", 400, False)
    _convo(db, "c_new_archived", 5, True)
    db.add_all([
        AdminSession(id="as_expired", admin_id=test_admin.id, token_hash="a" * 64, created_at=now - timedelta(days=60),
                     last_used_at=now - timedelta(days=60), expires_at=now - timedelta(days=45)),
        AdminSession(id="as_revoked", admin_id=test_admin.id, token_hash="b" * 64, created_at=now - timedelta(days=40),
                     last_used_at=now - timedelta(days=40), expires_at=now + timedelta(hours=1),
                     revoked_at=now - timedelta(days=35)),
        AdminSession(id="as_live", admin_id=test_admin.id, token_hash="c" * 64, created_at=now,
                     last_used_at=now, expires_at=now + timedelta(hours=1)),
        PasswordResetToken(id="t_used", admin_id=test_admin.id, token_hash="d" * 64, created_at=now - timedelta(days=3),
                           expires_at=now - timedelta(days=3), used_at=now - timedelta(days=3)),
        PasswordResetToken(id="t_fresh", admin_id=test_admin.id, token_hash="e" * 64, created_at=now,
                           expires_at=now + timedelta(minutes=30)),
        AuditLog(action="login.success", created_at=now - timedelta(days=400)),
        AuditLog(action="login.success", created_at=now),
    ])
    db.commit()

    counts = purge(db)
    assert counts["analytics_sessions"] == 1 and counts["conversations"] == 1
    assert counts["admin_sessions"] == 2 and counts["reset_tokens"] == 1 and counts["audit_log"] == 1
    db.expire_all()
    assert {s.id for s in db.query(SessionModel)} == {"s_new"}
    assert {d.session_id for d in db.query(SectionDwellModel)} == {"s_new"}
    assert {c.id for c in db.query(ConversationModel)} == {"c_old_active", "c_new_archived"}
    assert {s.id for s in db.query(AdminSession)} == {"as_live"}
    assert {t.id for t in db.query(PasswordResetToken)} == {"t_fresh"}
    assert db.query(AuditLog).count() == 1
    assert get_kv(db, "last_purge_at").endswith("Z")


def test_purge_if_due_respects_interval(db, monkeypatch):
    calls = []
    monkeypatch.setattr("app.services.maintenance.purge", lambda d: calls.append(1))
    set_kv(db, "last_purge_at", (utcnow() - timedelta(hours=2)).isoformat() + "Z")
    purge_if_due()
    assert calls == []
    set_kv(db, "last_purge_at", (utcnow() - timedelta(hours=30)).isoformat() + "Z")
    purge_if_due()
    assert calls == [1]


def test_cli_purge(capsys):
    cli_main(["purge"])
    assert "analytics_sessions: 0 deleted" in capsys.readouterr().out
