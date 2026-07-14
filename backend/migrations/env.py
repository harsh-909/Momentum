"""Alembic environment - async engine variant.

The app's drivers are async-only (aiosqlite, asyncpg), so migrations run
through SQLAlchemy's async engine (the ``alembic init -t async`` pattern)
instead of requiring a separate sync driver install.

URL resolution: MIGRATIONS_DATABASE_URL > DATABASE_URL > local SQLite dev db.
Sync-style URLs (sqlite://, postgresql://) are normalized to the installed
async drivers.
"""
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.config import get_settings, normalize_database_url
from app.db import metadata

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = metadata


def _database_url() -> str:
    # Migrations prefer the direct (non-pooled) URL; fall back to the app URL.
    # Settings loads the same .env the app uses (so no secrets in the shell),
    # and normalize_database_url() maps sync schemes to our async drivers and
    # translates libpq-only query params (sslmode/channel_binding) so a raw Neon
    # connection string works verbatim. Idempotent on already-normalized URLs.
    settings = get_settings()
    return normalize_database_url(
        settings.migrations_database_url or settings.database_url
    )


def run_migrations_offline() -> None:
    """Emit SQL to stdout instead of executing (``alembic upgrade --sql``)."""
    context.configure(
        url=_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        {"sqlalchemy.url": _database_url()},
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
