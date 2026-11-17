"""Data retention: purge old analytics, archived chats, dead sessions/tokens and old audit rows (spec 11)."""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict

from sqlalchemy import and_, delete, or_, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import SessionLocal
from app.models.admin import AdminSession, AuditLog, PasswordResetToken
from app.models.analytics import SectionDwellModel, SessionModel
from app.models.chat import ConversationModel, MessageModel
from app.services.system_kv import get_kv, set_kv
from app.utils.time import iso, utcnow

logger = logging.getLogger(__name__)

LAST_PURGE_KEY = "last_purge_at"
PURGE_EVERY = timedelta(hours=24)
CHECK_EVERY_S = 6 * 3600


def purge(db: Session) -> Dict[str, int]:
    """Delete expired data. Returns row counts per category."""
    s = get_settings()
    now = utcnow()
    counts: Dict[str, int] = {}

    old_sessions = select(SessionModel.id).where(SessionModel.last_seen_at < now - timedelta(days=s.ANALYTICS_RETENTION_DAYS))
    db.execute(delete(SectionDwellModel).where(SectionDwellModel.session_id.in_(old_sessions)))
    counts["analytics_sessions"] = db.execute(delete(SessionModel).where(SessionModel.id.in_(old_sessions))).rowcount

    old_chats = select(ConversationModel.id).where(
        ConversationModel.archived.is_(True), ConversationModel.last_at < now - timedelta(days=s.CHAT_RETENTION_DAYS)
    )
    db.execute(delete(MessageModel).where(MessageModel.conversation_id.in_(old_chats)))
    counts["conversations"] = db.execute(delete(ConversationModel).where(ConversationModel.id.in_(old_chats))).rowcount

    dead_cutoff = now - timedelta(days=30)
    counts["admin_sessions"] = db.execute(delete(AdminSession).where(or_(
        AdminSession.expires_at < dead_cutoff,
        and_(AdminSession.revoked_at.is_not(None), AdminSession.revoked_at < dead_cutoff),
    ))).rowcount

    token_cutoff = now - timedelta(days=1)
    counts["reset_tokens"] = db.execute(delete(PasswordResetToken).where(or_(
        and_(PasswordResetToken.used_at.is_not(None), PasswordResetToken.used_at < token_cutoff),
        PasswordResetToken.expires_at < token_cutoff,
    ))).rowcount

    counts["audit_log"] = db.execute(delete(AuditLog).where(AuditLog.created_at < now - timedelta(days=365))).rowcount
    db.commit()
    set_kv(db, LAST_PURGE_KEY, iso(now))
    logger.info("Maintenance purge done: %s", counts)
    return counts


def purge_if_due() -> None:
    db = SessionLocal()
    try:
        last = get_kv(db, LAST_PURGE_KEY)
        last_dt = datetime.fromisoformat(last.rstrip("Z")) if last else None
        if last_dt is None or utcnow() - last_dt >= PURGE_EVERY:
            purge(db)
    except Exception:  # noqa: BLE001 - maintenance must never crash the app
        logger.exception("Maintenance purge failed")
    finally:
        db.close()


async def maintenance_loop() -> None:
    """Run purge_if_due now and every CHECK_EVERY_S seconds until cancelled."""
    while True:
        await asyncio.to_thread(purge_if_due)
        await asyncio.sleep(CHECK_EVERY_S)
