"""Admin upload endpoints for images and the resume PDF (spec 7.6)."""
import logging
import os
import re
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Query, Request, Response, UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import current_admin
from app.errors import ApiError
from app.models.admin import Admin
from app.models.content import Asset
from app.schemas.uploads import AssetOut, AssetWithUsage
from app.services.audit import log_audit
from app.services.content import assets_in_use
from app.services.storage import StorageError, get_storage
from app.utils.net import client_ip
from app.utils.sniff import EXT_BY_MIME, detect_mime, image_size
from app.utils.time import iso, utcnow

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["Admin Uploads"])

LIMITS = {"image": 5 * 1024 * 1024, "resume": 10 * 1024 * 1024}
ALLOWED_MIMES = {"image": {"image/png", "image/jpeg", "image/webp"}, "resume": {"application/pdf"}}


def _clean_name(name: Optional[str]) -> str:
    base = os.path.basename((name or "").replace("\\", "/"))
    base = re.sub(r"[\x00-\x1f\x7f]", "", base).strip()
    return base[:255] or "upload"


def asset_out(asset: Asset) -> dict:
    return {
        "id": asset.id, "kind": asset.kind, "url": asset.url, "mime": asset.mime, "bytes": asset.bytes,
        "width": asset.width, "height": asset.height, "original_name": asset.original_name,
        "created_at": iso(asset.created_at),
    }


@router.post("/uploads", status_code=201, response_model=AssetOut, summary="Upload an image or the resume")
async def upload(
    request: Request,
    kind: str = Form(...),
    file: UploadFile = File(...),
    admin: Admin = Depends(current_admin),
    db: Session = Depends(get_db),
) -> AssetOut:
    if kind not in LIMITS:
        raise ApiError(422, "Validation failed", errors=[{"field": "kind", "msg": "Must be 'image' or 'resume'"}])
    limit = LIMITS[kind]
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise ApiError(413, f"File too large (max {limit // (1024 * 1024)} MB)")

    mime = detect_mime(data)
    if mime not in ALLOWED_MIMES[kind]:
        raise ApiError(415, "Unsupported file type")

    size = image_size(data, mime) if kind == "image" else None
    try:
        url, storage_id, meta = await run_in_threadpool(get_storage().save, data, kind, EXT_BY_MIME[mime], mime)
    except StorageError as exc:
        raise ApiError(502, str(exc))

    width = meta.get("width") or (size[0] if size else None)
    height = meta.get("height") or (size[1] if size else None)
    asset = Asset(
        id=str(uuid.uuid4()), kind=kind, url=url, storage_id=storage_id, mime=mime, bytes=len(data),
        width=width, height=height, original_name=_clean_name(file.filename), admin_id=admin.id, created_at=utcnow(),
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    log_audit(db, action="upload.create", admin_id=admin.id, target=f"asset:{asset.id}",
              meta={"kind": kind, "bytes": len(data)}, ip=client_ip(request))
    return AssetOut(**asset_out(asset))


@router.get("/uploads", summary="List uploaded files")
def list_uploads(
    kind: Optional[str] = Query(None),
    _: Admin = Depends(current_admin),
    db: Session = Depends(get_db),
) -> dict:
    stmt = select(Asset).order_by(Asset.created_at.desc())
    if kind:
        stmt = stmt.where(Asset.kind == kind)
    usage = assets_in_use(db)
    items = [AssetWithUsage(**asset_out(a), in_use=usage.get(a.id, [])) for a in db.scalars(stmt).all()]
    return {"items": items}


@router.delete("/uploads/{asset_id}", status_code=204, summary="Delete an unused upload")
def delete_upload(
    asset_id: str, request: Request, admin: Admin = Depends(current_admin), db: Session = Depends(get_db)
) -> Response:
    asset = db.get(Asset, asset_id)
    if asset is None:
        raise ApiError(404, "Asset not found")
    sections = assets_in_use(db).get(asset_id)
    if sections:
        raise ApiError(409, "Asset is in use", extra={"sections": sections})
    try:
        get_storage().delete(asset.storage_id)
    except StorageError as exc:
        # The row is still removed; a leftover file is harmless, a dangling row is not.
        logger.warning("Could not delete stored file for %s: %s", asset_id, exc)
    db.delete(asset)
    db.commit()
    log_audit(db, action="upload.delete", admin_id=admin.id, target=f"asset:{asset_id}", ip=client_ip(request))
    return Response(status_code=204)
