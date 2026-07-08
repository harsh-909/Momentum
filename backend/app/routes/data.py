"""Data routes: load / save (version compare-and-swap) / export.

Concurrency model (CONTRACT.md): the client echoes back the version it last
loaded; the save only lands if that version is still current. A lost race
returns 409 with the winning row so the client can merge/reload instead of
silently clobbering another device's save.
"""
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import insert, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user
from ..db import get_db, snapshots
from ..models import LoadOut, SaveIn, SaveOut

router = APIRouter(prefix="/api/data", tags=["data"])


def _iso_utc(dt: datetime) -> str:
    """Format a stored timestamp as ISO-8601 UTC.

    SQLite hands back naive datetimes; we always write UTC, so re-attach the
    zone rather than guessing local time. Postgres returns aware values.
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


def _conflict(version: int, doc: dict[str, Any] | None) -> JSONResponse:
    """409 body carries the winning row per the contract."""
    return JSONResponse(
        status_code=409,
        content={"error": "version_conflict", "version": version, "data": doc},
    )


async def _current_row(db: AsyncSession, user_id: int):
    result = await db.execute(
        select(snapshots.c.version, snapshots.c.updated_at, snapshots.c.doc).where(
            snapshots.c.user_id == user_id
        )
    )
    return result.one_or_none()


@router.get("", response_model=LoadOut)
async def load(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LoadOut:
    row = await _current_row(db, user.id)
    if row is None:
        # Never saved: the client treats this as "fresh profile".
        return LoadOut(version=0, updatedAt=None, data=None)
    return LoadOut(version=row.version, updatedAt=_iso_utc(row.updated_at), data=row.doc)


@router.put("", response_model=SaveOut)
async def save(
    payload: SaveIn,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)

    if payload.version == 0:
        # First save: INSERT. Two clients racing the first save is resolved by
        # the primary key - the loser's IntegrityError falls through to 409.
        try:
            await db.execute(
                insert(snapshots).values(
                    user_id=user.id, version=1, doc=payload.data, updated_at=now
                )
            )
            await db.commit()
            return SaveOut(version=1, updatedAt=_iso_utc(now))
        except IntegrityError:
            await db.rollback()
        row = await _current_row(db, user.id)
        if row is None:  # pragma: no cover - rows are never deleted
            return _conflict(0, None)
        return _conflict(row.version, row.doc)

    # Compare-and-swap: only lands if the client's version is still current.
    result = await db.execute(
        update(snapshots)
        .where(snapshots.c.user_id == user.id, snapshots.c.version == payload.version)
        .values(doc=payload.data, version=payload.version + 1, updated_at=now)
    )
    if result.rowcount == 0:
        await db.rollback()
        row = await _current_row(db, user.id)
        if row is None:
            # version > 0 against a user with no snapshot: stale client.
            return _conflict(0, None)
        return _conflict(row.version, row.doc)
    await db.commit()
    return SaveOut(version=payload.version + 1, updatedAt=_iso_utc(now))


@router.get("/export")
async def export(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    doc = (
        await db.execute(select(snapshots.c.doc).where(snapshots.c.user_id == user.id))
    ).scalar_one_or_none()
    utc_date = datetime.now(timezone.utc).date().isoformat()
    filename = f"momentum-{user.username}-{utc_date}.json"
    return JSONResponse(
        content=doc if doc is not None else {},
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
