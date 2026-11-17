"""Export / import of content."""
import copy

from sqlalchemy import select

from app.models.content import ContentRevision


def _export(client, headers):
    resp = client.get("/api/admin/export", headers=headers)
    assert resp.status_code == 200
    return resp


def test_export_shape(client, auth_headers, save_section, seed_sections):
    save_section("about", seed_sections["about"])
    client.post("/api/admin/publish", headers=auth_headers)
    resp = _export(client, auth_headers)
    assert resp.headers["content-disposition"].startswith('attachment; filename="portfolio-export-')
    body = resp.json()
    assert body["format"] == "portfolio-export" and body["schema_version"] == 1
    assert body["sections"]["about"]["draft"] == body["sections"]["about"]["published"]
    assert body["assets"] == []


def test_import_dry_run_then_apply(client, auth_headers, save_section, seed_sections, db):
    save_section("about", seed_sections["about"])
    client.post("/api/admin/publish", headers=auth_headers)
    doc = _export(client, auth_headers).json()
    doc["sections"]["about"]["draft"]["paragraphs"] = ["Imported paragraph."]
    doc["sections"]["seo"] = {"draft": seed_sections["seo"], "published": None}

    dry = client.post("/api/admin/import?dry_run=true", json=doc, headers=auth_headers)
    assert dry.status_code == 200
    assert dry.json() == {"dry_run": True, "errors": [],
                          "changes": [{"section": "about", "changed": True}, {"section": "seo", "changed": True}]}
    assert client.get("/api/admin/content/about", headers=auth_headers).json()["dirty"] is False

    before = client.get("/api/admin/content/about", headers=auth_headers).json()
    applied = client.post("/api/admin/import?dry_run=false", json=doc, headers=auth_headers)
    assert applied.status_code == 200 and applied.json()["dry_run"] is False
    after = client.get("/api/admin/content/about", headers=auth_headers).json()
    assert after["draft"]["paragraphs"] == ["Imported paragraph."]
    assert after["published"] == before["published"]
    assert after["version"] == before["version"] + 1
    seo = client.get("/api/admin/content/seo", headers=auth_headers).json()
    assert seo["published"] is None and seo["version"] == 1
    kinds = db.scalars(select(ContentRevision.kind).where(ContentRevision.section_key == "about")).all()
    assert "import" in kinds


def test_import_errors(client, auth_headers, seed_sections):
    bad = {"format": "portfolio-export", "schema_version": 1,
           "sections": {"profile": {"draft": dict(seed_sections["profile"], name="")}, "bogus": {"draft": {}}}}
    dry = client.post("/api/admin/import", json=bad, headers=auth_headers)
    assert dry.status_code == 200
    fields = [e["field"] for e in dry.json()["errors"]]
    assert "sections.profile.name" in fields and "sections.bogus" in fields

    real = client.post("/api/admin/import?dry_run=false", json=bad, headers=auth_headers)
    assert real.status_code == 422 and real.json()["detail"] == "Validation failed"
    assert client.get("/api/admin/content/profile", headers=auth_headers).json()["version"] == 0

    wrong_format = client.post("/api/admin/import", json={"format": "x"}, headers=auth_headers)
    assert wrong_format.status_code == 422
    not_json = client.post("/api/admin/import", content=b"{oops", headers=auth_headers)
    assert not_json.status_code == 422
