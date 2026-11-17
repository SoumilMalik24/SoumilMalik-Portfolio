"""Public contact form."""
import pytest

from app.models.inbox import ContactMessage
from app.services import inbox as inbox_service

FORM = {"name": "Ada", "email": "ada@example.com", "subject": "Hello\r\nBcc: x@y.z", "message": "Let's talk."}


@pytest.fixture
def sent(monkeypatch):
    mails = []
    monkeypatch.setattr(inbox_service, "send_email", lambda *a, **k: mails.append((a, k)))
    return mails


def test_stores_and_notifies_first_admin(client, db, test_admin, sent):
    resp = client.post("/api/contact", json=FORM)
    assert resp.status_code == 200 and resp.json() == {"status": "Message sent successfully"}
    msg = db.query(ContactMessage).one()
    assert msg.email == "ada@example.com" and msg.read_at is None and len(msg.ip_hash) == 64
    (to, subject, _text, _html), kwargs = sent[0]
    assert to == test_admin.email and kwargs["reply_to"] == "ada@example.com"
    assert "\n" not in subject and "\r" not in subject


def test_notify_email_override(client, monkeypatch, test_admin, sent):
    monkeypatch.setenv("ADMIN_NOTIFY_EMAIL", "inbox@example.com")
    from app.config import get_settings
    get_settings.cache_clear()
    client.post("/api/contact", json=FORM)
    assert sent[0][0][0] == "inbox@example.com"


def test_honeypot(client, db, sent):
    assert client.post("/api/contact", json={**FORM, "website": "http://spam"}).status_code == 200
    assert db.query(ContactMessage).count() == 0 and sent == []


def test_rate_limit(client, sent):
    for _ in range(3):
        assert client.post("/api/contact", json=FORM).status_code == 200
    resp = client.post("/api/contact", json=FORM)
    assert resp.status_code == 429 and "Retry-After" in resp.headers


def test_mail_failure_still_ok(client, db, test_admin, monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("smtp down")
    monkeypatch.setattr(inbox_service, "send_email", boom)
    assert client.post("/api/contact", json=FORM).status_code == 200
    assert db.query(ContactMessage).count() == 1


def test_validation(client):
    assert client.post("/api/contact", json={**FORM, "email": "nope"}).status_code == 422
    assert client.post("/api/contact", json={**FORM, "message": ""}).status_code == 422
