"""Public contact form (spec 10)."""
from fastapi import APIRouter, BackgroundTasks, Depends, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import ApiError
from app.models.inbox import ContactMessage
from app.schemas.inbox import ContactRequest, ContactResponse
from app.services.inbox import send_notification
from app.utils.net import client_ip, ip_hash
from app.utils.ratelimit import SlidingWindowLimiter
from app.utils.time import utcnow

router = APIRouter(tags=["Contact"])

contact_limiter = SlidingWindowLimiter(max_requests=3, window_seconds=3600.0)


@router.post("/api/contact", response_model=ContactResponse, summary="Send a message to the site owner")
def contact(body: ContactRequest, request: Request, background: BackgroundTasks, db: Session = Depends(get_db)):
    if body.website:  # honeypot filled in: pretend success, store nothing
        return ContactResponse()
    hashed = ip_hash(client_ip(request))
    allowed, retry_after = contact_limiter.check_and_record(hashed or "unknown")
    if not allowed:
        raise ApiError(429, "Too many messages. Please try again later.", headers={"Retry-After": str(retry_after)})

    msg = ContactMessage(name=body.name or None, email=str(body.email), subject=body.subject, body=body.message,
                         ip_hash=hashed, created_at=utcnow())
    db.add(msg)
    db.commit()
    background.add_task(send_notification, msg.id)
    return ContactResponse()
