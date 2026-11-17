"""Publishing, post-publish job (re-index placeholder + deploy hook), revisions."""
import copy

import pytest
import requests
from sqlalchemy import func, select

from app.models.content import ContentRevision
from app.services import publish as publish_service


class FakeResp:
    def __init__(self, status=200, payload=None):
        self.status_code = status
        self._payload = payload or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"{self.status_code} error")

    def json(self):
        return self._payload


@pytest.fixture
def drafts(save_section, seed_sections):
    for key, data in seed_sections.items():
        assert save_section(key, data).status_code == 200
    return seed_sections


def _publish(client, auth_headers, sections=None):
    body = {"sections": sections} if sections is not None else None
    return client.post("/api/admin/publish", json=body, headers=auth_headers)


def test_nothing_to_publish(client, auth_headers):
    resp = _publish(client, auth_headers)
    assert resp.status_code == 409 and resp.json()["detail"] == "Nothing to publish"


def test_publish_all_dirty(client, auth_headers, drafts):
    resp = _publish(client, auth_headers)
    assert resp.status_code == 202
    body = resp.json()
    assert body["sections"] == list(drafts)
    assert body["deploy_status"] == "disabled"

    final = client.get(f"/api/admin/publishes/{body['id']}", headers=auth_headers).json()
    assert final["reindex_status"] == "done" and final["finished_at"] is not None

    sections = client.get("/api/admin/content", headers=auth_headers).json()["sections"]
    assert all(not s["dirty"] and s["published"] == s["draft"] for s in sections.values())
    assert _publish(client, auth_headers).status_code == 409


def test_publish_subset_and_unknown_key(client, auth_headers, drafts):
    resp = _publish(client, auth_headers, ["seo"])
    assert resp.status_code == 202
    assert resp.json()["sections"] == ["seo"] and resp.json()["reindex_status"] == "skipped"
    states = client.get("/api/admin/content", headers=auth_headers).json()["sections"]
    assert states["seo"]["dirty"] is False and states["profile"]["dirty"] is True

    resp = _publish(client, auth_headers, ["profile", "bogus"])
    assert resp.status_code == 422


def test_kb_sections_start_pending(client, auth_headers, drafts, monkeypatch):
    seen = []
    monkeypatch.setattr(publish_service, "run_reindex_for_publish",
                        lambda db, pub: seen.append(pub.reindex_status) or setattr(pub, "reindex_status", "done"))
    resp = _publish(client, auth_headers, ["profile"])
    assert resp.json()["reindex_status"] == "pending"
    assert seen == ["running"]
    final = client.get(f"/api/admin/publishes/{resp.json()['id']}", headers=auth_headers).json()
    assert final["reindex_status"] == "done"


def test_revisions_created_and_pruned(client, auth_headers, drafts, save_section, db, monkeypatch):
    monkeypatch.setattr(publish_service, "MAX_REVISIONS_PER_SECTION", 3)
    for i in range(5):
        data = copy.deepcopy(drafts["seo"])
        data["title"] = f"Title {i}"
        save_section("seo", data)
        assert _publish(client, auth_headers, ["seo"]).status_code == 202
    count = db.scalar(select(func.count(ContentRevision.id)).where(ContentRevision.section_key == "seo"))
    assert count == 3

    revs = client.get("/api/admin/revisions?section=seo", headers=auth_headers).json()
    assert revs["total"] == 3 and "data" not in revs["items"][0]
    newest = client.get(f"/api/admin/revisions/{revs['items'][0]['id']}", headers=auth_headers).json()
    assert newest["data"]["title"] == "Title 4"


def test_restore_revision(client, auth_headers, drafts, save_section):
    _publish(client, auth_headers, ["seo"])
    first_rev = client.get("/api/admin/revisions?section=seo", headers=auth_headers).json()["items"][0]["id"]
    save_section("seo", dict(drafts["seo"], title="Newer"))
    _publish(client, auth_headers, ["seo"])

    before = client.get("/api/admin/content/seo", headers=auth_headers).json()
    resp = client.post(f"/api/admin/revisions/{first_rev}/restore", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["draft"]["title"] == drafts["seo"]["title"]
    assert body["published"]["title"] == "Newer"
    assert body["version"] == before["version"] + 1 and body["dirty"] is True
    assert client.post("/api/admin/revisions/99999/restore", headers=auth_headers).status_code == 404


def test_deploy_hook_triggered(client, auth_headers, drafts, monkeypatch):
    monkeypatch.setenv("VERCEL_DEPLOY_HOOK_URL", "https://api.vercel.com/v1/integrations/deploy/x")
    from app.config import get_settings
    get_settings.cache_clear()
    calls = []
    monkeypatch.setattr(requests, "post", lambda url, **kw: calls.append(url) or FakeResp(200, {"job": {"id": "j1"}}))

    resp = _publish(client, auth_headers, ["seo"])
    assert resp.json()["deploy_status"] == "pending"
    final = client.get(f"/api/admin/publishes/{resp.json()['id']}", headers=auth_headers).json()
    assert final["deploy_status"] == "triggered" and final["deploy_ref"] == "j1"
    assert calls == ["https://api.vercel.com/v1/integrations/deploy/x"]


def test_deploy_hook_failure(client, auth_headers, drafts, monkeypatch):
    monkeypatch.setenv("VERCEL_DEPLOY_HOOK_URL", "https://hook.example/x")
    from app.config import get_settings
    get_settings.cache_clear()
    monkeypatch.setattr(requests, "post", lambda url, **kw: FakeResp(500))

    pub_id = _publish(client, auth_headers, ["seo"]).json()["id"]
    final = client.get(f"/api/admin/publishes/{pub_id}", headers=auth_headers).json()
    assert final["deploy_status"] == "failed" and "500" in final["error"]


def test_vercel_polling_reaches_ready(client, auth_headers, drafts, monkeypatch):
    for k, v in {"VERCEL_DEPLOY_HOOK_URL": "https://hook.example/x", "VERCEL_TOKEN": "t",
                 "VERCEL_PROJECT_ID": "p"}.items():
        monkeypatch.setenv(k, v)
    from app.config import get_settings
    get_settings.cache_clear()
    monkeypatch.setattr(publish_service, "POLL_INTERVAL_S", 0)
    states = iter(["BUILDING", "READY"])
    monkeypatch.setattr(requests, "post", lambda url, **kw: FakeResp(200, {"job": {"id": "j2"}}))
    monkeypatch.setattr(requests, "get",
                        lambda url, **kw: FakeResp(200, {"deployments": [{"state": next(states)}]}))

    pub_id = _publish(client, auth_headers, ["seo"]).json()["id"]
    final = client.get(f"/api/admin/publishes/{pub_id}", headers=auth_headers).json()
    assert final["deploy_status"] == "ready"


def test_redeploy(client, auth_headers, drafts, monkeypatch):
    pub_id = _publish(client, auth_headers, ["seo"]).json()["id"]
    resp = client.post(f"/api/admin/publishes/{pub_id}/redeploy", headers=auth_headers)
    assert resp.status_code == 409 and resp.json()["detail"] == "Deploy hook not configured"

    monkeypatch.setenv("VERCEL_DEPLOY_HOOK_URL", "https://hook.example/x")
    from app.config import get_settings
    get_settings.cache_clear()
    monkeypatch.setattr(requests, "post", lambda url, **kw: FakeResp(200, {}))
    resp = client.post(f"/api/admin/publishes/{pub_id}/redeploy", headers=auth_headers)
    assert resp.status_code == 202
    final = client.get(f"/api/admin/publishes/{pub_id}", headers=auth_headers).json()
    assert final["deploy_status"] == "triggered"


def test_publish_history_pagination(client, auth_headers, drafts, save_section):
    _publish(client, auth_headers, ["seo"])
    save_section("seo", dict(drafts["seo"], title="Again"))
    _publish(client, auth_headers, ["seo"])
    page = client.get("/api/admin/publishes?limit=1", headers=auth_headers).json()
    assert page["total"] == 2 and len(page["items"]) == 1
    assert page["items"][0]["id"] > client.get("/api/admin/publishes?limit=1&offset=1",
                                               headers=auth_headers).json()["items"][0]["id"]
    assert client.get("/api/admin/publishes/999", headers=auth_headers).status_code == 404
