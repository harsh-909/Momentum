"""Auth routes: signup / login / verify-email / resend-code / add-email /
logout / me, per CONTRACT.md.

Mandatory-email model:
- Signup no longer logs you in. It creates an *unverified* account, emails a
  6-digit code, and returns an opaque ``pendingToken``. You must POST that
  token plus the code to ``/verify-email`` to activate the account and get a
  session. Only verified accounts ever hold a session.
- Login of an unverified/legacy account does not return a token either: it
  returns a ``pendingToken`` and a ``kind`` telling the client whether to ask
  for the code (email already on file) or to collect an email first
  (``add-email``).

Responses that can take more than one shape (signup/login/verify/add-email)
are returned as explicit ``JSONResponse`` with a ``kind`` discriminator rather
than a fixed ``response_model``.

Error responses keep the contract shape ``{"error": "<code>"}``.
"""
from datetime import timedelta

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
    as_utc,
    VERIFY_ATTEMPT_IP_LIMIT,
    VERIFY_ATTEMPT_IP_WINDOW,
    VERIFY_SEND_EMAIL_LIMIT,
    VERIFY_SEND_EMAIL_WINDOW,
    VERIFY_SEND_IP_LIMIT,
    VERIFY_SEND_IP_WINDOW,
    CurrentUser,
    bearer_token,
    client_ip,
    create_session,
    generate_code,
    get_current_user,
    hash_code,
    hash_password,
    hash_token,
    needs_rehash,
    new_pending_token,
    rate_limiter,
    utcnow,
    verify_code,
    verify_password,
)
from ..config import get_settings
from ..db import email_verifications, get_db, sessions, snapshots, users
from ..email import send_account_exists_notice, send_verification_code
from ..models import (
    AddEmailIn,
    Credentials,
    MeOut,
    PendingTokenIn,
    SignupIn,
    VerifyIn,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _error(status: int, code: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": code})


def _rate_limited(retry_after: int) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"error": "rate_limited", "retryAfter": retry_after},
        headers={"Retry-After": str(retry_after)},
    )


def _mask_email(email: str) -> str:
    """`alice@example.com` -> `a***@example.com` for a safe "sent to" hint."""
    name, sep, domain = email.partition("@")
    if not sep:
        return "***"
    shown = name[0] if name else ""
    return f"{shown}***@{domain}"


def _pending(status: int, kind: str, token: str, email: str | None = None) -> JSONResponse:
    body: dict = {"kind": kind, "pendingToken": token}
    if email is not None:
        body["email"] = _mask_email(email)
    return JSONResponse(status_code=status, content=body)


async def _issue_session(
    db: AsyncSession, user_id: int, username: str, email: str | None
) -> JSONResponse:
    """Create a session and return the authed payload (commits)."""
    token, expires_at = await create_session(db, user_id)
    await db.commit()
    return JSONResponse(
        status_code=200,
        content={
            "kind": "authed",
            "token": token,
            "user": {"username": username, "email": email},
            "expiresAt": expires_at.isoformat(),
            "emailVerified": True,
        },
    )


async def _start_verification(
    db: AsyncSession, user_id: int, email: str, username: str
) -> str:
    """Replace any pending verification for the user with a fresh code, email
    it, and return the opaque pending token. Commits before sending so the row
    survives even if the provider is slow/down."""
    token, token_hash = new_pending_token()
    code = generate_code()
    now = utcnow()
    ttl = get_settings().verification_code_ttl_minutes
    await db.execute(
        delete(email_verifications).where(email_verifications.c.user_id == user_id)
    )
    await db.execute(
        email_verifications.insert().values(
            token_hash=token_hash,
            user_id=user_id,
            code_hash=hash_code(code),
            email=email,
            attempts=0,
            created_at=now,
            expires_at=now + timedelta(minutes=ttl),
        )
    )
    await db.commit()
    await send_verification_code(email, code, username=username)
    return token


def _send_limited(ip: str, email: str) -> int | None:
    """Return a Retry-After if code-send limits are hit (per email or IP)."""
    retries = [
        rate_limiter.retry_after(
            "verify_send:email", email, VERIFY_SEND_EMAIL_LIMIT, VERIFY_SEND_EMAIL_WINDOW
        ),
        rate_limiter.retry_after(
            "verify_send:ip", ip, VERIFY_SEND_IP_LIMIT, VERIFY_SEND_IP_WINDOW
        ),
    ]
    active = [r for r in retries if r is not None]
    return max(active) if active else None


def _hit_send(ip: str, email: str) -> None:
    rate_limiter.hit("verify_send:email", email, VERIFY_SEND_EMAIL_WINDOW)
    rate_limiter.hit("verify_send:ip", ip, VERIFY_SEND_IP_WINDOW)


# ------------------------------------------------------------------ signup


@router.post("/signup", status_code=202)
async def signup(creds: SignupIn, request: Request, db: AsyncSession = Depends(get_db)):
    ip = client_ip(request)
    retry = rate_limiter.retry_after("signup:ip", ip, SIGNUP_IP_LIMIT, SIGNUP_IP_WINDOW)
    if retry is not None:
        return _rate_limited(retry)
    # Count every attempt (including duplicate-username 409s) so signup can't be
    # abused as an unlimited username-enumeration oracle.
    rate_limiter.hit("signup:ip", ip, SIGNUP_IP_WINDOW)

    now = utcnow()

    # Existing username? Verified -> taken (usernames are public identifiers,
    # so this mirrors the pre-existing 409 behavior).
    existing = (
        await db.execute(
            select(users.c.id, users.c.email_verified).where(
                users.c.username == creds.username
            )
        )
    ).first()
    if existing is not None and existing.email_verified:
        return _error(409, "username_unavailable")

    # Unverified username. We may only *reclaim* a genuinely abandoned pending
    # signup (no saved data) - so a typo'd email doesn't burn a username. We
    # must NEVER overwrite the password of an account that holds data (a legacy/
    # imported account is email_verified=False but has a snapshot); that would
    # be unauthenticated account takeover. Such accounts stay 409 and are
    # recovered by their owner via login -> add-email instead.
    if existing is not None:
        has_data = (
            await db.execute(
                select(snapshots.c.user_id).where(snapshots.c.user_id == existing.id)
            )
        ).first()
        if has_data is not None:
            return _error(409, "username_unavailable")

    # Enumeration-safe email check: if a VERIFIED account already owns this
    # address, respond exactly as for a fresh signup but send the real owner a
    # notice instead of a code (no new account, no oracle).
    email_taken = (
        await db.execute(
            select(users.c.id)
            .where(users.c.email == creds.email)
            .where(users.c.email_verified)
        )
    ).first()

    send_retry = _send_limited(ip, creds.email)
    if send_retry is not None:
        return _rate_limited(send_retry)
    _hit_send(ip, creds.email)

    if email_taken is not None:
        # Equalize timing with the create/reclaim paths (which run argon2), so
        # response latency doesn't reveal that this email is already registered.
        hash_password(creds.password)
        await send_account_exists_notice(creds.email, username=creds.username)
        # Well-formed but unbacked token: the code screen looks identical, but
        # no code will ever verify it.
        decoy, _ = new_pending_token()
        return _pending(202, "verify", decoy, creds.email)

    if existing is None:
        try:
            result = await db.execute(
                insert(users).values(
                    username=creds.username,
                    password_hash=hash_password(creds.password),
                    email=creds.email,
                    email_verified=False,
                    created_at=now,
                    updated_at=now,
                )
            )
        except IntegrityError:
            await db.rollback()
            return _error(409, "username_unavailable")
        user_id = result.inserted_primary_key[0]
    else:
        # Reclaim the unverified account.
        await db.execute(
            update(users)
            .where(users.c.id == existing.id)
            .values(
                password_hash=hash_password(creds.password),
                email=creds.email,
                updated_at=now,
            )
        )
        user_id = existing.id

    token = await _start_verification(db, user_id, creds.email, creds.username)
    return _pending(202, "verify", token, creds.email)


# ------------------------------------------------------------------- login


@router.post("/login")
async def login(creds: Credentials, request: Request, db: AsyncSession = Depends(get_db)):
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

    # Opportunistic purge of expired sessions.
    await db.execute(delete(sessions).where(sessions.c.expires_at <= utcnow()))

    row = (
        await db.execute(
            select(
                users.c.id,
                users.c.password_hash,
                users.c.email,
                users.c.email_verified,
            ).where(users.c.username == creds.username)
        )
    ).first()

    if row is None:
        verify_password(DUMMY_HASH, creds.password)
        ok = False
    else:
        ok = verify_password(row.password_hash, creds.password)

    if not ok:
        rate_limiter.hit("login:user", creds.username, LOGIN_USER_FAIL_WINDOW)
        await db.commit()
        return _error(401, "invalid_credentials")

    if needs_rehash(row.password_hash):
        await db.execute(
            update(users)
            .where(users.c.id == row.id)
            .values(password_hash=hash_password(creds.password), updated_at=utcnow())
        )

    # Verified -> normal session.
    if row.email_verified:
        return await _issue_session(db, row.id, creds.username, row.email)

    # Unverified account. No session is issued; guide the client.
    if row.email is None:
        # Legacy account with no email yet: bind a pending token to the user so
        # add-email knows who it is, then ask the client to collect an email.
        token, token_hash = new_pending_token()
        now = utcnow()
        ttl = get_settings().verification_code_ttl_minutes
        await db.execute(
            delete(email_verifications).where(email_verifications.c.user_id == row.id)
        )
        await db.execute(
            email_verifications.insert().values(
                token_hash=token_hash,
                user_id=row.id,
                code_hash=None,
                email=None,
                attempts=0,
                created_at=now,
                expires_at=now + timedelta(minutes=ttl),
            )
        )
        await db.commit()
        return _pending(200, "addEmail", token)

    # Abandoned unverified signup logging back in: resend a fresh code.
    send_retry = _send_limited(ip, row.email)
    if send_retry is not None:
        return _rate_limited(send_retry)
    _hit_send(ip, row.email)
    token = await _start_verification(db, row.id, row.email, creds.username)
    return _pending(200, "verify", token, row.email)


# ------------------------------------------------------------ verify-email


@router.post("/verify-email")
async def verify_email(
    body: VerifyIn, request: Request, db: AsyncSession = Depends(get_db)
):
    ip = client_ip(request)
    retry = rate_limiter.retry_after(
        "verify_attempt:ip", ip, VERIFY_ATTEMPT_IP_LIMIT, VERIFY_ATTEMPT_IP_WINDOW
    )
    if retry is not None:
        return _rate_limited(retry)
    rate_limiter.hit("verify_attempt:ip", ip, VERIFY_ATTEMPT_IP_WINDOW)

    now = utcnow()
    token_hash = hash_token(body.pendingToken)
    row = (
        await db.execute(
            select(
                email_verifications.c.user_id,
                email_verifications.c.code_hash,
                email_verifications.c.email,
                email_verifications.c.attempts,
                email_verifications.c.expires_at,
                users.c.username,
            )
            .select_from(
                email_verifications.join(
                    users, email_verifications.c.user_id == users.c.id
                )
            )
            .where(email_verifications.c.token_hash == token_hash)
        )
    ).first()

    # Generic failure for every "can't verify" case so nothing distinguishes an
    # unknown token from a wrong code.
    if (
        row is None
        or row.code_hash is None
        or as_utc(row.expires_at) <= now
        or row.attempts >= get_settings().verification_max_attempts
    ):
        if row is not None and (
            as_utc(row.expires_at) <= now
            or row.attempts >= get_settings().verification_max_attempts
        ):
            await db.execute(
                delete(email_verifications).where(
                    email_verifications.c.token_hash == token_hash
                )
            )
            await db.commit()
        return _error(400, "invalid_code")

    if not verify_code(row.code_hash, body.code):
        await db.execute(
            update(email_verifications)
            .where(email_verifications.c.token_hash == token_hash)
            .values(attempts=row.attempts + 1)
        )
        # Invalidate the code once the attempt budget is spent.
        if row.attempts + 1 >= get_settings().verification_max_attempts:
            await db.execute(
                delete(email_verifications).where(
                    email_verifications.c.token_hash == token_hash
                )
            )
        await db.commit()
        return _error(400, "invalid_code")

    # Success: activate the account. The partial unique index enforces one
    # verified account per email; a clash means the address got verified
    # elsewhere first.
    try:
        await db.execute(
            update(users)
            .where(users.c.id == row.user_id)
            .values(email=row.email, email_verified=True, updated_at=now)
        )
        await db.execute(
            delete(email_verifications).where(email_verifications.c.user_id == row.user_id)
        )
        # Force the partial-unique-index check to raise here (not later at
        # commit, which is outside this try) so a concurrent double-verify of
        # the same email returns 409, never a 500.
        await db.flush()
    except IntegrityError:
        await db.rollback()
        return _error(409, "email_unavailable")

    return await _issue_session(db, row.user_id, row.username, row.email)


# ------------------------------------------------------------- resend-code


@router.post("/resend-code", status_code=202)
async def resend_code(
    body: PendingTokenIn, request: Request, db: AsyncSession = Depends(get_db)
):
    ip = client_ip(request)
    token_hash = hash_token(body.pendingToken)
    row = (
        await db.execute(
            select(
                email_verifications.c.user_id,
                email_verifications.c.email,
                users.c.username,
            )
            .select_from(
                email_verifications.join(
                    users, email_verifications.c.user_id == users.c.id
                )
            )
            .where(email_verifications.c.token_hash == token_hash)
        )
    ).first()

    # Neutral: unknown token or a pre-email pending row just returns 202.
    if row is not None and row.email is not None:
        send_retry = _send_limited(ip, row.email)
        if send_retry is not None:
            return _rate_limited(send_retry)
        _hit_send(ip, row.email)
        # Refresh the code IN PLACE so the client's existing pending token
        # keeps working; the previous code is invalidated.
        code = generate_code()
        now = utcnow()
        ttl = get_settings().verification_code_ttl_minutes
        await db.execute(
            update(email_verifications)
            .where(email_verifications.c.token_hash == token_hash)
            .values(
                code_hash=hash_code(code),
                attempts=0,
                created_at=now,
                expires_at=now + timedelta(minutes=ttl),
            )
        )
        await db.commit()
        await send_verification_code(row.email, code, username=row.username)

    return JSONResponse(status_code=202, content={"ok": True})


# -------------------------------------------------------------- add-email


@router.post("/add-email")
async def add_email(
    body: AddEmailIn, request: Request, db: AsyncSession = Depends(get_db)
):
    ip = client_ip(request)
    token_hash = hash_token(body.pendingToken)
    row = (
        await db.execute(
            select(
                email_verifications.c.user_id,
                users.c.username,
                users.c.email_verified,
            )
            .select_from(
                email_verifications.join(
                    users, email_verifications.c.user_id == users.c.id
                )
            )
            .where(email_verifications.c.token_hash == token_hash)
        )
    ).first()

    if row is None or row.email_verified:
        # Bogus/expired token, or the account is already verified.
        return _error(400, "invalid_token")

    send_retry = _send_limited(ip, body.email)
    if send_retry is not None:
        return _rate_limited(send_retry)
    _hit_send(ip, body.email)

    # Enumeration-safe: if a verified account already owns this address, look
    # identical but notify the owner and don't attach it.
    email_taken = (
        await db.execute(
            select(users.c.id)
            .where(users.c.email == body.email)
            .where(users.c.email_verified)
        )
    ).first()
    if email_taken is not None:
        await send_account_exists_notice(body.email, username=row.username)
        decoy, _ = new_pending_token()
        return _pending(202, "verify", decoy, body.email)

    await db.execute(
        update(users)
        .where(users.c.id == row.user_id)
        .values(email=body.email, updated_at=utcnow())
    )
    token = await _start_verification(db, row.user_id, body.email, row.username)
    return _pending(202, "verify", token, body.email)


# ---------------------------------------------------------- logout / me


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
    return MeOut(
        username=user.username,
        email=user.email,
        emailVerified=user.email_verified,
        createdAt=user.created_at.isoformat(),
    )
