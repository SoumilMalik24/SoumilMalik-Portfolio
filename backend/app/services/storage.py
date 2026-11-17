"""File storage backends for uploads: local disk (served at /media) or Cloudinary (spec 7.6)."""
import hashlib
import logging
import time
import uuid
from pathlib import Path
from typing import Dict, Protocol, Tuple
from urllib.parse import unquote, urlparse

import requests

from app.config import get_settings

logger = logging.getLogger(__name__)


class StorageError(Exception):
    """Raised when a file cannot be stored."""


class Storage(Protocol):
    name: str

    def save(self, data: bytes, kind: str, ext: str, mime: str) -> Tuple[str, str, Dict]:
        """Store bytes; return (public_url, storage_id, extra_meta)."""

    def delete(self, storage_id: str) -> None:
        """Delete a stored file. Must not raise for missing files."""


class LocalStorage:
    name = "local"

    def __init__(self, media_dir: str, public_api_url: str):
        self.root = Path(media_dir).resolve()
        self.base_url = public_api_url.rstrip("/") + "/media"

    def _resolve(self, storage_id: str) -> Path:
        path = (self.root / storage_id).resolve()
        if not path.is_relative_to(self.root) or path == self.root:
            raise StorageError("Invalid storage path")
        return path

    def save(self, data: bytes, kind: str, ext: str, mime: str) -> Tuple[str, str, Dict]:
        storage_id = f"{kind}/{uuid.uuid4().hex}.{ext}"
        path = self._resolve(storage_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return f"{self.base_url}/{storage_id}", storage_id, {}

    def delete(self, storage_id: str) -> None:
        path = self._resolve(storage_id)
        path.unlink(missing_ok=True)


def parse_cloudinary_url(url: str) -> Tuple[str, str, str]:
    """`cloudinary://<key>:<secret>@<cloud>` -> (api_key, api_secret, cloud_name)."""
    parsed = urlparse(url)
    if parsed.scheme != "cloudinary" or not parsed.username or not parsed.password or not parsed.hostname:
        raise StorageError("CLOUDINARY_URL must look like cloudinary://<key>:<secret>@<cloud_name>")
    return unquote(parsed.username), unquote(parsed.password), parsed.hostname


def cloudinary_signature(params: Dict[str, object], api_secret: str) -> str:
    """Cloudinary request signature: sha1 of sorted `k=v` pairs joined by '&' plus the secret."""
    to_sign = "&".join(f"{k}={params[k]}" for k in sorted(params) if params[k] not in (None, ""))
    return hashlib.sha1((to_sign + api_secret).encode("utf-8")).hexdigest()


class CloudinaryStorage:
    name = "cloudinary"
    API = "https://api.cloudinary.com/v1_1"

    def __init__(self, cloudinary_url: str):
        self.api_key, self.api_secret, self.cloud = parse_cloudinary_url(cloudinary_url)

    @staticmethod
    def _resource_type(mime: str) -> str:
        return "image" if mime.startswith("image/") else "raw"

    def save(self, data: bytes, kind: str, ext: str, mime: str) -> Tuple[str, str, Dict]:
        resource_type = self._resource_type(mime)
        params = {"folder": f"portfolio/{kind}", "timestamp": int(time.time())}
        body = {**params, "api_key": self.api_key, "signature": cloudinary_signature(params, self.api_secret)}
        filename = f"{uuid.uuid4().hex}.{ext}"
        try:
            resp = requests.post(
                f"{self.API}/{self.cloud}/{resource_type}/upload",
                data=body, files={"file": (filename, data, mime)}, timeout=60,
            )
            resp.raise_for_status()
            result = resp.json()
        except (requests.RequestException, ValueError) as exc:
            raise StorageError(f"Cloudinary upload failed: {exc}") from exc
        # storage_id keeps the resource type so delete() can target the right endpoint.
        storage_id = f"{resource_type}:{result['public_id']}"
        return result["secure_url"], storage_id, {"width": result.get("width"), "height": result.get("height")}

    def delete(self, storage_id: str) -> None:
        resource_type, _, public_id = storage_id.partition(":")
        if not public_id:
            resource_type, public_id = "image", storage_id
        params = {"public_id": public_id, "timestamp": int(time.time())}
        body = {**params, "api_key": self.api_key, "signature": cloudinary_signature(params, self.api_secret)}
        try:
            requests.post(f"{self.API}/{self.cloud}/{resource_type}/destroy", data=body, timeout=30)
        except requests.RequestException as exc:
            logger.warning("Cloudinary delete failed for %s: %s", public_id, exc)


def get_storage() -> Storage:
    settings = get_settings()
    if settings.STORAGE_BACKEND == "cloudinary":
        return CloudinaryStorage(settings.CLOUDINARY_URL)
    return LocalStorage(settings.MEDIA_DIR, settings.PUBLIC_API_URL)
