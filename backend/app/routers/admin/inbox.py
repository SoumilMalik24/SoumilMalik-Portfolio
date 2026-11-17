"""Admin inbox for contact-form messages (spec 7.11)."""
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import current_admin
from app.errors import ApiError
from app.models.admin import Admin
from app.models.inbox import ContactMessage
from app.schemas.inbox import InboxItem, InboxPage, InboxUpdate
from app.services.audit import log_audit
from app.services.inbox import item_out
from app.utils.net import client_ip
from app.utils.time import utcnow

router = APIRouter(prefix="/api/admin/inbox", tags=["Admin Inbox"])


@router.get("", response_model=InboxPage, summary="Contact messages")
def list_inbox(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    unread: Optional[bool] = Query(None),
    _: Admin = Depends(current_admin),
    db: Session = Depends(get_db),
) -> InboxPage:
    stmt, count = select(ContactMessage), select(func.count(ContactMessage.id))
    if unread is True:
        stmt, count = stmt.where(ContactMessage.read_at.is_(None)), count.where(ContactMessage.read_at.is_(None))
    elif unread is False:
        stmt, count = stmt.where(ContactMessage.read_at.is_not(None)), count.where(ContactMessage.read_at.is_not(None))
    rows = db.scalars(stmt.order_by(ContactMessage.created_at.desc(), ContactMessage.id.desc())
                      .limit(limit).offset(offset)).all()
    unread_total = db.scalar(select(func.count(ContactMessage.id)).where(ContactMessage.read_at.is_(None))) or 0
    return InboxPage(items=[InboxItem(**item_out(m)) for m in rows], total=db.scalar(count) or 0, unread=unread_total)


def _get(db: Session, message_id: int) -> ContactMessage:
    msg = db.get(ContactMessage, message_id)
    if msg is None:
        raise ApiError(404, "Message not found")
    return msg


@router.patch("/{message_id}", response_model=InboxItem, summary="Mark read / unread")
def update_message(
    message_id: int, body: InboxUpdate, request: Request,
    admin: Admin = Depends(current_admin), db: Session = Depends(get_db),
) -> InboxItem:
    msg = _get(db, message_id)
    msg.read_at = (msg.read_at or utcnow()) if body.read else None
    db.commit()
    log_audit(db, action="inbox.update", admin_id=admin.id, target=f"inbox:{message_id}", ip=client_ip(request))
    return InboxItem(**item_out(msg))


@router.delete("/{message_id}", status_code=204, summary="Delete a message")
def delete_message(
    message_id: int, request: Request, admin: Admin = Depends(current_admin), db: Session = Depends(get_db)
) -> Response:
    db.delete(_get(db, message_id))
    db.commit()
    log_audit(db, action="inbox.delete", admin_id=admin.id, target=f"inbox:{message_id}", ip=client_ip(request))
    return Response(status_code=204)
