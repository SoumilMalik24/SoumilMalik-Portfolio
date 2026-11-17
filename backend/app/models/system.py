"""Key-value system store model."""
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import JSONType
from app.models.base import Base


class SystemKV(Base):
    """System key-value store for counters, state, and background flags."""
    __tablename__ = "system_kv"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[Any] = mapped_column(JSONType, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
