"""Visitor session and interaction analytics database models."""
from datetime import datetime
from typing import List

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class SessionModel(Base):
    """Represents a visitor session and high-level interaction metrics."""
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    visitor_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    referrer: Mapped[str] = mapped_column(String(255), nullable=False)
    device: Mapped[str] = mapped_column(String(10), nullable=False)
    is_returning: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_scroll_pct: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    section_dwells: Mapped[List["SectionDwellModel"]] = relationship(
        "SectionDwellModel",
        back_populates="session",
        cascade="all, delete-orphan",
    )


class SectionDwellModel(Base):
    """Dwell time recorded per page section within a session."""
    __tablename__ = "section_dwell"

    session_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("sessions.id", ondelete="CASCADE"), primary_key=True
    )
    section: Mapped[str] = mapped_column(String(32), primary_key=True)
    dwell_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    session: Mapped["SessionModel"] = relationship(
        "SessionModel", back_populates="section_dwells"
    )
