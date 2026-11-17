"""Admin publish, deploy and revision endpoints (spec 7.5)."""
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.constants import CONTENT_KEYS
from app.db import get_db
from app.deps import current_admin
from app.errors import ApiError
from app.models.admin import Admin
from app.models.content import ContentRevision, Publish
from app.schemas.common import Page
from app.schemas.content import SectionState
from app.schemas.publish import PublishOut, PublishRequest, RevisionDetail, RevisionOut
from app.services import content as content_service
from app.services.audit import log_audit
from app.services.publish import prepare_redeploy, publish_out, publish_sections, run_post_publish
from app.utils.net import client_ip
from app.utils.time import iso

router = APIRouter(prefix="/api/admin", tags=["Admin Publish"])


def _get_publish(db: Session, publish_id: int) -> Publish:
    pub = db.get(Publish, publish_id)
    if pub is None:
        raise ApiError(404, "Publish not found")
    return pub


@router.post("/publish", status_code=202, response_model=PublishOut, summary="Publish drafts")
def publish(
    request: Request,
    background: BackgroundTasks,
    body: Optional[PublishRequest] = None,
    admin: Admin = Depends(current_admin),
    db: Session = Depends(get_db),
) -> JSONResponse:
    pub = publish_sections(db, body.sections if body else None, admin.id)
    log_audit(db, action="publish", admin_id=admin.id, target=f"publish:{pub.id}",
              meta={"sections": pub.sections}, ip=client_ip(request))
    background.add_task(run_post_publish, pub.id)
    return JSONResponse(status_code=202, content=publish_out(pub), background=background)


@router.get("/publishes", response_model=Page[PublishOut], summary="Publish history")
def list_publishes(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _: Admin = Depends(current_admin),
    db: Session = Depends(get_db),
) -> Page[PublishOut]:
    total = db.scalar(select(func.count(Publish.id))) or 0
    rows = db.scalars(select(Publish).order_by(Publish.id.desc()).limit(limit).offset(offset)).all()
    return Page[PublishOut](items=[PublishOut(**publish_out(p)) for p in rows], total=total)


@router.get("/publishes/{publish_id}", response_model=PublishOut, summary="One publish (poll for progress)")
def get_publish(publish_id: int, _: Admin = Depends(current_admin), db: Session = Depends(get_db)) -> PublishOut:
    return PublishOut(**publish_out(_get_publish(db, publish_id)))


@router.post("/publishes/{publish_id}/redeploy", status_code=202, response_model=PublishOut,
             summary="Re-trigger the deploy hook")
def redeploy(
    publish_id: int,
    request: Request,
    background: BackgroundTasks,
    admin: Admin = Depends(current_admin),
    db: Session = Depends(get_db),
) -> JSONResponse:
    pub = prepare_redeploy(db, _get_publish(db, publish_id))
    log_audit(db, action="deploy.retrigger", admin_id=admin.id, target=f"publish:{pub.id}", ip=client_ip(request))
    background.add_task(run_post_publish, pub.id, True)
    return JSONResponse(status_code=202, content=publish_out(pub), background=background)


def _revision_out(rev: ContentRevision) -> dict:
    return {"id": rev.id, "section_key": rev.section_key, "kind": rev.kind,
            "publish_id": rev.publish_id, "created_at": iso(rev.created_at)}


@router.get("/revisions", response_model=Page[RevisionOut], summary="Revision history")
def list_revisions(
    section: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _: Admin = Depends(current_admin),
    db: Session = Depends(get_db),
) -> Page[RevisionOut]:
    stmt, count = select(ContentRevision), select(func.count(ContentRevision.id))
    if section:
        if section not in CONTENT_KEYS:
            raise ApiError(404, "Unknown content section")
        stmt = stmt.where(ContentRevision.section_key == section)
        count = count.where(ContentRevision.section_key == section)
    rows = db.scalars(
        stmt.order_by(ContentRevision.created_at.desc(), ContentRevision.id.desc()).limit(limit).offset(offset)
    ).all()
    return Page[RevisionOut](items=[RevisionOut(**_revision_out(r)) for r in rows], total=db.scalar(count) or 0)


def _get_revision(db: Session, revision_id: int) -> ContentRevision:
    rev = db.get(ContentRevision, revision_id)
    if rev is None:
        raise ApiError(404, "Revision not found")
    return rev


@router.get("/revisions/{revision_id}", response_model=RevisionDetail, summary="One revision with data")
def get_revision(revision_id: int, _: Admin = Depends(current_admin), db: Session = Depends(get_db)) -> RevisionDetail:
    rev = _get_revision(db, revision_id)
    return RevisionDetail(**_revision_out(rev), data=rev.data)


@router.post("/revisions/{revision_id}/restore", response_model=SectionState, summary="Restore a revision into the draft")
def restore_revision(
    revision_id: int, request: Request, admin: Admin = Depends(current_admin), db: Session = Depends(get_db)
) -> SectionState:
    rev = _get_revision(db, revision_id)
    normalized = content_service.validate_section(db, rev.section_key, rev.data)
    row = content_service.write_draft(db, rev.section_key, normalized)
    db.commit()
    db.refresh(row)
    log_audit(db, action="content.restore", admin_id=admin.id, target=f"content:{rev.section_key}",
              meta={"revision_id": rev.id}, ip=client_ip(request))
    return SectionState(**content_service.section_state(rev.section_key, row))
