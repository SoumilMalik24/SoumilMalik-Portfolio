"""GET /api/content: published-only, hidden items stripped, assets resolved, ETag caching."""
import copy

from app.models.content import Asset
from app.utils.time import utcnow


def _publish(client, auth_headers, sections=None):
    resp = client.post("/api/admin/publish", json={"sections": sections} if sections else None, headers=auth_headers)
    assert resp.status_code == 202, resp.json()
    return resp.json()


def test_empty_when_nothing_published(client, save_section, seed_sections):
    save_section("profile", seed_sections["profile"])
    body = client.get("/api/content").json()
    assert body == {"version": 0, "published_at": None, "sections": {}}


def test_published_only_and_transformed(client, auth_headers, save_section, seed_sections, db):
    for asset_id, kind in (("img-1", "image"), ("cv-1", "resume")):
        db.add(Asset(id=asset_id, kind=kind, url=f"https://cdn.example/{asset_id}", storage_id=asset_id,
                     mime="image/png" if kind == "image" else "application/pdf", bytes=1,
                     width=640 if kind == "image" else None, height=480 if kind == "image" else None,
                     original_name=asset_id, created_at=utcnow()))
    db.commit()

    data = copy.deepcopy(seed_sections)
    data["projects"]["items"][0]["image_asset_id"] = "img-1"
    data["projects"]["items"][1]["hidden"] = True
    data["experience"]["items"][0]["hidden"] = True
    data["contact"]["resume_asset_id"] = "cv-1"
    data["profile"]["portrait_asset_id"] = "img-1"
    for key, section in data.items():
        assert save_section(key, section).status_code == 200
    _publish(client, auth_headers)

    # A later unpublished draft edit must not leak.
    save_section("profile", dict(data["profile"], name="Draft Name"))

    body = client.get("/api/content").json()
    s = body["sections"]
    assert list(s) == ["profile", "about", "projects", "experience", "skills", "contact", "seo", "kirby"]
    assert "knowledge" not in s
    assert s["profile"]["name"] == "Soumil Malik"
    assert s["profile"]["portrait"] == {"url": "https://cdn.example/img-1", "width": 640, "height": 480}
    assert "portrait_asset_id" not in s["profile"]

    names = [p["name"] for p in s["projects"]["items"]]
    assert names == ["ResearchSynth", "CodeLens"]
    assert all("hidden" not in p and "image_asset_id" not in p for p in s["projects"]["items"])
    assert s["projects"]["items"][0]["image"]["url"] == "https://cdn.example/img-1"
    assert s["projects"]["items"][1]["image"] is None

    assert [e["id"] for e in s["experience"]["items"]] == ["regalrinse", "wobot"]
    assert all("hidden" not in e for e in s["experience"]["items"])
    assert s["contact"]["resume_url"] == "https://cdn.example/cv-1" and "resume_asset_id" not in s["contact"]
    assert s["seo"]["og_image"] is None
    assert set(s["kirby"]) == {"enabled", "display_name", "tour"}


def test_etag_and_version(client, auth_headers, save_section, seed_sections):
    save_section("seo", seed_sections["seo"])
    v1 = _publish(client, auth_headers)["id"]
    resp = client.get("/api/content")
    assert resp.headers["etag"] == f'W/"v{v1}"' and resp.headers["cache-control"] == "no-cache"
    assert resp.json()["version"] == v1

    again = client.get("/api/content", headers={"If-None-Match": resp.headers["etag"]})
    assert again.status_code == 304

    save_section("seo", dict(seed_sections["seo"], title="New title"))
    v2 = _publish(client, auth_headers)["id"]
    fresh = client.get("/api/content", headers={"If-None-Match": resp.headers["etag"]})
    assert fresh.status_code == 200
    assert fresh.json()["version"] == v2 and fresh.json()["sections"]["seo"]["title"] == "New title"
