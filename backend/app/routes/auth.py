"""Auth routes: signup / login / logout / me, per CONTRACT.md.

Error responses are plain JSONResponse in the contract shape
``{"error": "<code>"}``; only ``get_current_user`` failures go through the
Unauthorized exception (see app.auth.install_exception_handlers).
"""
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy import delete, insert, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import (
    DUMMY_HASH,
    LOGIN_IP_LIMIT,
    LOGIN_IP_WINDOW,
    LOGIN_USER_FAIL_LIMIT,
    LOGIN_USER_FAIL_WINDOW,
    SIGNUP_IP_LIMIT,
    SIGNUP_IP_WINDOW,
    CurrentUser,
    bearer_token,
    client_ip,
    create_session,
    get_current_user,
    hash_password,
    hash_token,
    needs_rehash,
    rate_limiter,
    utcnow,
    verify_password,
)
from ..db import get_db, sessions, users
from ..models import AuthOut, Credentials, MeOut, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _error(status: int, code: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": code})


def _rate_limited(retry_after: int) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"error": "rate_limited", "retryAfter": retry_after},
        headers={"Retry-After": str(retry_after)},
    )


async def _issue_session(db: AsyncSession, user_id: int, username: str) -> AuthOut:
    token, expires_at = await create_session(db, user_id)
    await db.commit()
    return AuthOut(
        token=token, user=UserOut(username=username), expiresAt=expires_at.isoformat()
    )


@router.post("/signup", status_code=201, response_model=AuthOut)
async def signup(
    creds: Credentials, request: Request, db: AsyncSession = Depends(get_db)
):
    ip = client_ip(request)
    retry = rate_limiter.retry_after("signup:ip", ip, SIGNUP_IP_LIMIT, SIGNUP_IP_WINDOW)
    if retry is not None:
        return _rate_limited(retry)
    rate_limiter.hit("signup:ip", ip, SIGNUP_IP_WINDOW)

    now = utcnow()
    try:
        result = await db.execute(
            insert(users).values(
                username=creds.username,
                password_hash=hash_password(creds.password),
                created_at=now,
                updated_at=now,
            )
        )
    except IntegrityError:
        # Unique constraint on username; also covers the insert race.
        await db.rollback()
        return _error(409, "username_unavailable")

    user_id = result.inserted_primary_key[0]
    return await _issue_session(db, user_id, creds.username)


@router.post("/login", response_model=AuthOut)
async def login(
    creds: Credentials, request: Request, db: AsyncSession = Depends(get_db)
):
    ip = client_ip(request)
    retries = [
        rate_limiter.retry_after(
            "login:user", creds.username, LOGIN_USER_FAIL_LIMIT, LOGIN_USER_FAIL_WINDOW
        ),
        rate_limiter.retry_after("login:ip", ip, LOGIN_IP_LIMIT, LOGIN_IP_WINDOW),
    ]
    active = [r for r in retries if r is not None]
    if active:
        return _rate_limited(max(active))
    rate_limiter.hit("login:ip", ip, LOGIN_IP_WINDOW)

    # Opportunistic purge of expired sessions (committed on every exit path).
    await db.execute(delete(sessions).where(sessions.c.expires_at <= utcnow()))

    row = (
        await db.execute(
            select(users.c.id, users.c.password_hash).where(
                users.c.username == creds.username
            )
        )
    ).first()

    if row is None:
        # Equalize timing with the wrong-password path.
        verify_password(DUMMY_HASH, creds.password)
        ok = False
    else:
        ok = verify_password(row.password_hash, creds.password)

    if not ok:
        # Only failures count toward the per-username limit.
        rate_limiter.hit("login:user", creds.username, LOGIN_USER_FAIL_WINDOW)
        await db.commit()
        return _error(401, "invalid_credentials")

    if needs_rehash(row.password_hash):
        await db.execute(
            update(users)
            .where(users.c.id == row.id)
            .values(password_hash=hash_password(creds.password), updated_at=utcnow())
        )

    return await _issue_session(db, row.id, creds.username)


@router.post("/logout", status_code=204)
async def logout(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    token = bearer_token(request)  # present: get_current_user already accepted it
    if token is not None:
        await db.execute(delete(sessions).where(sessions.c.token_hash == hash_token(token)))
        await db.commit()
    return Response(status_code=204)


@router.get("/me", response_model=MeOut)
async def me(user: CurrentUser = Depends(get_current_user)) -> MeOut:
    return MeOut(username=user.username, createdAt=user.created_at.isoformat())
