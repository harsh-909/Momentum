"""Tests for /api/data: load, compare-and-swap save, export.

Auth is stubbed via FastAPI dependency_overrides (the real get_current_user
is a parallel workstream); the user row itself is inserted directly so the
snapshots FK is satisfied. Setup helpers run on their own event loop via
asyncio.run - the aiosqlite driver creates per-call futures on the running
loop, so sharing the engine with TestClient's portal loop is safe.
"""
import asyncio
from datetime import datetime, timezone

import pytest

from app.auth import CurrentUser, get_current_user

DOC = {
    "username": "tester",
    "install": "2026-07-01",
    "goals": {"2026-07-08": [{"id": "g1", "text": "ship it", "completed": False}]},
    "seeded": {"2026-07-08": ["h1"]},
    "backlog": [],
    "recurring": [],
}

DOC_V2 = {**DOC, "backlog": [{"id": "b1", "text": "later"}]}


def _insert_user(username: str = "tester") -> int:
    """Insert a user row directly (bypasses the auth workstream)."""

    async def _run() -> int:
        from app.db import session_factory, users

        async with session_factory() as session:
            result = await session.execute(
                users.insert()
                .values(username=username, password_hash="not-a-real-hash")
                .returning(users.c.id)
            )
            user_id = result.scalar_one()
            await session.commit()
            return user_id

    return asyncio.run(_run())


@pytest.fixture(autouse=True)
def _dispose_engine(client):
    """Windows workaround: conftest unlinks test.db on teardown, but the
    module-level engine's pooled aiosqlite connections keep the file locked.
    Depending on ``client`` orders this teardown BEFORE the unlink."""
    yield
    from app.db import engine

    asyncio.run(engine.dispose())


@pytest.fixture()
def user_client(client):
    """The shared client, authenticated as a freshly inserted user."""
    from app.main import app

    user_id = _insert_user()
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id=user_id, username="tester", created_at=datetime.now(timezone.utc)
    )
    try:
        yield client
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def _assert_iso_utc(value: str) -> None:
    parsed = datetime.fromisoformat(value)
    assert parsed.tzinfo is not None
    assert parsed.utcoffset().total_seconds() == 0


# ---------------------------------------------------------------- load


def test_fresh_load_returns_empty_state(user_client):
    r = user_client.get("/api/data")
    assert r.status_code == 200
    assert r.json() == {"version": 0, "updatedAt": None, "data": None}


def test_load_after_save_returns_doc(user_client):
    assert user_client.put("/api/data", json={"version": 0, "data": DOC}).status_code == 200
    r = user_client.get("/api/data")
    assert r.status_code == 200
    body = r.json()
    assert body["version"] == 1
    assert body["data"] == DOC
    _assert_iso_utc(body["updatedAt"])


# ---------------------------------------------------------------- save


def test_first_save_creates_version_1(user_client):
    r = user_client.put("/api/data", json={"version": 0, "data": DOC})
    assert r.status_code == 200
    body = r.json()
    assert body["version"] == 1
    _assert_iso_utc(body["updatedAt"])


def test_cas_save_increments_version(user_client):
    user_client.put("/api/data", json={"version": 0, "data": DOC})
    r = user_client.put("/api/data", json={"version": 1, "data": DOC_V2})
    assert r.status_code == 200
    assert r.json()["version"] == 2
    assert user_client.get("/api/data").json()["data"] == DOC_V2


def test_stale_version_conflicts_with_server_doc(user_client):
    user_client.put("/api/data", json={"version": 0, "data": DOC})
    user_client.put("/api/data", json={"version": 1, "data": DOC_V2})  # now at 2
    r = user_client.put("/api/data", json={"version": 1, "data": DOC})  # stale
    assert r.status_code == 409
    body = r.json()
    assert body["error"] == "version_conflict"
    assert body["version"] == 2
    assert body["data"] == DOC_V2  # the winning doc


def test_version_zero_against_existing_row_conflicts(user_client):
    user_client.put("/api/data", json={"version": 0, "data": DOC})
    r = user_client.put("/api/data", json={"version": 0, "data": DOC_V2})
    assert r.status_code == 409
    body = r.json()
    assert body["error"] == "version_conflict"
    assert body["version"] == 1
    assert body["data"] == DOC


def test_nonexistent_version_conflicts_even_without_row(user_client):
    # Stale client thinks it has version 5 but never saved: still a 409.
    r = user_client.put("/api/data", json={"version": 5, "data": DOC})
    assert r.status_code == 409
    assert r.json()["error"] == "version_conflict"


def test_non_dict_data_is_422(user_client):
    r = user_client.put("/api/data", json={"version": 0, "data": "not an object"})
    assert r.status_code == 422


def test_non_date_goals_key_is_422(user_client):
    bad = {**DOC, "goals": {"not-a-date": []}}
    r = user_client.put("/api/data", json={"version": 0, "data": bad})
    assert r.status_code == 422


def test_negative_version_is_422(user_client):
    r = user_client.put("/api/data", json={"version": -1, "data": DOC})
    assert r.status_code == 422


def test_oversized_body_is_413(user_client):
    huge = {**DOC, "blob": "x" * (2 * 1024 * 1024 + 1024)}  # just past the 2 MB cap
    r = user_client.put("/api/data", json={"version": 0, "data": huge})
    assert r.status_code == 413
    assert r.json() == {"error": "payload_too_large"}


# ---------------------------------------------------------------- export


def test_export_returns_doc_as_attachment(user_client):
    user_client.put("/api/data", json={"version": 0, "data": DOC})
    r = user_client.get("/api/data/export")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/json")
    today = datetime.now(timezone.utc).date().isoformat()
    assert (
        r.headers["content-disposition"]
        == f'attachment; filename="momentum-tester-{today}.json"'
    )
    assert r.json() == DOC


def test_export_without_snapshot_is_empty_object(user_client):
    r = user_client.get("/api/data/export")
    assert r.status_code == 200
    assert "attachment" in r.headers["content-disposition"]
    assert r.json() == {}


# ---------------------------------------------------------------- auth gate


def test_unauthenticated_requests_are_401(client):
    # No dependency override: the real get_current_user rejects missing tokens.
    assert client.get("/api/data").status_code == 401
    assert client.put("/api/data", json={"version": 0, "data": DOC}).status_code == 401
    assert client.get("/api/data/export").status_code == 401
