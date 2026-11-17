"""Admin inbox."""
from app.models.inbox import ContactMessage
from app.utils.time import utcnow


def _msg(db, subject, read=False):
    m = ContactMessage(email="a@example.com", subject=subject, body="hi", created_at=utcnow(),
                       read_at=utcnow() if read else None)
    db.add(m)
    db.commit()
    return m


def test_list_filter_update_delete(client, auth_headers, db):
    a, b = _msg(db, "first"), _msg(db, "second", read=True)
    page = client.get("/api/admin/inbox", headers=auth_headers).json()
    assert page["total"] == 2 and page["unread"] == 1
    unread = client.get("/api/admin/inbox?unread=true", headers=auth_headers).json()
    assert [i["subject"] for i in unread["items"]] == ["first"]

    body = client.patch(f"/api/admin/inbox/{a.id}", json={"read": True}, headers=auth_headers).json()
    assert body["read"] is True
    assert client.get("/api/admin/inbox", headers=auth_headers).json()["unread"] == 0
    assert client.patch(f"/api/admin/inbox/{a.id}", json={"read": False}, headers=auth_headers).json()["read"] is False

    assert client.delete(f"/api/admin/inbox/{b.id}", headers=auth_headers).status_code == 204
    assert client.delete(f"/api/admin/inbox/{b.id}", headers=auth_headers).status_code == 404
    assert client.get("/api/admin/inbox").status_code == 401
