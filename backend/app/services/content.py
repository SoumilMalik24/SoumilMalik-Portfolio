"""Content sections: validation, asset-reference checks, draft save/discard (spec 7.4, section 8)."""
import json
from typing import Any, Dict, Iterable, List, Optional, Tuple

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import CONTENT_KEYS
from app.errors import ApiError
from app.models.content import Asset, ContentSection
from app.schemas.content import ASSET_FIELDS, SECTION_SCHEMAS
from app.utils.time import iso, utcnow

MAX_SECTION_BYTES = 64 * 1024
KIND_MSG = {"image": "Asset must be an image", "resume": "Asset must be a resume PDF"}


def ensure_key(key: str) -> None:
    if key not in CONTENT_KEYS:
        raise ApiError(status_code=404, detail="Unknown content section")


def _field_path(loc: Iterable[Any], prefix: str) -> str:
    path = ".".join(str(p) for p in loc)
    return f"{prefix}.{path}" if prefix and path else (prefix or path)


def _error_msg(err: Dict[str, Any]) -> str:
    msg = err.get("msg", "Invalid value")
    return msg.removeprefix("Value error, ")


def iter_asset_refs(key: str, data: Optional[Dict[str, Any]]) -> List[Tuple[str, str, str]]:
    """Return (field_path, asset_id, required_kind) for every asset reference in a section."""
    refs: List[Tuple[str, str, str]] = []
    if not isinstance(data, dict):
        return refs
    for template, kind in ASSET_FIELDS.get(key, []):
        if "[]." in template:
            list_name, field = template.split("[].", 1)
            for i, item in enumerate(data.get(list_name) or []):
                if isinstance(item, dict) and item.get(field):
                    refs.append((f"{list_name}.{i}.{field}", item[field], kind))
        elif data.get(template):
            refs.append((template, data[template], kind))
    return refs


def validate_section(db: Session, key: str, data: Any, prefix: str = "") -> Dict[str, Any]:
    """Validate and normalize a section payload, including asset references. Raises ApiError(422)."""
    if not isinstance(data, dict):
        raise ApiError(422, "Validation failed", errors=[{"field": prefix, "msg": "Must be an object"}])
    if len(json.dumps(data, ensure_ascii=False).encode("utf-8")) > MAX_SECTION_BYTES:
        raise ApiError(422, "Section too large")
    try:
        normalized = SECTION_SCHEMAS[key].model_validate(data).model_dump(mode="json")
    except ValidationError as exc:
        errors = [{"field": _field_path(e["loc"], prefix), "msg": _error_msg(e)} for e in exc.errors()]
        raise ApiError(422, "Validation failed", errors=errors)

    asset_errors = check_asset_refs(db, key, normalized, prefix)
    if asset_errors:
        raise ApiError(422, "Validation failed", errors=asset_errors)
    return normalized


def check_asset_refs(db: Session, key: str, data: Dict[str, Any], prefix: str = "") -> List[Dict[str, str]]:
    refs = iter_asset_refs(key, data)
    if not refs:
        return []
    ids = {asset_id for _, asset_id, _ in refs}
    kinds = dict(db.execute(select(Asset.id, Asset.kind).where(Asset.id.in_(ids))).all())
    errors = []
    for path, asset_id, kind in refs:
        found = kinds.get(asset_id)
        if found is None:
            errors.append({"field": _field_path([path], prefix), "msg": "Asset not found"})
        elif found != kind:
            errors.append({"field": _field_path([path], prefix), "msg": KIND_MSG[kind]})
    return errors


def get_row(db: Session, key: str) -> Optional[ContentSection]:
    return db.get(ContentSection, key)


def section_state(key: str, row: Optional[ContentSection]) -> Dict[str, Any]:
    if row is None:
        return {
            "key": key, "draft": None, "published": None, "version": 0, "dirty": False,
            "draft_updated_at": None, "published_at": None,
        }
    return {
        "key": key,
        "draft": row.draft,
        "published": row.published,
        "version": row.version,
        "dirty": row.draft != row.published,
        "draft_updated_at": iso(row.draft_updated_at),
        "published_at": iso(row.published_at),
    }


def all_states(db: Session) -> Dict[str, Dict[str, Any]]:
    rows = {r.key: r for r in db.scalars(select(ContentSection)).all()}
    return {key: section_state(key, rows.get(key)) for key in CONTENT_KEYS}


def write_draft(db: Session, key: str, data: Dict[str, Any]) -> ContentSection:
    """Store an already-validated draft, creating the row if needed, and bump its version (no commit)."""
    row = get_row(db, key)
    now = utcnow()
    if row is None:
        row = ContentSection(key=key, draft=data, published=None, version=1, draft_updated_at=now)
        db.add(row)
    else:
        row.draft = data
        row.version += 1
        row.draft_updated_at = now
    return row


def save_draft(db: Session, key: str, data: Any, version: int) -> ContentSection:
    """Validate and save a draft with optimistic locking."""
    ensure_key(key)
    row = get_row(db, key)
    current = row.version if row else 0
    if version != current:
        raise ApiError(409, "Section was changed elsewhere", extra={"current_version": current})
    normalized = validate_section(db, key, data)
    row = write_draft(db, key, normalized)
    db.commit()
    db.refresh(row)
    return row


def discard_draft(db: Session, key: str) -> ContentSection:
    ensure_key(key)
    row = get_row(db, key)
    if row is None or row.published is None:
        raise ApiError(409, "Nothing published yet")
    row.draft = row.published
    row.version += 1
    row.draft_updated_at = utcnow()
    db.commit()
    db.refresh(row)
    return row


def assets_in_use(db: Session) -> Dict[str, List[str]]:
    """Map asset id -> sorted section keys whose draft or published copy references it."""
    usage: Dict[str, set] = {}
    for row in db.scalars(select(ContentSection)).all():
        for data in (row.draft, row.published):
            for _, asset_id, _ in iter_asset_refs(row.key, data):
                usage.setdefault(asset_id, set()).add(row.key)
    return {asset_id: sorted(keys) for asset_id, keys in usage.items()}
