"""Content sections, publish history, revisions and uploaded assets."""
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import JSONType
from app.models.base import Base


class ContentSection(Base):
    """One editable section of site content, with a draft and a published copy."""
    __tablename__ = "content_sections"

    key: Mapped[str] = mapped_column(String(32), primary_key=True)
    draft: Mapped[Any] = mapped_column(JSONType, nullable=False)
    published: Mapped[Optional[Any]] = mapped_column(JSONType, nullable=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    draft_updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class Publish(Base):
    """A publish event; its id doubles as the public content version."""
    __tablename__ = "publishes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sections: Mapped[Any] = mapped_column(JSONType, nullable=False)
    admin_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("admins.id", ondelete="SET NULL"), nullable=True
    )
    reindex_status: Mapped[str] = mapped_column(String(12), nullable=False)
    deploy_status: Mapped[str] = mapped_column(String(12), nullable=False)
    deploy_ref: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class ContentRevision(Base):
    """Snapshot of a section taken on publish or import."""
    __tablename__ = "content_revisions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    section_key: Mapped[str] = mapped_column(
        ForeignKey("content_sections.key", ondelete="CASCADE"), index=True, nullable=False
    )
    data: Mapped[Any] = mapped_column(JSONType, nullable=False)
    kind: Mapped[str] = mapped_column(String(10), nullable=False)
    publish_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("publishes.id", ondelete="SET NULL"), nullable=True
    )
    admin_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("admins.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class Asset(Base):
    """An uploaded file (image or resume) stored locally or on Cloudinary."""
    __tablename__ = "assets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    kind: Mapped[str] = mapped_column(String(10), nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    storage_id: Mapped[str] = mapped_column(String(255), nullable=False)
    mime: Mapped[str] = mapped_column(String(50), nullable=False)
    bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    width: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    height: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    admin_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("admins.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
