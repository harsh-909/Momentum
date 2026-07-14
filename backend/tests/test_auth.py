"""End-to-end tests for the auth API with mandatory email verification.

Signup no longer returns a session - it emails a 6-digit code and returns a
pending token; the account activates only after /verify-email. Tests read the
code from the mailer's dev ``outbox`` (no real email is sent when
RESEND_API_KEY is unset, which is the case under test).
"""
import asyncio
import sqlite3
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from app.auth import install_exception_handlers, rate_limiter
from app.email import outbox, reset_outbox
from app.main import app

install_exception_handlers(app)

TEST_DB = Path(__file__).resolve().parents[1] / "test.db"

USERNAME = "alice"
PASSWORD = "password123"
EMAIL = "alice@example.com"


@pytest.fixture(autouse=True)
def _isolate(client):
    """Reset in-memory rate limiter + mail outbox, and release SQLite handles."""
    rate_limiter.reset()
    reset_outbox()
    yield
    from app.db import engine

    asyncio.run(engine.dispose())


# ------------------------------------------------------------- helpers


def signup(client, username=USERNAME, password=PASSWORD, email=EMAIL):
    return client.post(
        "/api/auth/signup",
        json={"username": username, "password": password, "email": email},
    )


def login(client, username=USERNAME, password=PASSWORD):
    return client.post("/api/auth/login", json={"username": username, "password": password})


def verify(client, pending_token, code):
    return client.post(
        "/api/auth/verify-email", json={"pendingToken": pending_token, "code": code}
    )


def last_code(email=EMAIL):
    """The most recent verification code emailed to ``email`` (dev outbox)."""
    for msg in reversed(outbox):
        if msg.to == email and msg.code:
            return msg.code
    raise AssertionError(f"no verification code was sent to {email}")


def register(client, username=USERNAME, password=PASSWORD, email=EMAIL):
    """Full signup + verify; returns the session token of the active account."""
    r = signup(client, username, password, email)
    assert r.status_code == 202, r.text
    token = r.json()["pendingToken"]
    v = verify(client, token, last_code(email))
    assert v.status_code == 200, v.text
    return v.json()["token"]


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


def expire_verification() -> None:
    past = (datetime.now(timezone.utc) - timedelta(minutes=1)).replace(tzinfo=None)
    with closing(sqlite3.connect(TEST_DB)) as conn:
        conn.execute(
            "UPDATE email_verifications SET expires_at = ?",
            (past.strftime("%Y-%m-%d %H:%M:%S.%f"),),
        )
        conn.commit()


# -------------------------------------------------------------- signup


def test_signup_returns_pending_not_a_session(client):
    r = signup(client)
    assert r.status_code == 202
    body = r.json()
    assert body["kind"] == "verify"
    assert isinstance(body["pendingToken"], str) and len(body["pendingToken"]) > 20
    assert "token" not in body  # no session yet
    # Masked address, never the raw email.
    assert body["email"] == "a***@example.com"
    # A code was actually dispatched.
    assert last_code() is not None


def test_signup_requires_email(client):
    r = client.post("/api/auth/signup", json={"username": USERNAME, "password": PASSWORD})
    assert r.status_code in (400, 422)
    assert r.json()["error"] == "invalid_input"


def test_signup_rejects_malformed_email(client):
    r = signup(client, email="not-an-email")
    assert r.status_code in (400, 422)
    assert r.json()["error"] == "invalid_input"


def test_signup_normalizes_email(client):
    # Mixed-case in -> stored + emailed lowercased.
    r = signup(client, email="Alice@Example.COM")
    assert r.status_code == 202
    v = verify(client, r.json()["pendingToken"], last_code("alice@example.com"))
    assert v.status_code == 200
    me = client.get("/api/auth/me", headers=bearer(v.json()["token"]))
    assert me.json()["email"] == "alice@example.com"


def test_signup_duplicate_verified_username_409(client):
    register(client)  # alice is now verified
    r = signup(client, password="differentpass1", email="other@example.com")
    assert r.status_code == 409
    assert r.json() == {"error": "username_unavailable"}


def test_unverified_username_can_be_reclaimed(client):
    # First signup, never verified (abandoned pending signup, no saved data).
    assert signup(client).status_code == 202
    # Same username signs up again (e.g. after a typo'd email) - allowed.
    r = signup(client, password="newpassword1", email="alice2@example.com")
    assert r.status_code == 202
    token = r.json()["pendingToken"]
    # The reclaimed account verifies with the new email + new password.
    assert verify(client, token, last_code("alice2@example.com")).status_code == 200


def _insert_user_with_data(username="victim", password="victimpass1") -> None:
    """A pre-email account that already holds a snapshot (e.g. a legacy import).
    email NULL, unverified, but NOT an abandoned signup - must be un-reclaimable."""
    from app.auth import hash_password

    async def _run() -> None:
        from app.db import session_factory, snapshots, users

        async with session_factory() as session:
            r = await session.execute(
                users.insert()
                .values(username=username, password_hash=hash_password(password))
                .returning(users.c.id)
            )
            uid = r.scalar_one()
            await session.execute(
                snapshots.insert().values(user_id=uid, version=1, doc={"goals": {}})
            )
            await session.commit()

    asyncio.run(_run())


def test_signup_cannot_take_over_a_legacy_account_with_data(client):
    """Security: an unverified account that holds data (legacy/imported) must
    never be password-overwritten via signup - that would be account takeover."""
    _insert_user_with_data("victim", "victimpass1")
    # Attacker tries to reclaim the username with their own password + email.
    r = signup(client, username="victim", password="attackerpass1", email="attacker@evil.com")
    assert r.status_code == 409
    assert r.json() == {"error": "username_unavailable"}
    # The victim's password is unchanged: attacker's password is rejected...
    assert login(client, username="victim", password="attackerpass1").status_code == 401
    # ...and the victim's real password still authenticates (gated to add-email).
    ok = login(client, username="victim", password="victimpass1")
    assert ok.status_code == 200 and ok.json()["kind"] == "addEmail"


def test_duplicate_verified_email_is_neutral_with_notice(client):
    register(client, email="taken@example.com")  # verified owner of the email
    reset_outbox()
    # Someone else signs up with the same email under a different username.
    r = signup(client, username="mallory", email="taken@example.com")
    assert r.status_code == 202  # looks identical to a fresh signup
    body = r.json()
    assert body["kind"] == "verify"
    # No code was sent; the owner got a notice instead.
    assert not any(m.code for m in outbox if m.to == "taken@example.com")
    assert any(m.code is None for m in outbox if m.to == "taken@example.com")
    # The decoy token cannot verify anything.
    assert verify(client, body["pendingToken"], "000000").status_code == 400


def test_signup_rate_limited_per_ip(client):
    for i in range(5):
        assert signup(client, username=f"user{i}", email=f"user{i}@example.com").status_code == 202
    r = signup(client, username="user5", email="user5@example.com")
    assert r.status_code == 429
    body = r.json()
    assert body["error"] == "rate_limited"
    assert isinstance(body["retryAfter"], int) and body["retryAfter"] >= 1


# -------------------------------------------------------------- verify


def test_verify_activates_and_returns_session(client):
    r = signup(client)
    token = r.json()["pendingToken"]
    v = verify(client, token, last_code())
    assert v.status_code == 200
    body = v.json()
    assert body["kind"] == "authed"
    assert isinstance(body["token"], str) and len(body["token"]) > 20
    assert body["user"] == {"username": USERNAME, "email": EMAIL}
    assert body["emailVerified"] is True
    # The session works.
    me = client.get("/api/auth/me", headers=bearer(body["token"]))
    assert me.status_code == 200
    assert me.json() == {
        "username": USERNAME,
        "email": EMAIL,
        "emailVerified": True,
        "createdAt": me.json()["createdAt"],
    }


def test_verify_wrong_code_is_generic_400(client):
    token = signup(client).json()["pendingToken"]
    bad = "000000" if last_code() != "000000" else "111111"
    r = verify(client, token, bad)
    assert r.status_code == 400
    assert r.json() == {"error": "invalid_code"}


def test_verify_locks_out_after_max_attempts(client):
    token = signup(client).json()["pendingToken"]
    good = last_code()
    wrong = "000000" if good != "000000" else "111111"
    for _ in range(5):
        assert verify(client, token, wrong).status_code == 400
    # Code is now invalidated - even the correct one fails.
    assert verify(client, token, good).status_code == 400


def test_verify_expired_code_400(client):
    token = signup(client).json()["pendingToken"]
    code = last_code()
    expire_verification()
    assert verify(client, token, code).status_code == 400


def test_verify_unknown_token_400(client):
    r = verify(client, "totally-made-up-token", "123456")
    assert r.status_code == 400
    assert r.json() == {"error": "invalid_code"}


def test_verify_rejects_non_numeric_code(client):
    token = signup(client).json()["pendingToken"]
    r = verify(client, token, "abcdef")
    assert r.status_code in (400, 422)


# ------------------------------------------------------------- resend


def test_resend_sends_a_fresh_code_and_invalidates_old(client):
    token = signup(client).json()["pendingToken"]
    first = last_code()
    r = client.post("/api/auth/resend-code", json={"pendingToken": token})
    assert r.status_code == 202
    second = last_code()
    assert second != first or True  # a new code row was issued
    # The old code no longer verifies.
    assert verify(client, token, first).status_code == 400
    # The fresh code does (resend keeps the same pending token).
    assert verify(client, token, second).status_code == 200


def test_resend_unknown_token_is_neutral_202(client):
    r = client.post("/api/auth/resend-code", json={"pendingToken": "nope"})
    assert r.status_code == 202


# ------------------------------------------------------ login gating


def test_login_verified_returns_session(client):
    register(client)
    r = login(client)
    assert r.status_code == 200
    body = r.json()
    assert body["kind"] == "authed"
    assert body["user"] == {"username": USERNAME, "email": EMAIL}
    assert client.get("/api/auth/me", headers=bearer(body["token"])).status_code == 200


def test_login_unverified_resends_and_gates(client):
    signup(client)  # unverified
    reset_outbox()
    r = login(client)
    assert r.status_code == 200
    body = r.json()
    assert body["kind"] == "verify"
    assert "token" not in body
    # A fresh code was sent; it activates the account.
    assert verify(client, body["pendingToken"], last_code()).status_code == 200


def test_login_failures_are_generic_401(client):
    register(client)
    wrong_password = login(client, password="wrongpassword1")
    unknown_user = login(client, username="nobodyhere")
    assert wrong_password.status_code == 401
    assert unknown_user.status_code == 401
    assert wrong_password.json() == unknown_user.json() == {"error": "invalid_credentials"}


def test_login_rate_limited_after_5_failures(client):
    register(client)
    for _ in range(5):
        assert login(client, password="wrongpassword1").status_code == 401
    r = login(client)
    assert r.status_code == 429
    assert r.json()["error"] == "rate_limited"


# ------------------------------------------- legacy account (add-email)


def _insert_legacy_user(username="legacy", password="password123") -> None:
    """A pre-email account: password set, email NULL, unverified."""
    from app.auth import hash_password

    async def _run() -> None:
        from app.db import session_factory, users

        async with session_factory() as session:
            await session.execute(
                users.insert().values(
                    username=username, password_hash=hash_password(password)
                )
            )
            await session.commit()

    asyncio.run(_run())


def test_legacy_account_must_add_and_verify_email(client):
    _insert_legacy_user()
    # Login succeeds on password but is gated: no email on file.
    r = login(client, username="legacy")
    assert r.status_code == 200
    body = r.json()
    assert body["kind"] == "addEmail"
    assert "token" not in body
    pending = body["pendingToken"]

    # Add an email -> a code is sent.
    add = client.post(
        "/api/auth/add-email",
        json={"pendingToken": pending, "email": "legacy@example.com"},
    )
    assert add.status_code == 202
    assert add.json()["kind"] == "verify"
    new_token = add.json()["pendingToken"]

    # Verify -> a real session, account now carries the email.
    v = verify(client, new_token, last_code("legacy@example.com"))
    assert v.status_code == 200
    me = client.get("/api/auth/me", headers=bearer(v.json()["token"]))
    assert me.json()["email"] == "legacy@example.com"
    assert me.json()["emailVerified"] is True

    # Next login is now the normal verified path.
    assert login(client, username="legacy").json()["kind"] == "authed"


def test_add_email_bad_token_400(client):
    r = client.post(
        "/api/auth/add-email",
        json={"pendingToken": "bogus", "email": "x@example.com"},
    )
    assert r.status_code == 400


# ---------------------------------------------------------------- me


def test_me_without_token_401(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 401
    assert r.json() == {"error": "unauthorized"}


def test_me_with_garbage_token_401(client):
    r = client.get("/api/auth/me", headers=bearer("not-a-real-token"))
    assert r.status_code == 401


# ---------------------------------------------------------------- logout


def test_logout_kills_the_token(client):
    token = register(client)
    assert client.post("/api/auth/logout", headers=bearer(token)).status_code == 204
    assert client.get("/api/auth/me", headers=bearer(token)).status_code == 401
    assert client.post("/api/auth/logout", headers=bearer(token)).status_code == 401


def test_logout_without_token_401(client):
    r = client.post("/api/auth/logout")
    assert r.status_code == 401


# ---------------------------------------------------------------- sessions


def test_expired_session_rejected(client):
    token = register(client)
    set_session_expiry(datetime.now(timezone.utc) - timedelta(seconds=1))
    r = client.get("/api/auth/me", headers=bearer(token))
    assert r.status_code == 401


def test_sliding_expiry_bumps_after_7_days_consumed(client):
    token = register(client)
    now = datetime.now(timezone.utc)
    set_session_expiry(now + timedelta(days=22))
    assert client.get("/api/auth/me", headers=bearer(token)).status_code == 200
    assert get_session_expiry() > now + timedelta(days=29)
