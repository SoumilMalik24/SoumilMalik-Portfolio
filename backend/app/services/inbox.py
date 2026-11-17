"""Contact form storage and admin notification."""
import html
import logging
import re
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import SessionLocal
from app.models.admin import Admin
from app.models.inbox import ContactMessage
from app.services.mailer import send_email
from app.utils.time import iso

logger = logging.getLogger(__name__)

_NEWLINES = re.compile(r"[\r\n]+")


def item_out(m: ContactMessage) -> dict:
    return {"id": m.id, "name": m.name, "email": m.email, "subject": m.subject, "body": m.body,
            "read": m.read_at is not None, "created_at": iso(m.created_at)}


def notify_recipient(db: Session) -> Optional[str]:
    configured = get_settings().ADMIN_NOTIFY_EMAIL
    if configured:
        return configured
    return db.scalar(select(Admin.email).where(Admin.is_active.is_(True)).order_by(Admin.id).limit(1))


def send_notification(message_id: int) -> None:
    """Email the admin about a new contact message. Never raises."""
    db = SessionLocal()
    try:
        msg = db.get(ContactMessage, message_id)
        to = notify_recipient(db) if msg else None
        if not msg or not to:
            return
        sender = f"{msg.name} <{msg.email}>" if msg.name else msg.email
        text = f"New message from {sender}\n\nSubject: {msg.subject}\n\n{msg.body}"
        body_html = (
            f"<p><b>From:</b> {html.escape(sender)}</p><p><b>Subject:</b> {html.escape(msg.subject)}</p>"
            f"<p style='white-space:pre-wrap'>{html.escape(msg.body)}</p>"
        )
        subject = _NEWLINES.sub(" ", f"[Portfolio] {msg.subject}")[:200]  # no header injection
        send_email(to, subject, text, body_html, reply_to=msg.email)
    except Exception:  # noqa: BLE001
        logger.exception("Contact notification failed for message %s", message_id)
    finally:
        db.close()
