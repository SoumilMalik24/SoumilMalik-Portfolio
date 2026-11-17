"""Content draft editing: validation, id assignment, optimistic locking, discard."""
import copy

from sqlalchemy import select

from app.constants import CONTENT_KEYS
from app.models.admin import AuditLog
from app.models.content import Asset
from app.utils.time import utcnow


def _fields(resp):
    return [e["field"] for e in resp.json().get("errors", [])]


def test_list_all_sections_when_empty(client, auth_headers):
    resp = client.get("/api/admin/content", headers=auth_headers)
    assert resp.status_code == 200
    sections = resp.json()["sections"]
    assert list(sections) == CONTENT_KEYS
    assert all(s["version"] == 0 and s["draft"] is None and s["dirty"] is False for s in sections.values())


def test_requires_auth(client):
    assert client.get("/api/admin/content").status_code == 401
    assert client.put("/api/admin/content/profile", json={"data": {}, "version": 0}).status_code == 401


def test_unknown_key_404(client, auth_headers):
    assert client.get("/api/admin/content/nope", headers=auth_headers).status_code == 404
    resp = client.put("/api/admin/content/nope", json={"data": {}, "version": 0}, headers=auth_headers)
    assert resp.status_code == 404


def test_create_and_update_with_versions(client, auth_headers, seed_sections, db):
    resp = client.put("/api/admin/content/profile", json={"data": seed_sections["profile"], "version": 0},
                      headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["version"] == 1 and body["dirty"] is True and body["published"] is None

    changed = dict(seed_sections["profile"], role="Senior AI Engineer")
    resp = client.put("/api/admin/content/profile", json={"data": changed, "version": 1}, headers=auth_headers)
    assert resp.status_code == 200 and resp.json()["version"] == 2
    assert resp.json()["draft"]["role"] == "Senior AI Engineer"

    stale = client.put("/api/admin/content/profile", json={"data": changed, "version": 1}, headers=auth_headers)
    assert stale.status_code == 409
    assert stale.json() == {"detail": "Section was changed elsewhere", "current_version": 2}

    actions = db.scalars(select(AuditLog.action).where(AuditLog.target == "content:profile")).all()
    assert actions.count("content.save") == 2


def test_missing_row_requires_version_zero(client, auth_headers, seed_sections):
    resp = client.put("/api/admin/content/about", json={"data": seed_sections["about"], "version": 3},
                      headers=auth_headers)
    assert resp.status_code == 409 and resp.json()["current_version"] == 0


def test_ids_are_assigned_and_deduplicated(save_section, seed_sections):
    items = [
        {k: v for k, v in item.items() if k != "id"} for item in seed_sections["projects"]["items"][:2]
    ]
    items[1]["name"] = items[0]["name"]
    items.append(dict(items[0], name="!!!"))
    resp = save_section("projects", {"items": items})
    assert resp.status_code == 200, resp.json()
    ids = [i["id"] for i in resp.json()["draft"]["items"]]
    assert ids[0] == "researchsynth" and ids[1] == "researchsynth-2"
    assert len(ids[2]) == 8 and ids[2].isalnum()


def test_duplicate_explicit_ids_rejected(save_section, seed_sections):
    items = copy.deepcopy(seed_sections["projects"]["items"][:2])
    items[1]["id"] = items[0]["id"]
    resp = save_section("projects", {"items": items})
    assert resp.status_code == 422
    assert "Duplicate id" in resp.json()["errors"][0]["msg"]


def test_unknown_field_rejected_with_path(save_section, seed_sections):
    data = copy.deepcopy(seed_sections["projects"])
    data["items"][1]["colour"] = "red"
    resp = save_section("projects", data)
    assert resp.status_code == 422
    assert "items.1.colour" in _fields(resp)


def test_http_url_rejected(save_section, seed_sections):
    data = copy.deepcopy(seed_sections["projects"])
    data["items"][0]["github"] = "http://github.com/x"
    resp = save_section("projects", data)
    assert resp.status_code == 422 and "items.0.github" in _fields(resp)


def test_markup_line_rejects_html(save_section, seed_sections):
    data = copy.deepcopy(seed_sections["kirby"])
    data["tour"]["hero"]["lines"][0] = "<script>alert(1)</script>"
    resp = save_section("kirby", data)
    assert resp.status_code == 422 and "tour.hero.lines.0" in _fields(resp)


def test_kirby_tour_requires_every_section(save_section, seed_sections):
    data = copy.deepcopy(seed_sections["kirby"])
    del data["tour"]["contact"]
    resp = save_section("kirby", data)
    assert resp.status_code == 422 and "tour.contact" in _fields(resp)


def test_featured_skills_must_be_in_pills(save_section, seed_sections):
    data = copy.deepcopy(seed_sections["skills"])
    data["groups"][0]["featured"] = ["Rust"]
    resp = save_section("skills", data)
    assert resp.status_code == 422
    assert "Rust" in resp.json()["errors"][0]["msg"]


def test_section_too_large(save_section, seed_sections):
    data = copy.deepcopy(seed_sections["knowledge"])
    data["notes"] = [{"title": f"n{i}", "text": "x" * 4000} for i in range(20)]
    resp = save_section("knowledge", data)
    assert resp.status_code == 422 and resp.json()["detail"] == "Section too large"


def _asset(db, kind):
    asset = Asset(id=f"asset-{kind}", kind=kind, url=f"http://testserver/media/{kind}/a", storage_id=f"{kind}/a",
                  mime="image/png" if kind == "image" else "application/pdf", bytes=10, original_name="a",
                  created_at=utcnow())
    db.add(asset)
    db.commit()
    return asset


def test_asset_references_checked(save_section, seed_sections, db):
    data = dict(seed_sections["profile"], portrait_asset_id="missing")
    resp = save_section("profile", data)
    assert resp.status_code == 422
    assert resp.json()["errors"] == [{"field": "portrait_asset_id", "msg": "Asset not found"}]

    resume = _asset(db, "resume")
    resp = save_section("profile", dict(seed_sections["profile"], portrait_asset_id=resume.id))
    assert resp.status_code == 422 and resp.json()["errors"][0]["msg"] == "Asset must be an image"

    image = _asset(db, "image")
    projects = copy.deepcopy(seed_sections["projects"])
    projects["items"][2]["image_asset_id"] = resume.id
    resp = save_section("projects", projects)
    assert resp.status_code == 422 and _fields(resp) == ["items.2.image_asset_id"]
    projects["items"][2]["image_asset_id"] = image.id
    assert save_section("projects", projects).status_code == 200


def test_discard(client, auth_headers, save_section, seed_sections):
    save_section("about", seed_sections["about"])
    resp = client.post("/api/admin/content/about/discard", headers=auth_headers)
    assert resp.status_code == 409 and resp.json()["detail"] == "Nothing published yet"

    assert client.post("/api/admin/publish", json={"sections": ["about"]}, headers=auth_headers).status_code == 202
    edited = copy.deepcopy(seed_sections["about"])
    edited["paragraphs"] = ["Changed."]
    assert save_section("about", edited).json()["dirty"] is True

    resp = client.post("/api/admin/content/about/discard", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["dirty"] is False and body["draft"] == body["published"]
    assert body["draft"]["paragraphs"] == seed_sections["about"]["paragraphs"]
