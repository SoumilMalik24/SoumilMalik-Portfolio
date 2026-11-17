"""Admin Kirby endpoints: re-index, index status, playground (spec 7.8)."""
from fastapi import APIRouter, BackgroundTasks, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.config import get_settings
from app.constants import SECTIONS
from app.db import SessionLocal, get_db
from app.deps import current_admin
from app.errors import ApiError
from app.models.admin import Admin
from app.schemas.agent import PlaygroundRequest
from app.services.agent import load_persona, run_agent
from app.services.audit import log_audit
from app.services.kb import index as kb_index
from app.utils.net import client_ip

router = APIRouter(prefix="/api/admin/kirby", tags=["Admin Kirby"])


def _run_reindex_job() -> None:
    db = SessionLocal()
    try:
        kb_index.reindex(db)
    except Exception:  # noqa: BLE001 - status already records the failure
        pass
    finally:
        db.close()


@router.post("/reindex", status_code=202, summary="Rebuild Kirby's knowledge index")
def reindex(
    request: Request, background: BackgroundTasks, admin: Admin = Depends(current_admin), db: Session = Depends(get_db)
) -> JSONResponse:
    if kb_index.is_running():
        raise ApiError(409, "Re-index already running")
    log_audit(db, action="kirby.reindex", admin_id=admin.id, target="kirby", ip=client_ip(request))
    background.add_task(_run_reindex_job)
    return JSONResponse(status_code=202, content={**kb_index.get_status(db), "status": "running"},
                        background=background)


@router.get("/index", summary="Knowledge index status")
def index_status(_: Admin = Depends(current_admin), db: Session = Depends(get_db)) -> dict:
    return kb_index.get_status(db)


@router.post("/playground", summary="Try Kirby with the draft persona (not logged)")
def playground(body: PlaygroundRequest, _: Admin = Depends(current_admin), db: Session = Depends(get_db)) -> dict:
    if not get_settings().OPENROUTER_API_KEY:
        raise ApiError(503, "OPENROUTER_API_KEY is not configured")
    if body.messages[-1].role != "user":
        raise ApiError(400, "Last message must be from the user")
    persona = load_persona(db, use_draft=body.use_draft) or load_persona(db)
    if persona is None:
        raise ApiError(409, "Kirby section has no content yet")
    current = body.current_section if body.current_section in SECTIONS else None
    result = run_agent(body.messages, persona, lambda q: kb_index.search(db, q), current_section=current)
    return {
        "reply": result.reply,
        "section": result.section,
        "mood": result.mood,
        "debug": {
            "chunks": result.chunks,
            "tool_calls": result.tool_calls,
            "latency_ms": result.latency_ms,
            "model": result.model,
            "unanswered": result.unanswered,
        },
    }
