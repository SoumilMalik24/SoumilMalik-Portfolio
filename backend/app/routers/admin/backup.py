"""Admin content export / import (spec 7.7)."""
import json
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import CONTENT_KEYS
from app.db import get_db
from app.deps import current_admin
from app.errors import ApiError
from app.models.admin import Admin
from app.models.content import Asset, ContentSection
from app.routers.admin.uploads import asset_out
from app.services import content as content_service
from app.services.audit import log_audit
from app.services.publish import add_revision
from app.utils.net import client_ip
from app.utils.time import iso, utcnow

router = APIRouter(prefix="/api/admin", tags=["Admin Backup"])

EXPORT_FORMAT = "portfolio-export"
SCHEMA_VERSION = 1
MAX_IMPORT_BYTES = 2 * 1024 * 1024


@router.get("/export", summary="Download all content as JSON")
def export_content(_: Admin = Depends(current_admin), db: Session = Depends(get_db)) -> JSONResponse:
    now = utcnow()
    rows = {r.key: r for r in db.scalars(select(ContentSection)).all()}
    body = {
        "format": EXPORT_FORMAT,
        "schema_version": SCHEMA_VERSION,
        "exported_at": iso(now),
        "sections": {
            key: {"draft": rows[key].draft, "published": rows[key].published}
            for key in CONTENT_KEYS if key in rows
        },
        "assets": [asset_out(a) for a in db.scalars(select(Asset).order_by(Asset.created_at)).all()],
    }
    filename = f"portfolio-export-{now:%Y%m%d}.json"
    return JSONResponse(content=body, headers={"Content-Disposition": f'attachment; filename="{filename}"'})


async def _read_import(request: Request) -> Dict[str, Any]:
    raw = await request.body()
    if len(raw) > MAX_IMPORT_BYTES:
        raise ApiError(413, "Import file too large (max 2 MB)")
    try:
        doc = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        raise ApiError(422, "Validation failed", errors=[{"field": "", "msg": "Body must be JSON"}])
    if not isinstance(doc, dict) or doc.get("format") != EXPORT_FORMAT or doc.get("schema_version") != SCHEMA_VERSION:
        raise ApiError(422, "Validation failed",
                       errors=[{"field": "format", "msg": "Not a portfolio export (format/schema_version)"}])
    if not isinstance(doc.get("sections"), dict):
        raise ApiError(422, "Validation failed", errors=[{"field": "sections", "msg": "Must be an object"}])
    return doc


@router.post("/import", summary="Import an export file into drafts")
async def import_content(
    request: Request,
    dry_run: bool = Query(True),
    admin: Admin = Depends(current_admin),
    db: Session = Depends(get_db),
) -> JSONResponse:
    doc = await _read_import(request)
    changes: List[Dict[str, Any]] = []
    errors: List[Dict[str, str]] = []
    validated: Dict[str, Dict[str, Any]] = {}

    for key, entry in doc["sections"].items():
        if key not in CONTENT_KEYS:
            errors.append({"field": f"sections.{key}", "msg": "Unknown section"})
            continue
        data = entry.get("draft") if isinstance(entry, dict) else None
        if data is None and isinstance(entry, dict):
            data = entry.get("published")
        if data is None:
            continue
        try:
            validated[key] = content_service.validate_section(db, key, data, prefix=f"sections.{key}")
        except ApiError as exc:
            errors.extend(exc.errors or [{"field": f"sections.{key}", "msg": exc.detail}])
            continue
        row = content_service.get_row(db, key)
        changes.append({"section": key, "changed": row is None or row.draft != validated[key]})

    result = {"dry_run": dry_run, "changes": changes, "errors": errors}
    if errors:
        status = 200 if dry_run else 422
        body = result if dry_run else {"detail": "Validation failed", **result}
        return JSONResponse(status_code=status, content=body)
    if dry_run:
        return JSONResponse(content=result)

    for key, data in validated.items():
        content_service.write_draft(db, key, data)
        db.flush()
        add_revision(db, key, data, "import", admin.id)
    db.commit()
    log_audit(db, action="content.import", admin_id=admin.id, target="content",
              meta={"sections": sorted(validated)}, ip=client_ip(request))
    return JSONResponse(content=result)
