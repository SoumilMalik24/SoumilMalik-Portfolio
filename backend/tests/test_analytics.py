"""Unit and integration tests for visitor telemetry, metrics computation, and chat logging."""
import json
import time
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.constants import SECTIONS
from app.models.analytics import SectionDwellModel, SessionModel
from app.services import chat_log
from app.utils.time import utcnow


# ── Track Endpoint Tests ──────────────────────────────────────────────────────

def test_track_upsert_idempotency_and_max(client: TestClient, db: Session):
    # 1. First track call for new session
    payload1 = {
        "visitor_id": "visitor_user_1",
        "session_id": "session_abc_1",
        "referrer": "https://news.ycombinator.com/item?id=42",
        "device": "desktop",
        "duration_ms": 5000,
        "max_scroll_pct": 35,
        "sections": {"hero": 2500, "about": 2000},
    }
    res1 = client.post("/api/track", json=payload1)
    assert res1.status_code == 200
    assert res1.json() == {"ok": True}

    session = db.get(SessionModel, "session_abc_1")
    assert session is not None
    assert session.visitor_id == "visitor_user_1"
    assert session.duration_ms == 5000
    assert session.max_scroll_pct == 35
    assert session.referrer == "news.ycombinator.com"
    assert session.device == "desktop"
    assert session.is_returning is False

    dwells = {sd.section: sd.dwell_ms for sd in session.section_dwells}
    assert dwells == {"hero": 2500, "about": 2000}
    initial_seen = session.last_seen_at

    # 2. Second track call with smaller duration & hero dwell, but higher scroll & about dwell
    time.sleep(0.01)
    payload2 = {
        "visitor_id": "visitor_user_1",
        "session_id": "session_abc_1",
        "referrer": "https://ignore-after-first.com",
        "device": "mobile",
        "duration_ms": 4000,  # lower than 5000
        "max_scroll_pct": 60,  # higher than 35
        "sections": {
            "hero": 1000,  # lower than 2500
            "about": 4500,  # higher than 2000
            "projects": 3000,  # newly reached
        },
    }
    res2 = client.post("/api/track", json=payload2)
    assert res2.status_code == 200
    assert res2.json() == {"ok": True}

    db.expire_all()
    session = db.get(SessionModel, "session_abc_1")
    assert session is not None
    assert session.duration_ms == 5000
    assert session.max_scroll_pct == 60
    assert session.referrer == "news.ycombinator.com"
    assert session.device == "desktop"
    assert session.last_seen_at >= initial_seen

    dwells = {sd.section: sd.dwell_ms for sd in session.section_dwells}
    assert dwells["hero"] == 2500
    assert dwells["about"] == 4500
    assert dwells["projects"] == 3000


def test_track_whitelist_and_clamping(client: TestClient, db: Session):
    payload = {
        "visitor_id": "visitor_clamp_1",
        "session_id": "session_clamp_1",
        "referrer": "direct",
        "device": "desktop",
        "duration_ms": 50_000_000,  # max is 21_600_000
        "max_scroll_pct": 180,  # max is 100
        "sections": {
            "about": 3_000_000,  # max is 1_800_000
            "contact": -100,  # min is 0
            "invalid_section": 9999,  # unknown section -> ignored
        },
    }
    res = client.post("/api/track", json=payload)
    assert res.status_code == 200
    assert res.json() == {"ok": True}

    session = db.get(SessionModel, "session_clamp_1")
    assert session is not None
    assert session.duration_ms == 21_600_000
    assert session.max_scroll_pct == 100

    dwells = {sd.section: sd.dwell_ms for sd in session.section_dwells}
    assert dwells["about"] == 1_800_000
    assert dwells["contact"] == 0
    assert "invalid_section" not in dwells


def test_track_id_validation_silently_dropped(client: TestClient, db: Session):
    # Too short (< 8 chars)
    res = client.post(
        "/api/track",
        json={"visitor_id": "short", "session_id": "session_valid_1"},
    )
    assert res.status_code == 200
    assert res.json() == {"ok": True}

    # Invalid characters (spaces)
    res = client.post(
        "/api/track",
        json={"visitor_id": "visitor valid 1", "session_id": "session_valid_1"},
    )
    assert res.status_code == 200
    assert res.json() == {"ok": True}

    sessions = db.scalars(select(SessionModel)).all()
    assert len(sessions) == 0


def test_track_bot_ua_ignored(client: TestClient, db: Session):
    bot_uas = [
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
        "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; HeadlessChrome/90.0) Safari/537.36",
        "Mozilla/5.0 Chrome/92.0 Lighthouse/8.0",
        "Python-urllib/3.10 spider bot crawler",
    ]

    for ua in bot_uas:
        res = client.post(
            "/api/track",
            json={"visitor_id": "visitor_bot_1", "session_id": "session_bot_1"},
            headers={"User-Agent": ua},
        )
        assert res.status_code == 200
        assert res.json() == {"ok": True}

    assert db.scalars(select(SessionModel)).first() is None


def test_track_beacon_and_body_size(client: TestClient, db: Session):
    # 1. Plain text Content-Type (sendBeacon)
    raw_body = json.dumps(
        {
            "visitor_id": "visitor_beacon_1",
            "session_id": "session_beacon_1",
            "duration_ms": 1200,
            "max_scroll_pct": 20,
        }
    ).encode("utf-8")
    res = client.post(
        "/api/track",
        content=raw_body,
        headers={"Content-Type": "text/plain"},
    )
    assert res.status_code == 200
    assert res.json() == {"ok": True}

    assert db.get(SessionModel, "session_beacon_1") is not None

    # 2. Body larger than 8 KB -> ignored
    big_body = b'{"visitor_id": "' + b"a" * 9000 + b'", "session_id": "session_big_1"}'
    res2 = client.post(
        "/api/track",
        content=big_body,
        headers={"Content-Type": "application/json"},
    )
    assert res2.status_code == 200
    assert res2.json() == {"ok": True}

    assert db.get(SessionModel, "session_big_1") is None


def test_track_is_returning_flag(client: TestClient, db: Session):
    # First session for visitor
    client.post(
        "/api/track",
        json={"visitor_id": "visitor_repeat_1", "session_id": "session_first_1"},
    )
    # Second session for same visitor
    client.post(
        "/api/track",
        json={"visitor_id": "visitor_repeat_1", "session_id": "session_second_1"},
    )
    # Different visitor
    client.post(
        "/api/track",
        json={"visitor_id": "visitor_other_2", "session_id": "session_third_1"},
    )

    s1 = db.get(SessionModel, "session_first_1")
    s2 = db.get(SessionModel, "session_second_1")
    s3 = db.get(SessionModel, "session_third_1")
    assert s1.is_returning is False
    assert s2.is_returning is True
    assert s3.is_returning is False


def test_track_referrer_and_device(client: TestClient, db: Session):
    # Case 1: Same origin -> direct
    client.post(
        "/api/track",
        json={
            "visitor_id": "visitor_dev_1",
            "session_id": "session_dev_1",
            "referrer": "http://localhost:5173/portfolio",
            "device": "invalid_device",
        },
        headers={
            "Origin": "http://localhost:5173",
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)",
        },
    )

    # Case 2: External referrer and tablet device derived from User-Agent
    client.post(
        "/api/track",
        json={
            "visitor_id": "visitor_dev_2",
            "session_id": "session_dev_2",
            "referrer": "https://github.com/soumil/backend",
            "device": "not_a_valid_device",
        },
        headers={
            "Origin": "http://localhost:5173",
            "User-Agent": "Mozilla/5.0 (iPad; CPU OS 13_2 like Mac OS X)",
        },
    )

    s1 = db.get(SessionModel, "session_dev_1")
    assert s1.referrer == "direct"
    assert s1.device == "mobile"

    s2 = db.get(SessionModel, "session_dev_2")
    assert s2.referrer == "github.com"
    assert s2.device == "tablet"


# ── Metrics Endpoint Tests ───────────────────────────────────────────────────

def test_metrics_auth_errors(client: TestClient):
    # No header -> 401
    res = client.get("/api/admin/metrics")
    assert res.status_code == 401
    assert res.json() == {"detail": "Unauthorized"}

    # Invalid format -> 401
    res = client.get("/api/admin/metrics", headers={"Authorization": "Token 12345"})
    assert res.status_code == 401
    assert res.json() == {"detail": "Unauthorized"}

    # Bad token -> 401
    res = client.get(
        "/api/admin/metrics", headers={"Authorization": "Bearer not_a_real_token"}
    )
    assert res.status_code == 401
    assert res.json() == {"detail": "Unauthorized"}


def test_metrics_calculation_hand_built_dataset(
    client: TestClient, auth_headers: dict, db: Session
):
    now_utc = utcnow()

    # In-range sessions (within last 7 days):
    # Session 1: v1, 25s duration, 80% scroll, furthest=projects
    s1 = SessionModel(
        id="session_test_1",
        visitor_id="visitor_test_1",
        started_at=now_utc - timedelta(days=2),
        last_seen_at=now_utc - timedelta(days=2),
        referrer="direct",
        device="desktop",
        is_returning=False,
        duration_ms=25000,
        max_scroll_pct=80,
    )
    s1.section_dwells = [
        SectionDwellModel(session_id="session_test_1", section="hero", dwell_ms=5000),
        SectionDwellModel(session_id="session_test_1", section="about", dwell_ms=10000),
        SectionDwellModel(session_id="session_test_1", section="projects", dwell_ms=15000),
    ]

    # Session 2: v1 (returning=True), 5s duration, 10% scroll (Bounce!), furthest=about
    s2 = SessionModel(
        id="session_test_2",
        visitor_id="visitor_test_1",
        started_at=now_utc - timedelta(days=1),
        last_seen_at=now_utc - timedelta(days=1),
        referrer="google.com",
        device="mobile",
        is_returning=True,
        duration_ms=5000,
        max_scroll_pct=10,
    )
    s2.section_dwells = [
        SectionDwellModel(session_id="session_test_2", section="hero", dwell_ms=3000),
        SectionDwellModel(session_id="session_test_2", section="about", dwell_ms=4000),
    ]

    # Session 3: v2 (new), 12s duration, 50% scroll, furthest=contact, live (< 5 min ago)
    s3 = SessionModel(
        id="session_test_3",
        visitor_id="visitor_test_2",
        started_at=now_utc - timedelta(hours=1),
        last_seen_at=now_utc - timedelta(minutes=2),  # live!
        referrer="google.com",
        device="desktop",
        is_returning=False,
        duration_ms=12000,
        max_scroll_pct=50,
    )
    s3.section_dwells = [
        SectionDwellModel(session_id="session_test_3", section="hero", dwell_ms=4000),
        SectionDwellModel(session_id="session_test_3", section="contact", dwell_ms=8000),
    ]

    # Session 4: v3 (outside range: previous period ~ 10 days ago)
    s4 = SessionModel(
        id="session_test_4",
        visitor_id="visitor_test_3",
        started_at=now_utc - timedelta(days=10),
        last_seen_at=now_utc - timedelta(days=10),
        referrer="direct",
        device="tablet",
        is_returning=False,
        duration_ms=15000,
        max_scroll_pct=70,
    )

    db.add_all([s1, s2, s3, s4])
    db.commit()

    res = client.get(
        "/api/admin/metrics?days=7&tz=0",
        headers=auth_headers,
    )
    assert res.status_code == 200
    data = res.json()

    # 1. High-level structure
    assert data["range_days"] == 7
    assert data["live"] == 1

    # 2. Totals
    assert data["totals"]["visitors"] == 2
    assert data["totals"]["sessions"] == 3
    assert data["totals"]["avg_duration_s"] == 14.0
    assert data["totals"]["bounce_rate"] == 0.33
    assert data["totals"]["returning_visitor_rate"] == 0.5
    assert data["totals"]["avg_scroll_pct"] == 46.7

    # 3. Prev Totals
    assert data["prev_totals"]["sessions"] == 1
    assert data["prev_totals"]["visitors"] == 1
    assert data["prev_totals"]["avg_duration_s"] == 15.0
    assert data["prev_totals"]["bounce_rate"] == 0.0

    # 4. Daily: zero-filled length == days
    daily = data["daily"]
    assert len(daily) == 7
    total_daily_sessions = sum(d["sessions"] for d in daily)
    assert total_daily_sessions == 3

    # 5. Sections
    sec_dict = {s["name"]: s for s in data["sections"]}
    assert [s["name"] for s in data["sections"]] == SECTIONS

    assert sec_dict["hero"]["reached"] == 3
    assert sec_dict["hero"]["reached_pct"] == 100.0
    assert sec_dict["hero"]["avg_dwell_s"] == 4.0
    assert sec_dict["hero"]["exit_pct"] == 0.0

    assert sec_dict["about"]["reached"] == 2
    assert sec_dict["about"]["reached_pct"] == 66.7
    assert sec_dict["about"]["avg_dwell_s"] == 7.0
    assert sec_dict["about"]["exit_pct"] == 33.3

    assert sec_dict["projects"]["reached"] == 1
    assert sec_dict["projects"]["reached_pct"] == 33.3
    assert sec_dict["projects"]["avg_dwell_s"] == 15.0
    assert sec_dict["projects"]["exit_pct"] == 33.3

    assert sec_dict["experience"]["reached"] == 0
    assert sec_dict["experience"]["reached_pct"] == 0.0
    assert sec_dict["experience"]["avg_dwell_s"] == 0.0
    assert sec_dict["experience"]["exit_pct"] == 0.0

    assert sec_dict["contact"]["reached"] == 1
    assert sec_dict["contact"]["reached_pct"] == 33.3
    assert sec_dict["contact"]["avg_dwell_s"] == 8.0
    assert sec_dict["contact"]["exit_pct"] == 33.3

    # 6. Best section EXCLUDES hero
    assert data["best_section"] == "projects"

    # 7. Visitor mix, devices, referrers
    assert data["visitor_mix"] == {"new": 1, "returning": 1}
    assert data["devices"] == {"desktop": 2, "mobile": 1, "tablet": 0}

    referrers = data["referrers"]
    assert len(referrers) == 2
    assert referrers[0] == {"source": "google.com", "sessions": 2}
    assert referrers[1] == {"source": "direct", "sessions": 1}


def test_metrics_empty_database(client: TestClient, auth_headers: dict):
    res = client.get("/api/admin/metrics?days=7&tz=0", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["range_days"] == 7
    assert data["live"] == 0
    assert data["totals"]["sessions"] == 0
    assert data["totals"]["visitors"] == 0
    assert data["totals"]["avg_duration_s"] == 0.0
    assert data["totals"]["bounce_rate"] == 0.0
    assert data["totals"]["returning_visitor_rate"] == 0.0
    assert data["totals"]["avg_scroll_pct"] == 0.0
    assert data["prev_totals"]["sessions"] == 0
    assert len(data["daily"]) == 7
    assert all(d["sessions"] == 0 and d["visitors"] == 0 for d in data["daily"])
    assert data["best_section"] is None
    assert data["devices"] == {"desktop": 0, "mobile": 0, "tablet": 0}
    assert data["referrers"] == []
    assert data["visitor_mix"] == {"new": 0, "returning": 0}


# ── Client IP & Chat History ─────────────────────────────────────────────────

def test_lockout_cannot_be_dodged_by_spoofing_forwarded_for(client: TestClient):
    # Proxy appends real IP last; changing the first entry must not reset the counter
    for i in range(10):
        res = client.post(
            "/api/admin/auth/login",
            json={"identifier": "admin@example.com", "password": "wrong"},
            headers={"X-Forwarded-For": f"1.2.3.{i}, 9.9.9.9"},
        )
        assert res.status_code in (401, 423)

    # 11th attempt from same real IP is blocked by IP limiter -> 429
    res = client.post(
        "/api/admin/auth/login",
        json={"identifier": "admin@example.com", "password": "wrong"},
        headers={"X-Forwarded-For": "7.7.7.7, 9.9.9.9"},
    )
    assert res.status_code == 429


def test_chat_turns_are_stored_and_listed(client: TestClient, auth_headers: dict):
    cid = chat_log.new_conversation_id()
    assert chat_log.log_chat_turn(cid, "visitor12345", "What do you build?", "AI agents.") == cid
    assert chat_log.log_chat_turn(cid, "visitor12345", "Which stack?", "FastAPI and PostgreSQL.") == cid
    # a second, unrelated conversation; bad ids are replaced instead of crashing
    other = chat_log.log_chat_turn("bad id!", None, "hi", "hello")
    assert other and other != cid

    listing = client.get("/api/admin/conversations", headers=auth_headers).json()
    assert listing["total"] == 2
    mine = next(c for c in listing["items"] if c["id"] == cid)
    assert mine["messages"] == 4
    assert mine["preview"] == "What do you build?"

    detail = client.get(f"/api/admin/conversations/{cid}", headers=auth_headers).json()
    assert [m["role"] for m in detail["messages"]] == ["user", "assistant", "user", "assistant"]
    assert detail["messages"][3]["content"] == "FastAPI and PostgreSQL."

    assert client.get("/api/admin/conversations/does-not-exist", headers=auth_headers).status_code == 404
    assert client.get("/api/admin/conversations").status_code == 401


def test_chat_logging_never_raises(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite:////nonexistent-dir/x.db")
    assert chat_log.log_chat_turn(None, None, "q", "a") is None


def test_config_environment_loading(monkeypatch):
    monkeypatch.setenv("FRONTEND_URLS", "https://soumil.dev, https://preview.soumil.dev")
    monkeypatch.setenv("DATABASE_URL", "postgres://user:pass@host:5432/db")

    settings = Settings()
    assert settings.frontend_origins == ["https://soumil.dev", "https://preview.soumil.dev"]
    assert settings.normalized_database_url == "postgresql+psycopg://user:pass@host:5432/db"
