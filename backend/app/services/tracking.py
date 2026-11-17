"""Telemetry ingestion, rate limiting, and session dwell upsert logic."""
import logging
import threading
import time
from collections import defaultdict, deque
from typing import Any, Optional
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.analytics import SectionDwellModel, SessionModel
from app.utils.time import utcnow

logger = logging.getLogger(__name__)

# ── Per-IP throttle for telemetry ingest endpoint ─────────────────────────────
_track_throttle_lock = threading.Lock()
_track_ip_history: dict[str, deque[float]] = defaultdict(deque)


def check_and_record_track_throttle(
    ip: str, max_requests: int = 120, window_seconds: float = 600.0
) -> bool:
    """
    Limits telemetry requests per IP within sliding window (default 120 requests / 10 min).
    Returns True if request is allowed, False if throttled.
    """
    now = time.monotonic()
    cutoff = now - window_seconds
    with _track_throttle_lock:
        if len(_track_ip_history) > 5000:
            for key in [k for k, v in _track_ip_history.items() if not v or v[-1] < cutoff]:
                del _track_ip_history[key]

        history = _track_ip_history[ip]
        while history and history[0] < cutoff:
            history.popleft()

        if len(history) >= max_requests:
            return False

        history.append(now)
        return True


# ── Request parsing helpers ──────────────────────────────────────────────────

def parse_referrer(
    referrer_val: Any,
    origin_hdr: Optional[str] = None,
    host_hdr: Optional[str] = None,
) -> str:
    """Extract clean domain name from referrer, treating self-referrals as 'direct'."""
    if not isinstance(referrer_val, str) or not referrer_val.strip():
        return "direct"
    ref = referrer_val.strip()
    if ref.lower() == "direct":
        return "direct"

    if "://" not in ref:
        ref = "http://" + ref

    try:
        parsed = urlparse(ref)
        hostname = parsed.hostname
        if not hostname:
            return "direct"
        hostname = hostname.lower()

        origin_host = None
        if origin_hdr:
            orig = origin_hdr.strip()
            if "://" not in orig:
                orig = "http://" + orig
            origin_host = urlparse(orig).hostname
        elif host_hdr:
            origin_host = host_hdr.split(":")[0].strip()

        if origin_host and hostname == origin_host.lower():
            return "direct"

        return hostname[:255]
    except Exception:
        return "direct"


def parse_device(device_val: Any, user_agent: str) -> str:
    """Determine client device category: desktop, mobile, or tablet."""
    if isinstance(device_val, str):
        dev = device_val.lower().strip()
        if dev in ("mobile", "tablet", "desktop"):
            return dev

    ua = (user_agent or "").lower()
    if "ipad" in ua or "tablet" in ua or ("android" in ua and "mobile" not in ua):
        return "tablet"
    if "mobile" in ua or "iphone" in ua or "ipod" in ua or "android" in ua:
        return "mobile"
    return "desktop"


def safe_int(val: Any, default: int = 0) -> int:
    """Convert input to integer safely with fallback default."""
    try:
        return int(val)
    except (TypeError, ValueError):
        return default


# ── Persistence ──────────────────────────────────────────────────────────────

def record_snapshot(
    db: Session,
    visitor_id: str,
    session_id: str,
    duration_ms: int,
    max_scroll_pct: int,
    clamped_sections: dict[str, int],
    referrer_raw: Any,
    origin: Optional[str],
    host: Optional[str],
    device_raw: Any,
    ua: str,
) -> None:
    """
    Upsert one cumulative session telemetry snapshot.
    Runs in worker threadpool to avoid blocking async event loop.
    """
    now = utcnow()

    try:
        stmt = (
            select(SessionModel)
            .options(selectinload(SessionModel.section_dwells))
            .where(SessionModel.id == session_id)
        )
        session = db.scalars(stmt).first()

        if session is None:
            # First insert for this session
            other_session = db.scalars(
                select(SessionModel.id).where(SessionModel.visitor_id == visitor_id).limit(1)
            ).first()
            is_returning = other_session is not None

            referrer = parse_referrer(referrer_raw, origin, host)
            device = parse_device(device_raw, ua)

            session = SessionModel(
                id=session_id,
                visitor_id=visitor_id,
                started_at=now,
                last_seen_at=now,
                referrer=referrer,
                device=device,
                is_returning=is_returning,
                duration_ms=duration_ms,
                max_scroll_pct=max_scroll_pct,
            )
            db.add(session)

            for sec, dwell in clamped_sections.items():
                dwell_record = SectionDwellModel(
                    session_id=session_id,
                    section=sec,
                    dwell_ms=dwell,
                )
                db.add(dwell_record)

            db.commit()
        else:
            # Existing session - update cumulative max values
            session.last_seen_at = now
            session.duration_ms = max(session.duration_ms, duration_ms)
            session.max_scroll_pct = max(session.max_scroll_pct, max_scroll_pct)

            existing_dwells = {sd.section: sd for sd in session.section_dwells}
            for sec, dwell in clamped_sections.items():
                if sec in existing_dwells:
                    existing_dwells[sec].dwell_ms = max(existing_dwells[sec].dwell_ms, dwell)
                else:
                    new_dwell = SectionDwellModel(
                        session_id=session_id,
                        section=sec,
                        dwell_ms=dwell,
                    )
                    db.add(new_dwell)

            db.commit()

    except Exception as e:
        logger.error("Failed to record telemetry snapshot for session %s: %s", session_id, e)
        db.rollback()
        raise
