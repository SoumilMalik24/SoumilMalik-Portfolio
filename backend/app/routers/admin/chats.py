"""Admin chat conversations: browse, star/archive/note, delete, unanswered questions (spec 7.9)."""
import re
from collections import defaultdict
from datetime import timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import current_admin
from app.errors import ApiError
from app.models.admin import Admin
from app.models.chat import ConversationModel, MessageModel
from app.schemas.chats import AnswerRequest, ConversationOut, ConversationUpdate
from app.schemas.common import Page
from app.schemas.content import SectionState
from app.services import content as content_service
from app.services.audit import log_audit
from app.utils.net import client_ip
from app.utils.time import iso, utcnow

router = APIRouter(prefix="/api/admin", tags=["Admin Chats"])


def _summaries(db: Session, convos: List[ConversationModel]) -> List[ConversationOut]:
    """ConversationOut for each conversation: preview = first user message, has_unanswered flag."""
    ids = [c.id for c in convos]
    previews: Dict[str, str] = {}
    flagged: set = set()
    if ids:
        first_ids = db.execute(
            select(MessageModel.conversation_id, func.min(MessageModel.id))
            .where(MessageModel.conversation_id.in_(ids), MessageModel.role == "user")
            .group_by(MessageModel.conversation_id)
        ).all()
        if first_ids:
            content = dict(db.execute(
                select(MessageModel.id, MessageModel.content).where(MessageModel.id.in_([m for _, m in first_ids]))
            ).all())
            previews = {cid: content.get(mid, "")[:120] for cid, mid in first_ids}
        flagged = set(db.scalars(
            select(MessageModel.conversation_id)
            .where(MessageModel.conversation_id.in_(ids), MessageModel.unanswered.is_(True)).distinct()
        ).all())
    return [
        ConversationOut(
            id=c.id, preview=previews.get(c.id, ""), started_at=iso(c.started_at), last_at=iso(c.last_at),
            messages=c.message_count, starred=c.starred, archived=c.archived, note=c.note,
            has_unanswered=c.id in flagged,
        )
        for c in convos
    ]


@router.get("/conversations", response_model=Page[ConversationOut], summary="List conversations")
def list_conversations(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    q: Optional[str] = Query(None, max_length=200),
    starred: Optional[bool] = Query(None),
    archived: bool = Query(False),
    unanswered: Optional[bool] = Query(None),
    _: Admin = Depends(current_admin),
    db: Session = Depends(get_db),
) -> Page[ConversationOut]:
    conds = [ConversationModel.archived == archived]
    if starred is not None:
        conds.append(ConversationModel.starred == starred)
    if q:
        escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        matching = select(MessageModel.conversation_id).where(MessageModel.content.ilike(f"%{escaped}%", escape="\\"))
        conds.append(ConversationModel.id.in_(matching))
    if unanswered is not None:
        flagged = select(MessageModel.conversation_id).where(MessageModel.unanswered.is_(True))
        conds.append(ConversationModel.id.in_(flagged) if unanswered else ConversationModel.id.not_in(flagged))

    total = db.scalar(select(func.count(ConversationModel.id)).where(*conds)) or 0
    rows = db.scalars(
        select(ConversationModel).where(*conds).order_by(ConversationModel.last_at.desc()).limit(limit).offset(offset)
    ).all()
    return Page[ConversationOut](items=_summaries(db, list(rows)), total=total)


def _get(db: Session, conversation_id: str) -> ConversationModel:
    convo = db.get(ConversationModel, conversation_id)
    if convo is None:
        raise ApiError(404, "Conversation not found")
    return convo


@router.get("/conversations/{conversation_id}", summary="Conversation with all messages")
def get_conversation(
    conversation_id: str, _: Admin = Depends(current_admin), db: Session = Depends(get_db)
) -> Dict[str, Any]:
    convo = _get(db, conversation_id)
    msgs = db.scalars(
        select(MessageModel).where(MessageModel.conversation_id == conversation_id).order_by(MessageModel.id)
    ).all()
    summary = _summaries(db, [convo])[0].model_dump()
    summary["messages"] = [
        {"role": m.role, "content": m.content, "at": iso(m.created_at), "section": m.section,
         "mood": m.mood, "unanswered": m.unanswered}
        for m in msgs
    ]
    return summary


@router.patch("/conversations/{conversation_id}", response_model=ConversationOut, summary="Star, archive or annotate")
def update_conversation(
    conversation_id: str, body: ConversationUpdate, request: Request,
    admin: Admin = Depends(current_admin), db: Session = Depends(get_db),
) -> ConversationOut:
    convo = _get(db, conversation_id)
    fields = body.model_fields_set
    if "starred" in fields and body.starred is not None:
        convo.starred = body.starred
    if "archived" in fields and body.archived is not None:
        convo.archived = body.archived
    if "note" in fields:
        convo.note = (body.note or "").strip() or None
    db.commit()
    log_audit(db, action="chat.update", admin_id=admin.id, target=f"chat:{conversation_id}",
              meta={"fields": sorted(fields)}, ip=client_ip(request))
    return _summaries(db, [convo])[0]


@router.delete("/conversations/{conversation_id}", status_code=204, summary="Delete a conversation")
def delete_conversation(
    conversation_id: str, request: Request, admin: Admin = Depends(current_admin), db: Session = Depends(get_db)
) -> Response:
    db.delete(_get(db, conversation_id))
    db.commit()
    log_audit(db, action="chat.delete", admin_id=admin.id, target=f"chat:{conversation_id}", ip=client_ip(request))
    return Response(status_code=204)


def normalize_question(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", text.lower())).strip()


@router.get("/questions/unanswered", summary="Questions Kirby could not answer, grouped")
def unanswered_questions(
    days: int = Query(30, ge=1, le=365), _: Admin = Depends(current_admin), db: Session = Depends(get_db)
) -> Dict[str, Any]:
    rows = db.execute(
        select(MessageModel.content, MessageModel.created_at, MessageModel.conversation_id)
        .where(MessageModel.unanswered.is_(True), MessageModel.role == "user",
               MessageModel.created_at >= utcnow() - timedelta(days=days))
        .order_by(MessageModel.created_at.desc())
    ).all()
    groups: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"count": 0, "conversation_ids": []})
    for content, created_at, cid in rows:
        key = normalize_question(content)
        if not key:
            continue
        g = groups[key]
        if g["count"] == 0:  # rows are newest first: first seen = most recent wording
            g.update(question=content.strip(), last_at=iso(created_at))
        g["count"] += 1
        if cid not in g["conversation_ids"] and len(g["conversation_ids"]) < 5:
            g["conversation_ids"].append(cid)
    items = sorted(groups.values(), key=lambda g: (-g["count"], g["last_at"] or ""))[:50]
    return {"items": [{"question": g["question"], "count": g["count"], "last_at": g["last_at"],
                       "conversation_ids": g["conversation_ids"]} for g in items]}


@router.post("/questions/answer", response_model=SectionState, summary="Add an FAQ to the knowledge draft")
def answer_question(
    body: AnswerRequest, request: Request, admin: Admin = Depends(current_admin), db: Session = Depends(get_db)
) -> SectionState:
    row = content_service.get_row(db, "knowledge")
    current = dict(row.draft) if row and row.draft else {"notes": [], "faq": []}
    faq = list(current.get("faq") or [])
    faq.append({"q": body.question.strip(), "a": body.answer.strip()})
    normalized = content_service.validate_section(db, "knowledge", {**current, "faq": faq})
    row = content_service.write_draft(db, "knowledge", normalized)
    db.commit()
    db.refresh(row)
    log_audit(db, action="faq.add", admin_id=admin.id, target="content:knowledge", ip=client_ip(request))
    return SectionState(**content_service.section_state("knowledge", row))
