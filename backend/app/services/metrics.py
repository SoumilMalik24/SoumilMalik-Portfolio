"""Aggregated dashboard analytics computation for the admin panel."""
from collections import defaultdict
from datetime import datetime, timedelta
import re
from typing import Any, Dict

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.constants import SECTIONS
from app.models.analytics import SessionModel
from app.models.chat import MessageModel
from app.models.content import Publish
from app.utils.time import iso, utcnow


def compute_metrics(db: Session, days: int = 7, tz: int = 0) -> Dict[str, Any]:
    """
    Compute aggregated analytics metrics over the last `days` local calendar days.

    Args:
        db: SQLAlchemy session
        days: Number of calendar days to include (1-90)
        tz: Client timezone offset in minutes from UTC (-840 to +840)
    """
    days = max(1, min(90, days))
    tz = max(-840, min(840, tz))

    now_utc = utcnow()
    local_now = now_utc + timedelta(minutes=tz)
    local_today = local_now.date()

    oldest_day = local_today - timedelta(days=days - 1)
    local_range_start = datetime(oldest_day.year, oldest_day.month, oldest_day.day, 0, 0, 0)
    range_start_utc = local_range_start - timedelta(minutes=tz)

    local_tomorrow = local_today + timedelta(days=1)
    local_range_end = datetime(local_tomorrow.year, local_tomorrow.month, local_tomorrow.day, 0, 0, 0)
    range_end_utc = local_range_end - timedelta(minutes=tz)

    # Equal-length previous comparison window
    prev_start_utc = range_start_utc - timedelta(days=days)
    prev_end_utc = range_start_utc

    # Live sessions: active within the last 5 minutes
    five_min_ago = now_utc - timedelta(minutes=5)
    live_count = (
        db.scalar(
            select(func.count(SessionModel.id)).where(SessionModel.last_seen_at >= five_min_ago)
        )
        or 0
    )

    # In-range sessions with section dwell relationships
    in_range_sessions = db.scalars(
        select(SessionModel)
        .options(selectinload(SessionModel.section_dwells))
        .where(SessionModel.started_at >= range_start_utc, SessionModel.started_at < range_end_utc)
    ).all()

    # Previous period sessions for trend comparisons
    prev_sessions = db.scalars(
        select(SessionModel).where(
            SessionModel.started_at >= prev_start_utc, SessionModel.started_at < prev_end_utc
        )
    ).all()

    # Current totals computation
    sessions_count = len(in_range_sessions)
    visitors_set = set(s.visitor_id for s in in_range_sessions)
    visitors_count = len(visitors_set)

    if sessions_count > 0:
        avg_duration_s = round(sum(s.duration_ms for s in in_range_sessions) / sessions_count / 1000.0, 1)
        bounces = sum(1 for s in in_range_sessions if s.duration_ms < 10000 and s.max_scroll_pct < 20)
        bounce_rate = round(bounces / sessions_count, 2)
        avg_scroll_pct = round(sum(s.max_scroll_pct for s in in_range_sessions) / sessions_count, 1)
    else:
        avg_duration_s = 0.0
        bounce_rate = 0.0
        avg_scroll_pct = 0.0

    returning_visitors_set = set(s.visitor_id for s in in_range_sessions if s.is_returning)
    returning_visitors_count = len(returning_visitors_set)
    returning_visitor_rate = (
        round(returning_visitors_count / visitors_count, 2) if visitors_count > 0 else 0.0
    )

    totals = {
        "visitors": visitors_count,
        "sessions": sessions_count,
        "avg_duration_s": avg_duration_s,
        "bounce_rate": bounce_rate,
        "returning_visitor_rate": returning_visitor_rate,
        "avg_scroll_pct": avg_scroll_pct,
    }

    # Previous totals computation
    prev_sessions_count = len(prev_sessions)
    prev_visitors_count = len(set(s.visitor_id for s in prev_sessions))
    if prev_sessions_count > 0:
        prev_avg_duration_s = round(
            sum(s.duration_ms for s in prev_sessions) / prev_sessions_count / 1000.0, 1
        )
        prev_bounces = sum(
            1 for s in prev_sessions if s.duration_ms < 10000 and s.max_scroll_pct < 20
        )
        prev_bounce_rate = round(prev_bounces / prev_sessions_count, 2)
    else:
        prev_avg_duration_s = 0.0
        prev_bounce_rate = 0.0

    prev_totals = {
        "visitors": prev_visitors_count,
        "sessions": prev_sessions_count,
        "avg_duration_s": prev_avg_duration_s,
        "bounce_rate": prev_bounce_rate,
    }

    # Daily zero-filled bucketing by local timezone (oldest -> newest)
    calendar_days = [oldest_day + timedelta(days=i) for i in range(days)]
    daily_map = {d.isoformat(): {"sessions": 0, "visitors": set()} for d in calendar_days}

    for s in in_range_sessions:
        local_s_dt = s.started_at + timedelta(minutes=tz)
        d_str = local_s_dt.date().isoformat()
        if d_str in daily_map:
            daily_map[d_str]["sessions"] += 1
            daily_map[d_str]["visitors"].add(s.visitor_id)

    daily = [
        {"date": d_str, "sessions": info["sessions"], "visitors": len(info["visitors"])}
        for d_str, info in daily_map.items()
    ]

    # Section funnel & dwell computation
    sec_index = {sec: i for i, sec in enumerate(SECTIONS)}
    session_furthest: dict[str, str] = {}
    for s in in_range_sessions:
        furthest = None
        max_idx = -1
        for sd in s.section_dwells:
            if sd.section in sec_index and sd.dwell_ms > 0:
                idx = sec_index[sd.section]
                if idx > max_idx:
                    max_idx = idx
                    furthest = sd.section
        if furthest is not None:
            session_furthest[s.id] = furthest

    sections_list = []
    for sec in SECTIONS:
        reached_sessions = [
            s
            for s in in_range_sessions
            if any(sd.section == sec and sd.dwell_ms > 0 for sd in s.section_dwells)
        ]
        reached = len(reached_sessions)
        reached_pct = round(reached / sessions_count * 100.0, 1) if sessions_count > 0 else 0.0

        if reached > 0:
            total_dwell_ms = sum(
                sd.dwell_ms
                for s in reached_sessions
                for sd in s.section_dwells
                if sd.section == sec
            )
            avg_dwell_s = round(total_dwell_ms / reached / 1000.0, 1)
        else:
            avg_dwell_s = 0.0

        exit_count = sum(1 for s_id, f_sec in session_furthest.items() if f_sec == sec)
        exit_pct = round(exit_count / sessions_count * 100.0, 1) if sessions_count > 0 else 0.0

        sections_list.append(
            {
                "name": sec,
                "reached": reached,
                "reached_pct": reached_pct,
                "avg_dwell_s": avg_dwell_s,
                "exit_pct": exit_pct,
            }
        )

    # best_section: section with highest avg_dwell_s excluding 'hero', requiring reached >= 1
    candidates = [sec for sec in sections_list if sec["name"] != "hero" and sec["reached"] >= 1]
    best_section = (
        max(candidates, key=lambda s: s["avg_dwell_s"])["name"] if candidates else None
    )

    # Devices computation
    devices = {"desktop": 0, "mobile": 0, "tablet": 0}
    for s in in_range_sessions:
        if s.device in devices:
            devices[s.device] += 1

    # Referrers computation (top 8 by session count)
    ref_counts: dict[str, int] = defaultdict(int)
    for s in in_range_sessions:
        ref_counts[s.referrer] += 1

    sorted_refs = sorted(ref_counts.items(), key=lambda item: (-item[1], item[0]))[:8]
    referrers = [{"source": src, "sessions": cnt} for src, cnt in sorted_refs]

    # Visitor mix
    visitor_mix = {
        "new": visitors_count - returning_visitors_count,
        "returning": returning_visitors_count,
    }

    return {
        "range_days": days,
        "generated_at": now_utc.isoformat(),
        "live": live_count,
        "totals": totals,
        "prev_totals": prev_totals,
        "daily": daily,
        "sections": sections_list,
        "best_section": best_section,
        "devices": devices,
        "referrers": referrers,
        "visitor_mix": visitor_mix,
        "kirby": kirby_metrics(db, range_start_utc, range_end_utc, tz, oldest_day, days),
        "publishes": [
            {"id": pid, "created_at": iso(created)}
            for pid, created in db.execute(
                select(Publish.id, Publish.created_at)
                .where(Publish.created_at >= range_start_utc, Publish.created_at < range_end_utc)
                .order_by(Publish.id)
            ).all()
        ],
    }


def kirby_metrics(db: Session, start_utc: datetime, end_utc: datetime, tz: int, oldest_day, days: int) -> Dict[str, Any]:
    """Chat activity in the range: totals, unanswered rate, per-day counts, top questions, navigations."""
    msgs = db.execute(
        select(MessageModel.conversation_id, MessageModel.role, MessageModel.content,
               MessageModel.unanswered, MessageModel.section, MessageModel.created_at)
        .where(MessageModel.created_at >= start_utc, MessageModel.created_at < end_utc)
    ).all()

    per_day: Dict[str, Dict[str, Any]] = {
        (oldest_day + timedelta(days=i)).isoformat(): {"conversations": set(), "messages": 0} for i in range(days)
    }
    questions: Dict[str, Dict[str, Any]] = {}
    navigations: Dict[str, int] = defaultdict(int)
    conversations: set = set()
    user_msgs = unanswered = 0

    for cid, role, content, flagged, section, created in msgs:
        conversations.add(cid)
        day = (created + timedelta(minutes=tz)).date().isoformat()
        if day in per_day:
            per_day[day]["conversations"].add(cid)
            per_day[day]["messages"] += 1
        if role == "user":
            user_msgs += 1
            unanswered += 1 if flagged else 0
            key = " ".join(re.sub(r"[^\w\s]", " ", content.lower()).split())
            if key:
                q = questions.setdefault(key, {"question": content.strip()[:300], "count": 0})
                q["count"] += 1
        elif section:
            navigations[section] += 1

    top = sorted(questions.values(), key=lambda q: -q["count"])[:10]
    return {
        "conversations": len(conversations),
        "messages": len(msgs),
        "unanswered_rate": round(unanswered / user_msgs, 3) if user_msgs else 0.0,
        "daily": [{"date": d, "conversations": len(v["conversations"]), "messages": v["messages"]}
                  for d, v in per_day.items()],
        "top_questions": top,
        "navigations": dict(navigations),
    }
