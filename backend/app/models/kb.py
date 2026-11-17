"""Kirby knowledge-base chunks with their embeddings."""
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Integer, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class KbChunk(Base):
    """One searchable text chunk; `embedding` is a packed float32 array, L2-normalized."""
    __tablename__ = "kb_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String(12), nullable=False)
    section: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    item_id: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    embedding: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    dims: Mapped[int] = mapped_column(Integer, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
