"""Auth core: password hashing, session tokens, current-user dependency.

Implemented by workstream M1-A1. The ``get_current_user`` signature and the
``CurrentUser`` shape are contracts: routes/data.py depends on them and tests
override them via FastAPI dependency_overrides.

Error shape: the wire contract requires error bodies to be top-level
``{"error": "<code>"}``. Dependency failures raise :class:`Unauthorized`;
``create_app()`` must call :func:`install_exception_handlers` so that (and
request validation errors) render in the contract shape.
"""
from __future__ import annotations

import hashlib
import secrets
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import get_settings
from .db import get_db, sessions, users

# --------------------------------------------------------------------------
# Password hashing (argon2id)
# --------------------------------------------------------------------------

ph = PasswordHasher()  # argon2id with library defaults

# Verified against when a username doesn't exist so unknown-user and
# wrong-password login attempts take comparable time.
DUMMY_HASH = ph.hash(secrets.token_urlsafe(32))


def hash_password(password: str) -> str:
    return ph.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return ph.verify(password_hash, password)
    except VerifyMismatchError:
        return False
    except (VerificationError, InvalidHashError):
        # Corrupt/legacy hash: treat as a failed login rather than a 500.
        return False


def needs_rehash(password_hash: str) -> bool:
    try:
        return ph.check_needs_rehash(password_hash)
    except InvalidHashError:
        return False


# --------------------------------------------------------------------------
# Session tokens
# --------------------------------------------------------------------------

# Sliding expiry: once more than this much of the TTL has been consumed,
# an authenticated request bumps expires_at back to the full TTL.
SESSION_BUMP_AFTER = timedelta(days=7)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(dt: datetime) -> datetime:
    """SQLite drops tzinfo on round-trip; naive DB datetimes are UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def bearer_token(request: Request) -> str | None:
    header = request.headers.get("authorization") or ""
    scheme, _, credentials = header.partition(" ")
    if scheme.lower() != "bearer":
        return None
    token = credentials.strip()
    return token or None


async def create_session(db: AsyncSession, user_id: int) -> tuple[str, datetime]:
    """Insert a session row; returns (opaque token, aware expires_at).

    The caller commits - session creation rides in the signup/login
    transaction.
    """
    token = secrets.token_urlsafe(32)
    now = utcnow()
    expires_at = now + timedelta(days=get_settings().session_ttl_days)
    await db.execute(
        sessions.insert().values(
            token_hash=hash_token(token),
            user_id=user_id,
            created_at=now,
            expires_at=expires_at,
        )
    )
    return token, expires_at


# --------------------------------------------------------------------------
# Current-user dependency
# --------------------------------------------------------------------------


class Unauthorized(StarletteHTTPException):
    """401 in the contract error shape.

    Subclasses HTTPException so that even without the custom handler the
    request fails with a 401 (never a 500); with
    :func:`install_exception_handlers` wired in, the body is exactly
    ``{"error": "unauthorized"}``.
    """

    def __init__(self) -> None:
        super().__init__(status_code=401, detail={"error": "unauthorized"})


class CurrentUser:
    """Authenticated user context handed to route handlers."""

    def __init__(self, id: int, username: str, created_at: Any) -> None:
        self.id = id
        self.username = username
        self.created_at = created_at


async def get_current_user(
    request: Request, db: AsyncSession = Depends(get_db)
) -> CurrentUser:
    """Resolve the Bearer token to a user; 401 ``unauthorized`` otherwise."""
    token = bearer_token(request)
    if token is None:
        raise Unauthorized()

    token_hash = hash_token(token)
    stmt = (
        select(users.c.id, users.c.username, users.c.created_at, sessions.c.expires_at)
        .select_from(sessions.join(users, sessions.c.user_id == users.c.id))
        .where(sessions.c.token_hash == token_hash)
    )
    row = (await db.execute(stmt)).first()
    if row is None:
        raise Unauthorized()

    now = utcnow()
    expires_at = as_utc(row.expires_at)
    if expires_at <= now:
        await db.execute(delete(sessions).where(sessions.c.token_hash == token_hash))
        await db.commit()
        raise Unauthorized()

    ttl = timedelta(days=get_settings().session_ttl_days)
    if ttl - (expires_at - now) > SESSION_BUMP_AFTER:
        await db.execute(
            update(sessions)
            .where(sessions.c.token_hash == token_hash)
            .values(expires_at=now + ttl)
        )
        await db.commit()

    return CurrentUser(id=row.id, username=row.username, created_at=as_utc(row.created_at))


def install_exception_handlers(app: FastAPI) -> None:
    """Register contract-shaped error rendering. Call from ``create_app()``.

    Idempotent: registering again just overwrites the same handler slots.
    """

    async def _unauthorized(request: Request, exc: Unauthorized) -> JSONResponse:
        return JSONResponse(status_code=401, content={"error": "unauthorized"})

    async def _invalid_input(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={"error": "invalid_input", "detail": str(exc)[:500]},
        )

    app.add_exception_handler(Unauthorized, _unauthorized)
    app.add_exception_handler(RequestValidationError, _invalid_input)


# --------------------------------------------------------------------------
# Rate limiting (in-memory, single-process, fixed window)
# --------------------------------------------------------------------------

LOGIN_USER_FAIL_LIMIT = 5
LOGIN_USER_FAIL_WINDOW = 15 * 60  # seconds
LOGIN_IP_LIMIT = 20
LOGIN_IP_WINDOW = 60 * 60
SIGNUP_IP_LIMIT = 5
SIGNUP_IP_WINDOW = 60 * 60


class RateLimiter:
    """Fixed-window counter keyed by (scope, key).

    In-memory by design: a single small process serves this app, and losing
    counters on restart is acceptable for a personal tracker.
    """

    # Prune expired buckets once the dict grows past this; bounds memory even
    # against sprayed usernames / spoofed X-Forwarded-For keys.
    PRUNE_THRESHOLD = 1024
    # Longest window in use; entries older than this are always stale.
    MAX_WINDOW = 60 * 60

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # (scope, key) -> (window_start_monotonic, count)
        self._buckets: dict[tuple[str, str], tuple[float, int]] = {}

    def retry_after(self, scope: str, key: str, limit: int, window: int) -> int | None:
        """Seconds until the window resets if over the limit, else None."""
        now = time.monotonic()
        with self._lock:
            bucket = self._buckets.get((scope, key))
            if bucket is None:
                return None
            start, count = bucket
            if now - start >= window:
                del self._buckets[(scope, key)]
                return None
            if count >= limit:
                return max(1, int(start + window - now) + 1)
            return None

    def hit(self, scope: str, key: str, window: int) -> None:
        now = time.monotonic()
        with self._lock:
            if len(self._buckets) >= self.PRUNE_THRESHOLD:
                self._prune(now)
            start, count = self._buckets.get((scope, key), (now, 0))
            if now - start >= window:
                start, count = now, 0
            self._buckets[(scope, key)] = (start, count + 1)

    def _prune(self, now: float) -> None:
        """Drop entries whose longest possible window has elapsed (lock held)."""
        stale = [k for k, (start, _) in self._buckets.items() if now - start >= self.MAX_WINDOW]
        for k in stale:
            del self._buckets[k]
        # Adversarial flood of fresh keys: evict oldest to hold the cap.
        if len(self._buckets) >= self.PRUNE_THRESHOLD:
            for k in sorted(self._buckets, key=lambda k: self._buckets[k][0])[
                : len(self._buckets) - self.PRUNE_THRESHOLD // 2
            ]:
                del self._buckets[k]

    def reset(self) -> None:
        with self._lock:
            self._buckets.clear()


rate_limiter = RateLimiter()


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first_hop = forwarded.split(",")[0].strip()
        if first_hop:
            return first_hop
    return request.client.host if request.client else "unknown"
