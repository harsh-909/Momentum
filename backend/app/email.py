"""Transactional email - verification codes and account notices.

Two modes, chosen automatically from settings:

- **Real send** when ``RESEND_API_KEY`` is set: one async POST to the Resend
  HTTP API (https://api.resend.com/emails) via httpx. We call the API directly
  rather than the sync ``resend`` package so nothing blocks the event loop.
- **Dev fallback** otherwise: the message is logged and recorded in ``outbox``
  so local runs and tests need no email provider and can read the code back.

Sending never raises into the request path: a provider failure is logged and
swallowed, and the user recovers via the "resend code" button. Signup/login
must not 500 because email is down.
"""
from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass

import httpx

from .config import get_settings

logger = logging.getLogger("momentum.email")

# Dev-only: where the "log the code" fallback also records the latest code per
# address, so an operator or the wire smoke can read it back. Never written
# when a real provider is configured or under tests. Gitignored.
DEV_CODE_FILE = os.environ.get("DEV_CODE_FILE", ".dev_codes.json")

RESEND_ENDPOINT = "https://api.resend.com/emails"
# Resend rejects requests without a User-Agent (403); identify ourselves.
_USER_AGENT = "momentum/2.0"
_TIMEOUT = httpx.Timeout(10.0)


@dataclass
class SentMessage:
    to: str
    subject: str
    # Populated only in the dev fallback so tests can assert on the code.
    code: str | None = None


# Dev/test visibility. In real-send mode this stays empty (we don't retain
# message bodies). Tests import this and read the most recent entry.
outbox: list[SentMessage] = []


def reset_outbox() -> None:
    outbox.clear()


async def _resend_send(*, to: str, subject: str, html: str, text: str) -> bool:
    """POST one email to Resend. Returns True on success, False on any failure."""
    settings = get_settings()
    payload = {
        "from": settings.email_from,
        "to": [to],
        "subject": subject,
        "html": html,
        "text": text,
    }
    headers = {
        "Authorization": f"Bearer {settings.resend_api_key}",
        "User-Agent": _USER_AGENT,
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as http:
            resp = await http.post(RESEND_ENDPOINT, json=payload, headers=headers)
    except httpx.HTTPError as exc:
        logger.error("Resend request failed for %s: %s", to, exc)
        return False
    if resp.status_code >= 400:
        # Log the provider error body (bad key, unverified domain, quota, ...)
        # without leaking it to the client.
        logger.error("Resend rejected email to %s: %s %s", to, resp.status_code, resp.text[:500])
        return False
    return True


async def _deliver(*, to: str, subject: str, html: str, text: str, code: str | None) -> bool:
    """Send via Resend, or log + record in the dev outbox when unconfigured."""
    settings = get_settings()
    if settings.email_enabled:
        return await _resend_send(to=to, subject=subject, html=html, text=text)
    # Dev fallback: no provider configured.
    if code is not None:
        logger.info("[email:dev] verification code for %s: %s", to, code)
        if settings.env != "test":
            _record_dev_code(to, code)
    else:
        logger.info("[email:dev] sent %r to %s", subject, to)
    outbox.append(SentMessage(to=to, subject=subject, code=code))
    return True


def _record_dev_code(to: str, code: str) -> None:
    """Best-effort: persist the latest dev code per address to a local file."""
    try:
        data: dict[str, str] = {}
        if os.path.exists(DEV_CODE_FILE):
            with open(DEV_CODE_FILE, encoding="utf-8") as fh:
                data = json.load(fh)
        data[to] = code
        with open(DEV_CODE_FILE, "w", encoding="utf-8") as fh:
            json.dump(data, fh)
    except (OSError, ValueError):
        pass  # dev convenience only; never break a send over this


async def send_verification_code(to: str, code: str, *, username: str) -> bool:
    """Email the 6-digit signup/verification code."""
    settings = get_settings()
    ttl = settings.verification_code_ttl_minutes
    subject = f"Your {settings.email_from_name} verification code"
    text = (
        f"Hi {username},\n\n"
        f"Your verification code is {code}.\n"
        f"It expires in {ttl} minutes. If you didn't request this, you can ignore this email.\n"
    )
    html = (
        f"<p>Hi {username},</p>"
        f"<p>Your {settings.email_from_name} verification code is:</p>"
        f'<p style="font-size:28px;font-weight:700;letter-spacing:4px;'
        f'font-family:monospace">{code}</p>'
        f"<p>It expires in {ttl} minutes. "
        f"If you didn't request this, you can safely ignore this email.</p>"
    )
    return await _deliver(to=to, subject=subject, html=html, text=text, code=code)


async def send_account_exists_notice(to: str, *, username: str | None = None) -> bool:
    """Enumeration-safe path: someone tried to sign up with an already-registered
    email. We reply to the signup with the same neutral response and send THIS
    to the real owner instead of a code."""
    settings = get_settings()
    subject = f"About your {settings.email_from_name} account"
    text = (
        "Someone tried to sign up for "
        f"{settings.email_from_name} using this email address, but an account "
        "already exists.\n\n"
        "If this was you, just log in with your existing account. If you forgot "
        "your password, you can reset it from the login screen.\n\n"
        "If this wasn't you, no action is needed - no new account was created.\n"
    )
    html = (
        f"<p>Someone tried to sign up for {settings.email_from_name} using this "
        "email address, but an account already exists.</p>"
        "<p>If this was you, just log in with your existing account. If you "
        "forgot your password, you can reset it from the login screen.</p>"
        "<p>If this wasn't you, no action is needed - no new account was created.</p>"
    )
    # code=None so the dev outbox records a notice, not a code.
    return await _deliver(to=to, subject=subject, html=html, text=text, code=None)
