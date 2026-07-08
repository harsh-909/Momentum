"""Import legacy userData/<name>.json files into the Momentum 2.0 database.

Usage (from backend/, venv active or via .venv/Scripts/python):

    python scripts/import_userdata.py --dir ../userData
    python scripts/import_userdata.py --dir ../userData --user harsh --force

Prompts for an initial password per imported user. Respects DATABASE_URL,
so it works against the local SQLite dev.db or Neon depending on env.
Idempotent: existing usernames are skipped unless --force, which replaces
the snapshot but never the password.

The in-app Import button is the friendlier path for a single profile; this
script exists for bulk/initial migration.
"""
import argparse
import asyncio
import getpass
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import insert, select, update  # noqa: E402

from app.auth import hash_password, utcnow  # noqa: E402
from app.db import engine, init_db, session_factory, snapshots, users  # noqa: E402
from app.models import normalize_username  # noqa: E402


async def import_file(path: Path, password: str, force: bool) -> str:
    try:
        username = normalize_username(path.stem)
    except ValueError:
        return f"SKIP {path.name}: invalid username"

    doc = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(doc, dict):
        return f"SKIP {path.name}: not a JSON object"

    now = utcnow()
    async with session_factory() as db:
        existing = (
            await db.execute(select(users.c.id).where(users.c.username == username))
        ).first()

        if existing and not force:
            return f"SKIP {username}: already exists (use --force to replace snapshot)"

        if existing:
            user_id = existing.id
            row = (
                await db.execute(
                    select(snapshots.c.version).where(snapshots.c.user_id == user_id)
                )
            ).first()
            if row:
                await db.execute(
                    update(snapshots)
                    .where(snapshots.c.user_id == user_id)
                    .values(doc=doc, version=row.version + 1, updated_at=now)
                )
            else:
                await db.execute(
                    insert(snapshots).values(
                        user_id=user_id, version=1, doc=doc, updated_at=now
                    )
                )
            await db.commit()
            return f"OK   {username}: snapshot replaced (password unchanged)"

        result = await db.execute(
            insert(users).values(
                username=username,
                password_hash=hash_password(password),
                created_at=now,
                updated_at=now,
            )
        )
        user_id = result.inserted_primary_key[0]
        await db.execute(
            insert(snapshots).values(user_id=user_id, version=1, doc=doc, updated_at=now)
        )
        await db.commit()
        return f"OK   {username}: created with snapshot v1"


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dir", default="../userData", help="folder of <name>.json files")
    parser.add_argument("--user", help="import only this username")
    parser.add_argument("--password", help="initial password (otherwise prompted per user)")
    parser.add_argument("--force", action="store_true", help="replace existing snapshots")
    args = parser.parse_args()

    data_dir = Path(args.dir)
    files = sorted(data_dir.glob("*.json"))
    if args.user:
        files = [f for f in files if f.stem == args.user]
    if not files:
        print(f"No matching .json files in {data_dir.resolve()}")
        return 1

    await init_db()
    try:
        for path in files:
            password = args.password
            if password is None:
                password = getpass.getpass(f"Initial password for '{path.stem}' (8+ chars): ")
            if len(password) < 8:
                print(f"SKIP {path.stem}: password shorter than 8 chars")
                continue
            print(await import_file(path, password, args.force))
    finally:
        await engine.dispose()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
