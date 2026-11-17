"""Public Kirby chat endpoint (spec 9.4). Contract unchanged: {reply, conversation_id, section, mood}."""
import threading

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from sqlalchemy.orm import Session

from app.config import get_settings
from app.constants import ID_REGEX, SECTIONS
from app.db import get_db
from app.errors import ApiError
from app.schemas.agent import AgentRequest, AgentResponse
from app.services import chat_log
from app.services.agent import load_persona, run_agent
from app.services.kb import index as kb_index
from app.services.system_kv import get_kv, set_kv
from app.utils.net import client_ip, ip_hash
from app.utils.ratelimit import SlidingWindowLimiter
from app.utils.time import utcnow

router = APIRouter(tags=["Kirby"])

RATE_LIMIT_REPLY = "Whoa, that's a lot of questions! Give me a minute to catch my breath."
kirby_limiter = SlidingWindowLimiter(max_requests=20, window_seconds=600.0)
_daily_lock = threading.Lock()


def _daily_key() -> str:
    return f"kirby_daily:{utcnow():%Y-%m-%d}"


def take_daily_slot(db: Session, cap: int) -> bool:
    """Count one message against today's cap. False when the cap is reached (0 = unlimited)."""
    if cap <= 0:
        return True
    with _daily_lock:
        used = int(get_kv(db, _daily_key(), 0) or 0)
        if used >= cap:
            return False
        set_kv(db, _daily_key(), used + 1)
        return True


@router.post("/api/agent", response_model=AgentResponse, summary="Chat with Kirby")
def agent(req: AgentRequest, request: Request, background: BackgroundTasks, db: Session = Depends(get_db)):
    settings = get_settings()
    persona = load_persona(db)
    if not settings.KIRBY_ENABLED or not settings.OPENROUTER_API_KEY or persona is None or not persona.enabled:
        raise ApiError(503, "Chat is unavailable")
    if req.messages[-1].role != "user":
        raise ApiError(400, "Last message must be from the user")

    cid = req.conversation_id if req.conversation_id and ID_REGEX.match(req.conversation_id) else None
    cid = cid or chat_log.new_conversation_id()
    hashed_ip = ip_hash(client_ip(request))
    visitor = req.visitor_id if req.visitor_id and ID_REGEX.match(req.visitor_id) else None

    keys = [f"ip:{hashed_ip}"] + ([f"v:{visitor}"] if visitor else [])
    if any(kirby_limiter.is_limited(k)[0] for k in keys):
        return AgentResponse(reply=RATE_LIMIT_REPLY, conversation_id=cid, section=None, mood="shy")
    for k in keys:
        kirby_limiter.record(k)

    if not take_daily_slot(db, persona.daily_message_cap):
        reply = f"I'm all talked out for today! The contact section is the best way to reach {persona.owner_name}."
        return AgentResponse(reply=reply, conversation_id=cid, section=None, mood="shy")

    current = req.current_section if req.current_section in SECTIONS else None
    result = run_agent(req.messages, persona, lambda q: kb_index.search(db, q), current_section=current)

    background.add_task(
        chat_log.log_chat_turn, cid, visitor, req.messages[-1].content, result.reply,
        ip_hash=hashed_ip, unanswered=result.unanswered, section=result.section, mood=result.mood,
        model=result.model, latency_ms=result.latency_ms, tokens_in=result.tokens_in, tokens_out=result.tokens_out,
    )
    return AgentResponse(reply=result.reply, conversation_id=cid, section=result.section, mood=result.mood)
