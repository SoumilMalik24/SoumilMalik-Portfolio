"""Uploads: type sniffing, size limits, dimensions, storage backends, in-use protection."""
import hashlib
import struct
import zlib
from pathlib import Path

import pytest
import requests

from app.config import get_settings
from app.services.storage import (
    CloudinaryStorage,
    LocalStorage,
    StorageError,
    cloudinary_signature,
    parse_cloudinary_url,
)


def png_bytes(w=3, h=2) -> bytes:
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d))  # noqa: E731
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IEND", b"")


def jpeg_bytes(w=40, h=30) -> bytes:
    app0 = b"\xff\xe0" + struct.pack(">H", 16) + b"JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    sof0 = b"\xff\xc0" + struct.pack(">HBHHB", 11, 8, h, w, 1) + b"\x01\x11\x00"
    return b"\xff\xd8" + app0 + sof0 + b"\xff\xd9"


def webp_vp8x_bytes(w=300, h=200) -> bytes:
    payload = b"\x00\x00\x00\x00" + (w - 1).to_bytes(3, "little") + (h - 1).to_bytes(3, "little")
    chunk = b"VP8X" + struct.pack("<I", len(payload)) + payload
    return b"RIFF" + struct.pack("<I", 4 + len(chunk)) + b"WEBP" + chunk


def webp_vp8l_bytes(w=17, h=9) -> bytes:
    bits = (w - 1) | ((h - 1) << 14)
    payload = b"\x2f" + struct.pack("<I", bits)
    chunk = b"VP8L" + struct.pack("<I", len(payload)) + payload + b"\x00" * 4
    return b"RIFF" + struct.pack("<I", 4 + len(chunk)) + b"WEBP" + chunk


PDF = b"%PDF-1.7\n%test\n"


def upload(client, headers, kind, name, data):
    return client.post("/api/admin/uploads", data={"kind": kind}, files={"file": (name, data)}, headers=headers)


@pytest.mark.parametrize("name,data,mime,size", [
    ("a.png", png_bytes(3, 2), "image/png", (3, 2)),
    ("b.jpg", jpeg_bytes(40, 30), "image/jpeg", (40, 30)),
    ("c.webp", webp_vp8x_bytes(300, 200), "image/webp", (300, 200)),
    ("d.webp", webp_vp8l_bytes(17, 9), "image/webp", (17, 9)),
])
def test_image_upload_and_dimensions(client, auth_headers, name, data, mime, size):
    resp = upload(client, auth_headers, "image", name, data)
    assert resp.status_code == 201, resp.json()
    body = resp.json()
    assert body["mime"] == mime and (body["width"], body["height"]) == size
    assert body["original_name"] == name and body["bytes"] == len(data)
    assert body["url"].startswith("http://testserver/media/image/")
    stored = Path(get_settings().MEDIA_DIR) / body["url"].split("/media/", 1)[1]
    assert stored.read_bytes() == data
    assert client.get(body["url"].replace("http://testserver", "")).content == data


def test_resume_pdf(client, auth_headers):
    resp = upload(client, auth_headers, "resume", "cv.pdf", PDF)
    assert resp.status_code == 201 and resp.json()["mime"] == "application/pdf"
    assert resp.json()["width"] is None


def test_wrong_types_rejected(client, auth_headers):
    assert upload(client, auth_headers, "resume", "cv.pdf", png_bytes()).status_code == 415
    assert upload(client, auth_headers, "image", "x.png", b"just some text").status_code == 415
    assert upload(client, auth_headers, "image", "x.svg", b"<svg xmlns='http://www.w3.org/2000/svg'/>").status_code == 415
    assert upload(client, auth_headers, "video", "x.png", png_bytes()).status_code == 422


def test_too_large(client, auth_headers):
    big = png_bytes() + b"\x00" * (5 * 1024 * 1024)
    resp = upload(client, auth_headers, "image", "big.png", big)
    assert resp.status_code == 413


def test_name_is_sanitized(client, auth_headers):
    from app.routers.admin.uploads import _clean_name

    assert _clean_name("..\\..\\evil\x01name.png") == "evilname.png"
    assert _clean_name("../../etc/passwd") == "passwd"
    assert _clean_name("") == "upload" and _clean_name(None) == "upload"
    assert len(_clean_name("a" * 400)) == 255
    resp = upload(client, auth_headers, "image", "../../photo.png", png_bytes())
    assert resp.status_code == 201 and resp.json()["original_name"] == "photo.png"


def test_requires_auth(client):
    assert client.post("/api/admin/uploads", data={"kind": "image"},
                       files={"file": ("a.png", png_bytes())}).status_code == 401


def test_in_use_and_delete(client, auth_headers, save_section, seed_sections):
    asset = upload(client, auth_headers, "image", "p.png", png_bytes()).json()
    assert save_section("profile", dict(seed_sections["profile"], portrait_asset_id=asset["id"])).status_code == 200

    listing = client.get("/api/admin/uploads", headers=auth_headers).json()["items"]
    assert listing[0]["id"] == asset["id"] and listing[0]["in_use"] == ["profile"]

    resp = client.delete(f"/api/admin/uploads/{asset['id']}", headers=auth_headers)
    assert resp.status_code == 409 and resp.json() == {"detail": "Asset is in use", "sections": ["profile"]}

    save_section("profile", seed_sections["profile"])
    stored = Path(get_settings().MEDIA_DIR) / asset["url"].split("/media/", 1)[1]
    assert stored.exists()
    assert client.delete(f"/api/admin/uploads/{asset['id']}", headers=auth_headers).status_code == 204
    assert not stored.exists()
    assert client.delete(f"/api/admin/uploads/{asset['id']}", headers=auth_headers).status_code == 404


def test_published_reference_also_counts(client, auth_headers, save_section, seed_sections):
    asset = upload(client, auth_headers, "image", "p.png", png_bytes()).json()
    save_section("profile", dict(seed_sections["profile"], portrait_asset_id=asset["id"]))
    client.post("/api/admin/publish", headers=auth_headers)
    save_section("profile", seed_sections["profile"])  # draft no longer uses it, published still does
    assert client.delete(f"/api/admin/uploads/{asset['id']}", headers=auth_headers).status_code == 409


def test_local_storage_refuses_path_escape(tmp_path):
    storage = LocalStorage(str(tmp_path / "media"), "http://x")
    (tmp_path / "secret.txt").write_text("keep")
    with pytest.raises(StorageError):
        storage.delete("../secret.txt")
    with pytest.raises(StorageError):
        storage.delete("")
    assert (tmp_path / "secret.txt").exists()


def test_cloudinary_signature_and_url_parsing():
    params = {"timestamp": 1315060510, "public_id": "sample_image", "eager": "w_400,h_300,c_pad|w_260,h_200,c_crop"}
    expected = hashlib.sha1(
        b"eager=w_400,h_300,c_pad|w_260,h_200,c_crop&public_id=sample_image&timestamp=1315060510abcd"
    ).hexdigest()
    assert cloudinary_signature(params, "abcd") == expected
    assert parse_cloudinary_url("cloudinary://123:s%40cret@demo") == ("123", "s@cret", "demo")
    with pytest.raises(StorageError):
        parse_cloudinary_url("https://nope")


def test_cloudinary_save_and_delete(monkeypatch):
    sent = {}

    class Resp:
        def raise_for_status(self):
            pass

        def json(self):
            return {"secure_url": "https://res.cloudinary.com/demo/image/upload/v1/portfolio/image/x.png",
                    "public_id": "portfolio/image/x", "width": 3, "height": 2}

    def fake_post(url, data=None, files=None, timeout=None):
        sent.setdefault("calls", []).append((url, dict(data)))
        return Resp()

    monkeypatch.setattr(requests, "post", fake_post)
    storage = CloudinaryStorage("cloudinary://key:secret@demo")
    url, storage_id, meta = storage.save(png_bytes(), "image", "png", "image/png")
    assert url.startswith("https://res.cloudinary.com/") and storage_id == "image:portfolio/image/x"
    assert meta == {"width": 3, "height": 2}
    upload_url, body = sent["calls"][0]
    assert upload_url == "https://api.cloudinary.com/v1_1/demo/image/upload"
    assert body["folder"] == "portfolio/image" and body["api_key"] == "key"
    assert body["signature"] == cloudinary_signature({"folder": body["folder"], "timestamp": body["timestamp"]}, "secret")

    storage.save(PDF, "resume", "pdf", "application/pdf")
    assert sent["calls"][1][0] == "https://api.cloudinary.com/v1_1/demo/raw/upload"

    storage.delete("raw:portfolio/resume/y")
    destroy_url, destroy_body = sent["calls"][2]
    assert destroy_url == "https://api.cloudinary.com/v1_1/demo/raw/destroy"
    assert destroy_body["public_id"] == "portfolio/resume/y"
