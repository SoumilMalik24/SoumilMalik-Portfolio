"""Publishing drafts, revision history and the post-publish job (spec 7.5)."""
import logging
import time
from datetime import timezone
from typing import Dict, List, Optional

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.constants import CONTENT_KEYS, KB_KEYS
from app.db import SessionLocal
from app.errors import ApiError
from app.models.content import ContentRevision, ContentSection, Publish
from app.services import deploy_hook
from app.services.content import validate_section
from app.services.public_content import clear_cache
from app.utils.time import iso, utcnow

logger = logging.getLogger(__name__)

MAX_REVISIONS_PER_SECTION = 50
POLL_INTERVAL_S = 10.0
POLL_TIMEOUT_S = 600.0


def publish_out(pub: Publish) -> Dict:
    return {
        "id": pub.id,
        "sections": list(pub.sections or []),
        "reindex_status": pub.reindex_status,
        "deploy_status": pub.deploy_status,
        "deploy_ref": pub.deploy_ref,
        "error": pub.error,
        "created_at": iso(pub.created_at),
        "finished_at": iso(pub.finished_at),
    }


def add_revision(
    db: Session, key: str, data: Dict, kind: str, admin_id: Optional[int], publish_id: Optional[int] = None
) -> None:
    """Insert a revision and keep only the newest MAX_REVISIONS_PER_SECTION for that section (no commit)."""
    db.add(ContentRevision(
        section_key=key, data=data, kind=kind, publish_id=publish_id, admin_id=admin_id, created_at=utcnow(),
    ))
    db.flush()
    stale = db.scalars(
        select(ContentRevision.id)
        .where(ContentRevision.section_key == key)
        .order_by(ContentRevision.created_at.desc(), ContentRevision.id.desc())
        .offset(MAX_REVISIONS_PER_SECTION)
    ).all()
    if stale:
        db.execute(delete(ContentRevision).where(ContentRevision.id.in_(stale)))


def _keys_to_publish(rows: Dict[str, ContentSection], requested: Optional[List[str]]) -> List[str]:
    if requested is not None:
        unknown = [k for k in requested if k not in CONTENT_KEYS]
        if unknown:
            raise ApiError(422, "Validation failed",
                           errors=[{"field": "sections", "msg": f"Unknown section: {k}"} for k in unknown])
        candidates = [k for k in CONTENT_KEYS if k in set(requested)]
    else:
        candidates = list(CONTENT_KEYS)
    return [k for k in candidates if k in rows and rows[k].draft != rows[k].published]


def publish_sections(db: Session, requested: Optional[List[str]], admin_id: Optional[int]) -> Publish:
    """Validate and publish dirty drafts atomically. Raises 409 when nothing is dirty, 422 on invalid drafts."""
    rows = {r.key: r for r in db.scalars(select(ContentSection)).all()}
    keys = _keys_to_publish(rows, requested)
    if not keys:
        raise ApiError(409, "Nothing to publish")

    normalized: Dict[str, Dict] = {}
    errors: List[Dict[str, str]] = []
    for key in keys:
        try:
            normalized[key] = validate_section(db, key, rows[key].draft, prefix=key)
        except ApiError as exc:
            errors.extend(exc.errors or [{"field": key, "msg": exc.detail}])
    if errors:
        raise ApiError(422, "Validation failed", errors=errors)

    now = utcnow()
    pub = Publish(
        sections=keys,
        admin_id=admin_id,
        reindex_status="pending" if any(k in KB_KEYS for k in keys) else "skipped",
        deploy_status="pending" if deploy_hook.hook_configured() else "disabled",
        created_at=now,
    )
    db.add(pub)
    db.flush()
    for key in keys:
        row = rows[key]
        row.published = normalized[key]
        row.published_at = now
        add_revision(db, key, normalized[key], "publish", admin_id, pub.id)
    db.commit()
    db.refresh(pub)
    clear_cache()
    return pub


def prepare_redeploy(db: Session, pub: Publish) -> Publish:
    if not deploy_hook.hook_configured():
        raise ApiError(409, "Deploy hook not configured")
    pub.deploy_status = "pending"
    pub.deploy_ref = None
    pub.finished_at = None
    db.commit()
    db.refresh(pub)
    return pub


def run_reindex_for_publish(db: Session, pub: Publish) -> None:
    """Re-index Kirby's knowledge after a publish. Raises on failure (caller records it)."""
    from app.services.kb import index as kb_index

    kb_index.reindex(db)
    db.refresh(pub)
    pub.reindex_status = "done"


def _append_error(current: Optional[str], message: str) -> str:
    return f"{current}\n{message}" if current else message


def _run_deploy(db: Session, pub: Publish) -> None:
    try:
        pub.deploy_ref = deploy_hook.trigger()
        pub.deploy_status = "triggered"
    except deploy_hook.DeployHookError as exc:
        pub.deploy_status = "failed"
        pub.error = _append_error(pub.error, str(exc))
        db.commit()
        return
    db.commit()

    if not deploy_hook.polling_configured():
        return
    since_ms = int(pub.created_at.replace(tzinfo=timezone.utc).timestamp() * 1000)
    deadline = time.monotonic() + POLL_TIMEOUT_S
    while time.monotonic() < deadline:
        time.sleep(POLL_INTERVAL_S)
        try:
            status = deploy_hook.latest_status(since_ms)
        except deploy_hook.DeployHookError as exc:
            logger.warning("Vercel status check failed for publish %s: %s", pub.id, exc)
            continue
        if status and status != pub.deploy_status:
            pub.deploy_status = status
            db.commit()
        if status in ("ready", "failed"):
            return


def run_post_publish(publish_id: int, deploy_only: bool = False) -> None:
    """Background job: Kirby re-index, then deploy hook. Uses its own session and never raises."""
    db = SessionLocal()
    try:
        pub = db.get(Publish, publish_id)
        if pub is None:
            return
        if not deploy_only and pub.reindex_status == "pending":
            pub.reindex_status = "running"
            db.commit()
            try:
                run_reindex_for_publish(db, pub)
            except Exception as exc:  # noqa: BLE001 - job must not crash
                logger.exception("Re-index failed for publish %s", publish_id)
                pub.reindex_status = "failed"
                pub.error = _append_error(pub.error, f"Re-index failed: {exc}")
            db.commit()
        if pub.deploy_status != "disabled":
            _run_deploy(db, pub)
        pub.finished_at = utcnow()
        db.commit()
    except Exception:  # noqa: BLE001
        logger.exception("Post-publish job crashed for publish %s", publish_id)
    finally:
        db.close()
