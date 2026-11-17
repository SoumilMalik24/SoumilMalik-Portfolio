"""Key-value persistence service backed by system_kv."""
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.system import SystemKV
from app.utils.time import utcnow


def get_kv(db: Session, key: str, default: Any = None) -> Any:
    """Retrieve JSON value for a system_kv key."""
    row = db.scalars(select(SystemKV).where(SystemKV.key == key)).first()
    if row is None:
        return default
    return row.value


def set_kv(db: Session, key: str, value: Any) -> None:
    """Upsert a key-value pair in system_kv."""
    now = utcnow()
    row = db.scalars(select(SystemKV).where(SystemKV.key == key)).first()
    if row is None:
        row = SystemKV(key=key, value=value, updated_at=now)
        db.add(row)
    else:
        row.value = value
        row.updated_at = now
    db.commit()


def delete_kv(db: Session, key: str) -> bool:
    """Delete a key from system_kv."""
    row = db.scalars(select(SystemKV).where(SystemKV.key == key)).first()
    if row is not None:
        db.delete(row)
        db.commit()
        return True
    return False
