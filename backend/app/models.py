"""Pydantic request/response models - the backend half of CONTRACT.md.

Snapshot validation is shallow-strict, deep-opaque: the top-level shape is
checked (date-keyed maps, lists), but goal/habit internals belong to the
client and are stored verbatim. The 2 MB body cap bounds abuse.
"""
import re
from typing import Any

from pydantic import BaseModel, EmailStr, Field, field_validator

USERNAME_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,31}$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

# Verification codes are exactly 6 digits.
CODE_RE = re.compile(r"^\d{6}$")


def normalize_username(name: str) -> str:
    """Return the normalized username, or raise ValueError. Mirror of the JS side."""
    clean = name.strip().lower()
    if not USERNAME_RE.fullmatch(clean):
        raise ValueError("username must match ^[a-z0-9][a-z0-9_-]{0,31}$")
    return clean


def normalize_email(email: str) -> str:
    """Lowercase + strip. Consumer-grade normalization (local-part case is
    technically significant but treating addresses case-insensitively is the
    universal expectation and keeps 'one account per email' intuitive)."""
    return email.strip().lower()


class Credentials(BaseModel):
    """Login input."""

    username: str
    password: str = Field(min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def _normalize(cls, v: str) -> str:
        return normalize_username(v)


class SignupIn(BaseModel):
    """Signup input - like Credentials but email is now mandatory."""

    username: str
    password: str = Field(min_length=8, max_length=128)
    email: EmailStr

    @field_validator("username")
    @classmethod
    def _normalize_username(cls, v: str) -> str:
        return normalize_username(v)

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, v: str) -> str:
        return normalize_email(v)


class VerifyIn(BaseModel):
    pendingToken: str = Field(min_length=1, max_length=128)
    code: str

    @field_validator("code")
    @classmethod
    def _check_code(cls, v: str) -> str:
        v = v.strip()
        if not CODE_RE.fullmatch(v):
            raise ValueError("code must be 6 digits")
        return v


class PendingTokenIn(BaseModel):
    pendingToken: str = Field(min_length=1, max_length=128)


class AddEmailIn(BaseModel):
    pendingToken: str = Field(min_length=1, max_length=128)
    email: EmailStr

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, v: str) -> str:
        return normalize_email(v)


class UserOut(BaseModel):
    username: str
    email: str | None = None


class AuthOut(BaseModel):
    token: str
    user: UserOut
    expiresAt: str
    emailVerified: bool = True


class MeOut(BaseModel):
    username: str
    email: str | None
    emailVerified: bool
    createdAt: str


class SaveIn(BaseModel):
    version: int = Field(ge=0)
    data: dict[str, Any]

    @field_validator("data")
    @classmethod
    def _check_top_level(cls, doc: dict[str, Any]) -> dict[str, Any]:
        for key in ("goals", "seeded"):
            value = doc.get(key, {})
            if not isinstance(value, dict):
                raise ValueError(f"'{key}' must be an object")
            for date, items in value.items():
                if not DATE_RE.fullmatch(str(date)):
                    raise ValueError(f"'{key}' keys must be YYYY-MM-DD")
                if not isinstance(items, list):
                    raise ValueError(f"'{key}' values must be arrays")
        for key in ("backlog", "recurring"):
            if not isinstance(doc.get(key, []), list):
                raise ValueError(f"'{key}' must be an array")
        for key in ("install", "carriedThrough", "username", "updatedAt"):
            if key in doc and not isinstance(doc[key], str):
                raise ValueError(f"'{key}' must be a string")
        return doc


class SaveOut(BaseModel):
    version: int
    updatedAt: str


class LoadOut(BaseModel):
    version: int
    updatedAt: str | None
    data: dict[str, Any] | None
