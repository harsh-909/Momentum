"""Application settings, loaded from environment / .env via pydantic-settings.

With no DATABASE_URL set, the app runs fully offline on a local SQLite file -
the intended dev mode on Windows (no Docker, no Postgres install).
Production (Render) sets DATABASE_URL to the Neon pooled connection string.
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    env: str = "development"
    database_url: str = "sqlite+aiosqlite:///./dev.db"
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
