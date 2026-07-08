"""Database engine, session factory, and table definitions (SQLAlchemy Core).

One codepath for both dialects: JSONB on Postgres (Neon), plain JSON on the
SQLite dev database, via ``JSON().with_variant(JSONB, "postgresql")``.
"""
from collections.abc import AsyncIterator

from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    Table,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.types import JSON

from .config import get_settings

metadata = MetaData()

# BigInteger autoincrement is awkward on SQLite; Integer PKs map to 64-bit
# rowids there while Postgres gets IDENTITY via BigInteger in the migration.
_pk_type = Integer

users = Table(
    "users",
    metadata,
    Column("id", _pk_type, primary_key=True, autoincrement=True),
    Column("username", Text, nullable=False, unique=True),
    Column("password_hash", Text, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
)

snapshots = Table(
    "snapshots",
    metadata,
    Column("user_id", _pk_type, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("version", BigInteger, nullable=False, server_default="1"),
    Column("doc", JSON().with_variant(JSONB(), "postgresql"), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
)

sessions = Table(
    "sessions",
    metadata,
    Column("token_hash", Text, primary_key=True),
    Column("user_id", _pk_type, ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("expires_at", DateTime(timezone=True), nullable=False),
    Index("sessions_user_id_idx", "user_id"),
)

_settings = get_settings()
engine = create_async_engine(
    _settings.database_url,
    pool_pre_ping=True,
    # Neon suspends idle computes; recycle keeps stale connections out of the pool.
    **({} if _settings.is_sqlite else {"pool_size": 5, "pool_recycle": 300}),
)
session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with session_factory() as session:
        yield session


async def init_db() -> None:
    """Dev convenience: create tables on SQLite so local runs need no Alembic."""
    if _settings.is_sqlite:
        async with engine.begin() as conn:
            await conn.run_sync(metadata.create_all)
