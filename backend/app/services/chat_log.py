"""Asynchronous background persistence of chat conversations and messages."""
import base64
import logging
import os
from typing import Optional

from sqlalchemy.orm import Session

from app.constants import ID_REGEX, MAX_MESSAGE_CHARS
from app.db import get_engine
from app.models.chat import ConversationModel, MessageModel
from app.utils.time import utcnow

logger = logging.getLogger(__name__)


def new_conversation_id() -> str:
    """Generate a high-entropy random URL-safe conversation ID."""
    return base64.urlsafe_b64encode(os.urandom(12)).decode("utf-8").rstrip("=")


def log_chat_turn(
    conversation_id: Optional[str],
    visitor_id: Optional[str],
    user_text: str,
    reply_text: str,
    ip_hash: Optional[str] = None,
    unanswered: bool = False,
    section: Optional[str] = None,
    mood: Optional[str] = None,
    model: Optional[str] = None,
    latency_ms: Optional[int] = None,
    tokens_in: Optional[int] = None,
    tokens_out: Optional[int] = None,
) -> Optional[str]:
    """
    Store user message and assistant reply as an atomic conversation turn.
    Designed for FastAPI BackgroundTasks: exceptions are trapped and logged so the
    live chat experience is never interrupted by database issues.
    """
    try:
        now = utcnow()
        cid = conversation_id if isinstance(conversation_id, str) and ID_REGEX.match(conversation_id) else None
        vid = visitor_id if isinstance(visitor_id, str) and ID_REGEX.match(visitor_id) else None

        engine = get_engine()
        with Session(engine) as db:
            convo = db.get(ConversationModel, cid) if cid else None
            if convo is None:
                cid = cid or new_conversation_id()
                convo = ConversationModel(
                    id=cid,
                    visitor_id=vid,
                    started_at=now,
                    last_at=now,
                    message_count=0,
                    ip_hash=ip_hash,
                )
                db.add(convo)

            convo.last_at = now
            convo.message_count += 2

            user_msg = MessageModel(
                conversation_id=cid,
                role="user",
                content=(user_text or "")[:MAX_MESSAGE_CHARS],
                created_at=now,
                unanswered=unanswered,
            )
            asst_msg = MessageModel(
                conversation_id=cid,
                role="assistant",
                content=(reply_text or "")[:MAX_MESSAGE_CHARS],
                created_at=now,
                section=section,
                mood=mood,
                model=model,
                latency_ms=latency_ms,
                tokens_in=tokens_in,
                tokens_out=tokens_out,
            )
            db.add(user_msg)
            db.add(asst_msg)
            db.commit()
            return cid

    except Exception as e:
        logger.error("Failed to log chat turn for conversation %s: %s", conversation_id, e)
        return None
