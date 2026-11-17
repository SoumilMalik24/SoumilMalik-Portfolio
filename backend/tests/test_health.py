"""Tests for health, root, and system runtime status endpoints."""
from app.constants import APP_VERSION
from unittest.mock import patch
from fastapi.testclient import TestClient


def test_root_endpoint(client: TestClient):
    """GET / returns running message."""
    res = client.get("/")
    assert res.status_code == 200
    assert res.json() == {"status": "Portfolio API is running"}


def test_health_endpoint_no_db_work(client: TestClient):
    """GET /health returns 200 {"status": "ok"} without touching the database."""
    with patch("app.routers.public.health.get_db") as mock_db:
        res = client.get("/health")
        assert res.status_code == 200
        assert res.json() == {"status": "ok"}
        assert not mock_db.called


def test_status_endpoint_shape_and_values(client: TestClient):
    """GET /api/status returns correct schema with db 'ok' and kirby 'off'."""
    res = client.get("/api/status")
    assert res.status_code == 200
    data = res.json()
    assert "booted_at" in data
    assert data["booted_at"].endswith("Z")
    assert isinstance(data["uptime_s"], (int, float))
    assert data["version"] == APP_VERSION
    assert data["db"] == "ok"
    assert data["kirby"] == "off"


def test_status_endpoint_db_down(client: TestClient):
    """GET /api/status reports db 'down' when the database check fails."""
    with patch("sqlalchemy.orm.Session.execute", side_effect=Exception("DB connection dropped")):
        res = client.get("/api/status")
        assert res.status_code == 200
        data = res.json()
        assert data["db"] == "down"
        assert data["kirby"] == "off"
