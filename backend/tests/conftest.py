"""Shared pytest fixtures for the portfolio backend test suite."""
import json
from pathlib import Path

from typing import Generator
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings
from app.db import _engines, _session_factories, get_engine
from app.main import create_app
from app.models.admin import Admin
from app.models.base import Base
from app.services import tracking
from app.routers.public.agent import kirby_limiter
from app.routers.public.contact import contact_limiter
from app.services.kb import index as kb_index
from app.services.public_content import clear_cache as clear_public_cache
from app.services.auth.passwords import hash_password
from app.services.auth.sessions import create_session
from app.utils.ratelimit import (
    forgot_pw_email_limiter,
    forgot_pw_ip_limiter,
    login_ip_failure_limiter,
    track_throttle_limiter,
)
from app.utils.time import utcnow


@pytest.fixture(autouse=True)
def setup_test_environment(tmp_path, monkeypatch):
    """Isolate environment, database, and clear all in-memory caches and rate limiters."""
    db_file = tmp_path / "test_portfolio.db"
    db_url = f"sqlite:///{db_file}"

    monkeypatch.setenv("DATABASE_URL", db_url)
    monkeypatch.setenv("ENV", "development")
    monkeypatch.setenv("SECRET_KEY", "test-secret-salt-key-1234567890")
    monkeypatch.setenv("EMAIL_USER", "")
    monkeypatch.setenv("EMAIL_PASS", "")
    monkeypatch.setenv("STORAGE_BACKEND", "local")
    monkeypatch.setenv("MEDIA_DIR", str(tmp_path / "media"))
    monkeypatch.setenv("PUBLIC_API_URL", "http://testserver")
    monkeypatch.setenv("VERCEL_DEPLOY_HOOK_URL", "")
    monkeypatch.setenv("VERCEL_TOKEN", "")
    monkeypatch.setenv("VERCEL_PROJECT_ID", "")
    monkeypatch.setenv("CLOUDINARY_URL", "")
    monkeypatch.setenv("BACKGROUND_TASKS", "false")
    monkeypatch.setenv("EMBEDDINGS_PROVIDER", "fake")
    monkeypatch.setenv("KIRBY_ENABLED", "true")
    monkeypatch.setenv("OPENROUTER_API_KEY", "")
    monkeypatch.setenv("ADMIN_NOTIFY_EMAIL", "")
    clear_public_cache()
    kb_index.cache.clear()
    kb_index.warm_state.update(state="loading", error=None)
    kirby_limiter.clear()
    contact_limiter.clear()

    # Speed up scrypt hashing in tests using ln=10
    monkeypatch.setattr("app.services.auth.passwords.SCRYPT_LN", 10)
    fast_dummy = hash_password("test-fast-dummy-credential-salt")
    monkeypatch.setattr("app.services.auth.passwords.DUMMY_HASH", fast_dummy)

    # Clear settings LRU cache
    get_settings.cache_clear()

    # Clear engine caches and initialize schema
    _engines.clear()
    _session_factories.clear()
    engine = get_engine(db_url)
    Base.metadata.create_all(bind=engine)

    # Reset rate limiters
    login_ip_failure_limiter.clear()
    forgot_pw_ip_limiter.clear()
    forgot_pw_email_limiter.clear()
    track_throttle_limiter.clear()
    with tracking._track_throttle_lock:
        tracking._track_ip_history.clear()

    yield engine

    Base.metadata.drop_all(bind=engine)
    _engines.clear()
    _session_factories.clear()
    get_settings.cache_clear()


@pytest.fixture
def db(setup_test_environment) -> Generator[Session, None, None]:
    """Provide a direct database session for testing."""
    engine = setup_test_environment
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    with session_factory() as session:
        yield session


@pytest.fixture
def client(setup_test_environment) -> TestClient:
    """FastAPI TestClient instance."""
    app = create_app()
    return TestClient(app)


@pytest.fixture
def admin_password() -> str:
    return "StrongAdminPass123!"


@pytest.fixture
def test_admin(db: Session, admin_password: str) -> Admin:
    """Create and persist a default test admin."""
    now = utcnow()
    admin = Admin(
        email="admin@example.com",
        phone="+919876543210",
        display_name="Test Admin",
        password_hash=hash_password(admin_password),
        is_active=True,
        failed_logins=0,
        password_changed_at=now,
        created_at=now,
        updated_at=now,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin


@pytest.fixture
def admin_token(db: Session, test_admin: Admin) -> str:
    """Generate and persist an active session token for the test admin."""
    token, _ = create_session(db, admin_id=test_admin.id, ip="127.0.0.1", user_agent="pytest")
    return token


@pytest.fixture
def auth_headers(admin_token: str) -> dict:
    """Authorization header dictionary for authenticated admin requests."""
    return {"Authorization": f"Bearer {admin_token}"}


SEED_FILE = Path(__file__).resolve().parent.parent / "seed" / "content.seed.json"


@pytest.fixture
def seed_sections() -> dict:
    """Fresh copy of the real seed content, keyed by section."""
    return json.loads(SEED_FILE.read_text(encoding="utf-8"))["sections"]


@pytest.fixture
def save_section(client: TestClient, auth_headers: dict):
    """Save a draft through the API with the current version; returns the response."""
    def _save(key: str, data: dict):
        version = client.get(f"/api/admin/content/{key}", headers=auth_headers).json()["version"]
        return client.put(f"/api/admin/content/{key}", json={"data": data, "version": version}, headers=auth_headers)
    return _save

