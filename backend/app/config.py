"""Application settings, loaded from environment / .env via pydantic-settings.

With no DATABASE_URL set, the app runs fully offline on a local SQLite file -
the intended dev mode on Windows (no Docker, no Postgres install).
Production (Render) sets DATABASE_URL to the Neon pooled connection string.
"""
from functools import lru_cache
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_SQLITE_DEFAULT = "sqlite+aiosqlite:///./dev.db"


def normalize_database_url(url: str) -> str:
    """Accept a raw provider URL and return the async-driver form the app uses.

    Lets us paste a Neon/Postgres connection string verbatim (no manual editing):
    the sync scheme becomes the async driver, and libpq-only query params that
    asyncpg rejects (``sslmode``, ``channel_binding``) are translated/dropped.
    An empty value means "run on the local SQLite dev file".
    """
    url = url.strip()
    if not url:
        return _SQLITE_DEFAULT
    if url.startswith("postgres://"):
        url = "postgresql+asyncpg://" + url[len("postgres://") :]
    elif url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://") :]
    elif url.startswith("sqlite://") and "+aiosqlite" not in url:
        url = "sqlite+aiosqlite://" + url[len("sqlite://") :]
    if url.startswith("postgresql+asyncpg://"):
        parts = urlsplit(url)
        params = dict(parse_qsl(parts.query, keep_blank_values=True))
        # asyncpg speaks `ssl`, not libpq's `sslmode`; and it has no channel_binding arg.
        if "sslmode" in params:
            params.setdefault("ssl", params.pop("sslmode"))
        params.pop("channel_binding", None)
        url = urlunsplit(
            (parts.scheme, parts.netloc, parts.path, urlencode(params), parts.fragment)
        )
    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    env: str = "development"
    database_url: str = _SQLITE_DEFAULT
    # Optional direct (non-pooled) URL used only by Alembic migrations; the app
    # itself never uses it. Empty means "reuse database_url". Kept raw here and
    # normalized at the point of use (migrations/env.py).
    migrations_database_url: str = ""

    @field_validator("database_url", mode="before")
    @classmethod
    def _normalize_database_url(cls, v: str) -> str:
        return normalize_database_url(v if isinstance(v, str) else _SQLITE_DEFAULT)
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    session_ttl_days: int = 30
    max_body_bytes: int = 2 * 1024 * 1024  # 2 MB; real snapshots grow ~1 MB/year
    serve_static: bool = False

    # -- Email / verification -------------------------------------------
    # With no RESEND_API_KEY the mailer runs in dev mode: it logs the code
    # instead of sending, so local runs and tests need no email provider.
    resend_api_key: str = ""
    # Resend requires a verified sending domain in production; on the free
    # tier "onboarding@resend.dev" works for testing before a domain is set.
    email_from: str = "Momentum <onboarding@resend.dev>"
    email_from_name: str = "Momentum"
    # Verification-code policy.
    verification_code_ttl_minutes: int = 15
    verification_max_attempts: int = 5
    # Server-side pepper: codes are stored as HMAC-SHA256(secret, code), so a
    # leaked DB can't be brute-forced offline against the 1e6 code space. Set a
    # strong random value in production; the dev fallback below is fine locally.
    verification_secret: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def email_enabled(self) -> bool:
        """True when a real provider is configured; else dev log fallback."""
        return bool(self.resend_api_key)

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    return Settings()
