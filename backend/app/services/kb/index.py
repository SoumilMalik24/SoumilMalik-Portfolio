"""Kirby knowledge index: incremental re-index into kb_chunks and in-memory cosine search (spec 9.3)."""
import hashlib
import logging
import threading
from array import array
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.constants import KB_KEYS
from app.errors import ApiError
from app.models.content import ContentSection
from app.models.kb import KbChunk
from app.services.kb.chunker import Chunk, build_chunks
from app.services.kb.embeddings import Embedder, get_embedder
from app.services.system_kv import get_kv, set_kv
from app.utils.time import iso, utcnow

logger = logging.getLogger(__name__)

STATUS_KEY = "kb_status"
_reindex_lock = threading.Lock()


@dataclass
class CachedChunk:
    text: str
    section: Optional[str]
    vector: array


class _VectorCache:
    """Process-wide snapshot of all chunk vectors. Replaced atomically after a re-index."""

    def __init__(self) -> None:
        self.chunks: Optional[List[CachedChunk]] = None
        self.model_id: Optional[str] = None
        self.lock = threading.Lock()

    def clear(self) -> None:
        with self.lock:
            self.chunks, self.model_id = None, None


cache = _VectorCache()


def _pack(vec: List[float]) -> bytes:
    return array("f", vec).tobytes()


def _unpack(blob: bytes) -> array:
    vec = array("f")
    vec.frombytes(blob)
    return vec


def chunk_hash(model_id: str, text: str) -> str:
    return hashlib.sha256(f"{model_id}\n{text}".encode("utf-8")).hexdigest()


def published_sections(db: Session) -> Dict[str, Any]:
    rows = db.scalars(select(ContentSection).where(ContentSection.key.in_(KB_KEYS))).all()
    return {r.key: r.published for r in rows if r.published is not None}


def default_status() -> Dict[str, Any]:
    return {"status": "idle", "chunks": 0, "last_indexed_at": None, "last_error": None, "model": None}


def get_status(db: Session) -> Dict[str, Any]:
    return {**default_status(), **(get_kv(db, STATUS_KEY) or {})}


def _set_status(db: Session, **changes: Any) -> None:
    set_kv(db, STATUS_KEY, {**get_status(db), **changes})


def is_running() -> bool:
    return _reindex_lock.locked()


def reindex(db: Session, embedder: Optional[Embedder] = None) -> Dict[str, Any]:
    """Rebuild kb_chunks from published content, embedding only new texts. Raises on embedding failure."""
    if not _reindex_lock.acquire(blocking=False):
        raise ApiError(409, "Re-index already running")
    try:
        embedder = embedder or get_embedder()
        _set_status(db, status="running", last_error=None)
        try:
            embedded = _reindex_locked(db, embedder)
        except Exception as exc:
            db.rollback()
            _set_status(db, status="failed", last_error=str(exc)[:500])
            raise
        total = len(db.scalars(select(KbChunk.id)).all())
        _set_status(db, status="idle", chunks=total, last_indexed_at=iso(utcnow()), model=embedder.model_id)
        load_cache(db)
        logger.info("Kirby re-index done: %d chunks, %d newly embedded", total, embedded)
        return {"chunks": total, "embedded": embedded}
    finally:
        _reindex_lock.release()


def _reindex_locked(db: Session, embedder: Embedder) -> int:
    wanted: List[Tuple[str, Chunk]] = []
    seen = set()
    for chunk in build_chunks(published_sections(db)):
        h = chunk_hash(embedder.model_id, chunk.text)
        key = (chunk.source, chunk.section, chunk.item_id, h)
        if key not in seen:
            seen.add(key)
            wanted.append((h, chunk))

    existing = {
        (row.source, row.section, row.item_id, row.content_hash): row.id
        for row in db.scalars(select(KbChunk)).all()
    }
    keep_ids = {existing[k] for k in seen if k in existing}
    to_embed = [(h, c) for h, c in wanted if (c.source, c.section, c.item_id, h) not in existing]

    vectors = embedder.embed([c.text for _, c in to_embed]) if to_embed else []

    now = utcnow()
    stale_ids = [i for i in existing.values() if i not in keep_ids]
    if stale_ids:
        db.execute(delete(KbChunk).where(KbChunk.id.in_(stale_ids)))
    for (h, c), vec in zip(to_embed, vectors):
        db.add(KbChunk(source=c.source, section=c.section, item_id=c.item_id, text=c.text,
                       content_hash=h, embedding=_pack(vec), dims=len(vec), updated_at=now))
    db.commit()
    return len(to_embed)


def load_cache(db: Session) -> int:
    """Load every stored chunk vector into memory."""
    rows = db.scalars(select(KbChunk)).all()
    chunks = [CachedChunk(r.text, r.section, _unpack(r.embedding)) for r in rows]
    with cache.lock:
        cache.chunks = chunks
        cache.model_id = get_status(db).get("model")
    return len(chunks)


def _dot(a: array, b: List[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def search(db: Session, query: str, k: int = 5, embedder: Optional[Embedder] = None) -> List[Tuple[float, str, Optional[str]]]:
    """Return the top-k (score, text, section) by cosine similarity."""
    if cache.chunks is None:
        load_cache(db)
    chunks = cache.chunks or []
    if not chunks or not query.strip():
        return []
    qvec = (embedder or get_embedder()).embed([query])[0]
    scored = sorted(((_dot(c.vector, qvec), c.text, c.section) for c in chunks), key=lambda t: t[0], reverse=True)
    return scored[:k]



# Warm-up state reported by /api/status: loading -> ready | error.
warm_state = {"state": "loading", "error": None}


def warm_up() -> None:
    """Load the vector cache in the background at startup."""
    from app.db import SessionLocal

    db = SessionLocal()
    try:
        load_cache(db)
        warm_state.update(state="ready", error=None)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Kirby warm-up failed: %s", exc)
        warm_state.update(state="error", error=str(exc)[:300])
    finally:
        db.close()


def kirby_state() -> str:
    """off | loading | ready | error, for /api/status."""
    from app.config import get_settings

    s = get_settings()
    if not s.KIRBY_ENABLED or not s.OPENROUTER_API_KEY:
        return "off"
    if cache.chunks is not None:
        return "ready"
    return warm_state["state"]
