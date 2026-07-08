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

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    return Settings()
