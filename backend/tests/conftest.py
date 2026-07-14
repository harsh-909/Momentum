"""Shared pytest fixtures: an isolated SQLite database per test session.

DATABASE_URL must be set before any ``app.*`` import because db.py builds
its engine at import time from the cached settings.
"""
import os
import pathlib

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test.db"
os.environ["ENV"] = "test"
# Hermetic email: force the dev (log + outbox) mailer regardless of any real
# key in a developer's backend/.env (env vars outrank the dotenv file), so the
# suite never attempts a real send and can read codes from the outbox.
os.environ["RESEND_API_KEY"] = ""
os.environ["VERIFICATION_SECRET"] = "test-pepper"

import asyncio

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client():
    """Fresh app + fresh database file for each test."""
    test_db = pathlib.Path(__file__).resolve().parents[1] / "test.db"
    if test_db.exists():
        test_db.unlink()

    from app.main import app

    # TestClient runs lifespan (init_db -> create_all on SQLite).
    with TestClient(app) as c:
        yield c

    # Windows: the pooled SQLite connection keeps the file open; dispose the
    # engine before unlinking or the delete raises PermissionError.
    from app.db import engine

    asyncio.run(engine.dispose())
    if test_db.exists():
        test_db.unlink()
