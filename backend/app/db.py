"""Database connection, session lifecycle, and engine management."""
import logging
from typing import Any, Generator

from sqlalchemy import Engine, JSON, create_engine, event
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import get_settings

logger = logging.getLogger(__name__)

# JSON column type with Postgres JSONB variant
# none_as_null: Python None is stored as SQL NULL (not the JSON literal 'null'), so IS NULL checks work.
JSONType = JSON(none_as_null=True).with_variant(postgresql.JSONB(none_as_null=True), "postgresql")

_engines: dict[str, Engine] = {}
_session_factories: dict[str, sessionmaker[Session]] = {}


def get_engine(url: str | None = None) -> Engine:
    """Return or create a cached SQLAlchemy engine for the given database URL."""
    db_url = url or get_settings().normalized_database_url
    if db_url not in _engines:
        connect_args: dict[str, Any] = {}
        pool_kwargs: dict[str, Any] = {}

        if db_url.startswith("sqlite"):
            connect_args["check_same_thread"] = False
            if ":memory:" in db_url:
                pool_kwargs["poolclass"] = StaticPool
        else:
            pool_kwargs.update(
                pool_pre_ping=True,
                pool_recycle=300,
                pool_size=5,
                max_overflow=10,
            )

        engine = create_engine(db_url, connect_args=connect_args, **pool_kwargs)

        if db_url.startswith("sqlite"):
            @event.listens_for(engine, "connect")
            def _set_sqlite_pragma(dbapi_connection, connection_record):
                cursor = dbapi_connection.cursor()
                cursor.execute("PRAGMA foreign_keys=ON")
                cursor.close()

        _engines[db_url] = engine
        _session_factories[db_url] = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    return _engines[db_url]


def SessionLocal() -> Session:
    """Convenience factory returning a new database session for the active engine."""
    engine = get_engine()
    db_url = str(engine.url)
    factory = _session_factories.get(db_url) or sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return factory()


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a SQLAlchemy database session."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
