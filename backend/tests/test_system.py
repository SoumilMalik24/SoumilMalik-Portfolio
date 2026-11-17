"""Admin system overview and Kirby readiness in /api/status."""
from app.cli import main as cli_main
from app.config import get_settings
from app.services.kb import index as kb_index
from tests.conftest import SEED_FILE


def test_system_shape(client, auth_headers):
    body = client.get("/api/admin/system", headers=auth_headers).json()
    assert set(body) == {"booted_at", "uptime_s", "version", "python", "db", "kirby", "storage",
                         "last_publish", "maintenance", "counts"}
    assert body["db"] == {"ok": True, "dialect": "sqlite"}
    assert body["storage"] == {"backend": "local", "assets": 0, "bytes": 0}
    assert body["kirby"]["state"] == "off" and body["last_publish"] is None
    assert set(body["counts"]) == {"conversations", "messages", "analytics_sessions", "inbox_unread"}
    assert client.get("/api/admin/system").status_code == 401


def test_status_kirby_states(client, monkeypatch, db):
    assert client.get("/api/status").json()["kirby"] == "off"
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-test")
    get_settings.cache_clear()
    assert client.get("/api/status").json()["kirby"] == "loading"

    cli_main(["seed-content", "--file", str(SEED_FILE)])
    kb_index.reindex(db)
    kb_index.cache.clear()
    kb_index.warm_up()
    assert client.get("/api/status").json()["kirby"] == "ready"

    monkeypatch.setenv("KIRBY_ENABLED", "false")
    get_settings.cache_clear()
    assert client.get("/api/status").json()["kirby"] == "off"


def test_warm_up_error(monkeypatch, client):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-test")
    get_settings.cache_clear()

    def broken(db):
        raise RuntimeError("db unreachable")
    monkeypatch.setattr(kb_index, "load_cache", broken)
    kb_index.warm_up()
    assert client.get("/api/status").json()["kirby"] == "error"
