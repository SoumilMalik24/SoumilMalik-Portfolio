"""Admin content editing endpoints (spec 7.4)."""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import current_admin
from app.models.admin import Admin
from app.schemas.content import AllSections, SaveSectionRequest, SectionState
from app.services import content as content_service
from app.services.audit import log_audit
from app.utils.net import client_ip

router = APIRouter(prefix="/api/admin", tags=["Admin Content"])


@router.get("/content", response_model=AllSections, summary="All sections with draft and published copies")
def list_sections(_: Admin = Depends(current_admin), db: Session = Depends(get_db)) -> AllSections:
    return AllSections(sections=content_service.all_states(db))


@router.get("/content/{key}", response_model=SectionState, summary="One section")
def get_section(key: str, _: Admin = Depends(current_admin), db: Session = Depends(get_db)) -> SectionState:
    content_service.ensure_key(key)
    return SectionState(**content_service.section_state(key, content_service.get_row(db, key)))


@router.put("/content/{key}", response_model=SectionState, summary="Save a section draft")
def save_section(
    key: str,
    body: SaveSectionRequest,
    request: Request,
    admin: Admin = Depends(current_admin),
    db: Session = Depends(get_db),
) -> SectionState:
    row = content_service.save_draft(db, key, body.data, body.version)
    log_audit(db, action="content.save", admin_id=admin.id, target=f"content:{key}", ip=client_ip(request))
    return SectionState(**content_service.section_state(key, row))


@router.post("/content/{key}/discard", response_model=SectionState, summary="Reset a draft to the published copy")
def discard_section(
    key: str, request: Request, admin: Admin = Depends(current_admin), db: Session = Depends(get_db)
) -> SectionState:
    row = content_service.discard_draft(db, key)
    log_audit(db, action="content.discard", admin_id=admin.id, target=f"content:{key}", ip=client_ip(request))
    return SectionState(**content_service.section_state(key, row))
