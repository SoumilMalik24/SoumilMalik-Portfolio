"""Admin system overview (spec 7.12)."""
import platform

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.constants import APP_VERSION
from app.db import get_db
from app.deps import current_admin
from app.models.admin import Admin
from app.models.analytics import SessionModel
from app.models.chat import ConversationModel, MessageModel
from app.models.content import Asset, Publish
from app.models.inbox import ContactMessage
from app.services.kb import index as kb_index
from app.services.maintenance import LAST_PURGE_KEY
from app.services.publish import publish_out
from app.services.system_kv import get_kv
from app.utils.time import iso, utcnow

router = APIRouter(prefix="/api/admin", tags=["Admin System"])


@router.get("/system", summary="Runtime, storage and data overview")
def system(request: Request, _: Admin = Depends(current_admin), db: Session = Depends(get_db)) -> dict:
    booted_at = getattr(request.app.state, "booted_at", None) or utcnow()
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:  # noqa: BLE001
        db_ok = False
    count = lambda col, *where: db.scalar(select(func.count(col)).where(*where)) or 0  # noqa: E731
    last_publish = db.scalar(select(Publish).order_by(Publish.id.desc()).limit(1))
    return {
        "booted_at": iso(booted_at),
        "uptime_s": round((utcnow() - booted_at).total_seconds(), 1),
        "version": APP_VERSION,
        "python": platform.python_version(),
        "db": {"ok": db_ok, "dialect": db.get_bind().dialect.name},
        "kirby": {**kb_index.get_status(db), "state": kb_index.kirby_state()},
        "storage": {
            "backend": get_settings().STORAGE_BACKEND,
            "assets": count(Asset.id),
            "bytes": db.scalar(select(func.coalesce(func.sum(Asset.bytes), 0))) or 0,
        },
        "last_publish": publish_out(last_publish) if last_publish else None,
        "maintenance": {"last_purge_at": get_kv(db, LAST_PURGE_KEY)},
        "counts": {
            "conversations": count(ConversationModel.id),
            "messages": count(MessageModel.id),
            "analytics_sessions": count(SessionModel.id),
            "inbox_unread": count(ContactMessage.id, ContactMessage.read_at.is_(None)),
        },
    }
