"""Public telemetry and visitor interaction tracking endpoint."""
import json
import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends, Request
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.constants import BOT_REGEX, ID_REGEX, SECTIONS
from app.db import get_db
from app.services import tracking
from app.services.tracking import safe_int
from app.utils.net import client_ip

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Telemetry"])


@router.post("/api/track", summary="Record visitor session interaction snapshot")
async def track(request: Request, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Public telemetry ingestion endpoint.
    Accepts cumulative snapshots via navigator.sendBeacon or fetch.
    Returns 200 {"ok": True} unconditionally to ensure client unblocking.
    """
    body_bytes = await request.body()
    if len(body_bytes) > 8192 or not body_bytes:
        return {"ok": True}

    try:
        data = json.loads(body_bytes.decode("utf-8"))
        if not isinstance(data, dict):
            return {"ok": True}
    except Exception:
        return {"ok": True}

    ip = client_ip(request)
    if not tracking.check_and_record_track_throttle(ip):
        return {"ok": True}

    ua = request.headers.get("user-agent", "")
    if BOT_REGEX.search(ua):
        return {"ok": True}

    visitor_id = data.get("visitor_id")
    session_id = data.get("session_id")
    if not isinstance(visitor_id, str) or not ID_REGEX.match(visitor_id):
        return {"ok": True}
    if not isinstance(session_id, str) or not ID_REGEX.match(session_id):
        return {"ok": True}

    duration_ms = max(0, min(21_600_000, safe_int(data.get("duration_ms"), 0)))
    max_scroll_pct = max(0, min(100, safe_int(data.get("max_scroll_pct"), 0)))

    incoming_sections = data.get("sections")
    clamped_sections: dict[str, int] = {}
    if isinstance(incoming_sections, dict):
        for sec, dwell in incoming_sections.items():
            if sec in SECTIONS:
                clamped_sections[sec] = max(0, min(1_800_000, safe_int(dwell, 0)))

    try:
        await run_in_threadpool(
            tracking.record_snapshot,
            db,
            visitor_id,
            session_id,
            duration_ms,
            max_scroll_pct,
            clamped_sections,
            data.get("referrer"),
            request.headers.get("origin"),
            request.headers.get("host"),
            data.get("device"),
            ua,
        )
    except Exception as e:
        logger.warning("Telemetry recording failed: %s", e)
        db.rollback()

    return {"ok": True}
