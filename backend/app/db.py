"""Database engine, session factory, and table definitions (SQLAlchemy Core).

One codepath for both dialects: JSONB on Postgres (Neon), plain JSON on the
SQLite dev database, via ``JSON().with_variant(JSONB, "postgresql")``.
"""
from collections.abc import AsyncIterator

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    Table,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.types import JSON

from .config import get_settings

metadata = MetaData()

# Integer PK works on both dialects: a 64-bit rowid on SQLite, a 32-bit
# auto-increment identity on Postgres. Ample for this app's user count; the
# migration (0001) defines the same Integer type, so the two stay in lockstep.
_pk_type = Integer

users = Table(
    "users",
    metadata,
    Column("id", _pk_type, primary_key=True, autoincrement=True),
    Column("username", Text, nullable=False, unique=True),
    Column("password_hash", Text, nullable=False),
    # Nullable so pre-email accounts keep loading; a value is required before
    # the account can be used (verify-on-next-login). Stored lowercased.
    Column("email", Text, nullable=True),
    Column("email_verified", Boolean, nullable=False, server_default="0"),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    # One account per *verified* email; unverified/abandoned signups may reuse
    # an address. Partial unique index expressed for both dialects.
    Index(
        "users_verified_email_uq",
        "email",
        unique=True,
        sqlite_where=text("email_verified = 1"),
        postgresql_where=text("email_verified"),
    ),
)

# Pending email-verification codes. One active row per user (a new code deletes
# the old); keyed by the hash of an opaque "pending token" the client echoes
# back. The 6-digit code is stored as an HMAC, never in plaintext.
email_verifications = Table(
    "email_verifications",
    metadata,
    Column("token_hash", Text, primary_key=True),
    Column("user_id", _pk_type, ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    # Both null while a logged-in pre-email account is still choosing an address
    # (the pending token binds to the user; add-email fills these in).
    Column("code_hash", Text, nullable=True),
    # The address this code was sent to (the user's pending email at send time).
    Column("email", Text, nullable=True),
    Column("attempts", Integer, nullable=False, server_default="0"),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("expires_at", DateTime(timezone=True), nullable=False),
    Index("email_verifications_user_id_idx", "user_id"),
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
