"""End-to-end tests for the auth API (workstream M1-A1).

Uses the shared ``client`` fixture from conftest. The contract error shape
for dependency failures needs the exception handlers from app.auth;
``create_app()`` will call ``install_exception_handlers`` once the integrator
wires it in - calling it here at import time is additive and idempotent.
"""
import asyncio
import sqlite3
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from app.auth import install_exception_handlers, rate_limiter
from app.main import app

install_exception_handlers(app)

TEST_DB = Path(__file__).resolve().parents[1] / "test.db"

USERNAME = "alice"
PASSWORD = "password123"


@pytest.fixture(autouse=True)
def _isolate(client):
    """Reset the in-memory rate limiter and release SQLite file handles.

    Depends on ``client`` so this teardown runs BEFORE the conftest fixture
    unlinks test.db - on Windows the unlink fails while the connection pool
    still holds the file open, so we dispose the engine first.
    """
    rate_limiter.reset()
    yield
    from app.db import engine

    asyncio.run(engine.dispose())


def signup(client, username=USERNAME, password=PASSWORD):
    return client.post("/api/auth/signup", json={"username": username, "password": password})


def login(client, username=USERNAME, password=PASSWORD):
    return client.post("/api/auth/login", json={"username": username, "password": password})


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def set_session_expiry(dt: datetime) -> None:
    naive = dt.astimezone(timezone.utc).replace(tzinfo=None)
    with closing(sqlite3.connect(TEST_DB)) as conn:
        conn.execute(
            "UPDATE sessions SET expires_at = ?",
            (naive.strftime("%Y-%m-%d %H:%M:%S.%f"),),
        )
        conn.commit()


def get_session_expiry() -> datetime:
    with closing(sqlite3.connect(TEST_DB)) as conn:
        (value,) = conn.execute("SELECT expires_at FROM sessions").fetchone()
    return datetime.fromisoformat(value).replace(tzinfo=timezone.utc)


# ---------------------------------------------------------------- signup


def test_signup_happy_path(client):
    r = signup(client)
    assert r.status_code == 201
    body = r.json()
    assert isinstance(body["token"], str) and len(body["token"]) > 20
    assert body["user"] == {"username": USERNAME}
    expires = datetime.fromisoformat(body["expiresAt"])
    assert expires > datetime.now(timezone.utc) + timedelta(days=29)


def test_signup_duplicate_username_409(client):
    assert signup(client).status_code == 201
    r = signup(client, password="differentpass1")
    assert r.status_code == 409
    assert r.json() == {"error": "username_unavailable"}


@pytest.mark.parametrize("bad", ["bad name", "-leadingdash", "sp√©cial", "a" * 40, ""])
def test_signup_invalid_username(client, bad):
    r = signup(client, username=bad)
    assert r.status_code in (400, 422)
    assert r.json()["error"] == "invalid_input"


def test_signup_short_password(client):
    r = signup(client, password="short")
    assert r.status_code in (400, 422)
    assert r.json()["error"] == "invalid_input"


def test_signup_normalizes_username(client):
    r = signup(client, username="  MyUser ")
    assert r.status_code == 201
    assert r.json()["user"]["username"] == "myuser"
    # Login with different casing resolves to the same account.
    r = login(client, username="MYUSER")
    assert r.status_code == 200
    me = client.get("/api/auth/me", headers=bearer(r.json()["token"]))
    assert me.json()["username"] == "myuser"


def test_signup_rate_limited_per_ip(client):
    for i in range(5):
        assert signup(client, username=f"user{i}").status_code == 201
    r = signup(client, username="user5")
    assert r.status_code == 429
    body = r.json()
    assert body["error"] == "rate_limited"
    assert isinstance(body["retryAfter"], int) and body["retryAfter"] >= 1


# ---------------------------------------------------------------- login


def test_login_success(client):
    signup(client)
    r = login(client)
    assert r.status_code == 200
    body = r.json()
    assert body["user"] == {"username": USERNAME}
    me = client.get("/api/auth/me", headers=bearer(body["token"]))
    assert me.status_code == 200


def test_login_failures_are_generic_401(client):
    signup(client)
    wrong_password = login(client, password="wrongpassword1")
    unknown_user = login(client, username="nobodyhere")
    assert wrong_password.status_code == 401
    assert unknown_user.status_code == 401
    # Identical bodies: no username-existence oracle.
    assert wrong_password.json() == unknown_user.json() == {"error": "invalid_credentials"}


def test_login_rate_limited_after_5_failures(client):
    signup(client)
    for _ in range(5):
        assert login(client, password="wrongpassword1").status_code == 401
    # Even the correct password is refused once the username is limited.
    r = login(client)
    assert r.status_code == 429
    body = r.json()
    assert body["error"] == "rate_limited"
    assert isinstance(body["retryAfter"], int) and body["retryAfter"] >= 1


# ---------------------------------------------------------------- me


def test_me_returns_profile(client):
    token = signup(client).json()["token"]
    r = client.get("/api/auth/me", headers=bearer(token))
    assert r.status_code == 200
    body = r.json()
    assert body["username"] == USERNAME
    assert datetime.fromisoformat(body["createdAt"]).tzinfo is not None


def test_me_without_token_401(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 401
    assert r.json() == {"error": "unauthorized"}


def test_me_with_garbage_token_401(client):
    r = client.get("/api/auth/me", headers=bearer("not-a-real-token"))
    assert r.status_code == 401
    assert r.json() == {"error": "unauthorized"}


def test_me_with_wrong_scheme_401(client):
    r = client.get("/api/auth/me", headers={"Authorization": "Basic abc123"})
    assert r.status_code == 401
    assert r.json() == {"error": "unauthorized"}


# ---------------------------------------------------------------- logout


def test_logout_kills_the_token(client):
    token = signup(client).json()["token"]
    r = client.post("/api/auth/logout", headers=bearer(token))
    assert r.status_code == 204
    assert client.get("/api/auth/me", headers=bearer(token)).status_code == 401
    # The dead token can't log out again either.
    assert client.post("/api/auth/logout", headers=bearer(token)).status_code == 401


def test_logout_without_token_401(client):
    r = client.post("/api/auth/logout")
    assert r.status_code == 401
    assert r.json() == {"error": "unauthorized"}


# ---------------------------------------------------------------- sessions


def test_expired_session_rejected(client):
    token = signup(client).json()["token"]
    set_session_expiry(datetime.now(timezone.utc) - timedelta(seconds=1))
    r = client.get("/api/auth/me", headers=bearer(token))
    assert r.status_code == 401
    assert r.json() == {"error": "unauthorized"}


def test_sliding_expiry_bumps_after_7_days_consumed(client):
    token = signup(client).json()["token"]
    now = datetime.now(timezone.utc)
    # 8 of 30 TTL days consumed -> next authenticated request should bump.
    set_session_expiry(now + timedelta(days=22))
    assert client.get("/api/auth/me", headers=bearer(token)).status_code == 200
    assert get_session_expiry() > now + timedelta(days=29)


def test_sliding_expiry_no_bump_when_fresh(client):
    token = signup(client).json()["token"]
    now = datetime.now(timezone.utc)
    # Only ~2 days consumed -> no bump.
    set_session_expiry(now + timedelta(days=28))
    assert client.get("/api/auth/me", headers=bearer(token)).status_code == 200
    delta = get_session_expiry() - (now + timedelta(days=28))
    assert abs(delta.total_seconds()) < 5
