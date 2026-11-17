"""Builds the public, published-only content payload served at GET /api/content (spec 7.4)."""
import copy
import threading
from typing import Any, Dict, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.content import Asset, ContentSection, Publish
from app.utils.time import iso

PUBLIC_KEYS = ["profile", "about", "projects", "experience", "skills", "contact", "seo", "kirby"]

_cache: Dict[int, Dict[str, Any]] = {}
_lock = threading.Lock()


def clear_cache() -> None:
    with _lock:
        _cache.clear()


def current_version(db: Session) -> int:
    return db.scalar(select(func.max(Publish.id))) or 0


def _media(asset: Optional[Asset]) -> Optional[Dict[str, Any]]:
    if asset is None:
        return None
    return {"url": asset.url, "width": asset.width, "height": asset.height}


def _transform(key: str, data: Dict[str, Any], assets: Dict[str, Asset]) -> Dict[str, Any]:
    data = copy.deepcopy(data)
    get = lambda asset_id: assets.get(asset_id) if asset_id else None  # noqa: E731

    if key == "profile":
        data["portrait"] = _media(get(data.pop("portrait_asset_id", None)))
    elif key == "projects":
        items = []
        for item in data.get("items", []):
            if item.pop("hidden", False):
                continue
            item["image"] = _media(get(item.pop("image_asset_id", None)))
            items.append(item)
        data["items"] = items
    elif key == "experience":
        items = []
        for item in data.get("items", []):
            if not item.pop("hidden", False):
                items.append(item)
        data["items"] = items
    elif key == "contact":
        resume = get(data.pop("resume_asset_id", None))
        data["resume_url"] = resume.url if resume else None
    elif key == "seo":
        data["og_image"] = _media(get(data.pop("og_image_asset_id", None)))
    elif key == "kirby":
        data = {k: data.get(k) for k in ("enabled", "display_name", "tour")}
    return data


def build_public_content(db: Session) -> Dict[str, Any]:
    """Return the cached public payload for the latest publish version."""
    version = current_version(db)
    with _lock:
        cached = _cache.get(version)
    if cached is not None:
        return cached

    rows = db.scalars(
        select(ContentSection).where(ContentSection.key.in_(PUBLIC_KEYS), ContentSection.published.is_not(None))
    ).all()
    assets = {a.id: a for a in db.scalars(select(Asset)).all()}

    sections: Dict[str, Any] = {}
    published_at = None
    for row in rows:
        if row.published is None:
            continue
        sections[row.key] = _transform(row.key, row.published, assets)
        if row.published_at and (published_at is None or row.published_at > published_at):
            published_at = row.published_at

    payload = {
        "version": version,
        "published_at": iso(published_at),
        "sections": {k: sections[k] for k in PUBLIC_KEYS if k in sections},
    }
    with _lock:
        _cache.clear()
        _cache[version] = payload
    return payload
