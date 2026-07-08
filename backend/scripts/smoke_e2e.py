"""End-to-end smoke against a locally running API (default http://127.0.0.1:8000).

Drives the full client lifecycle over the wire: health, signup, me, save v0,
load, CAS save, stale-version conflict, wrong-password 401, export, logout.
Exits non-zero on the first failed expectation.
"""
import json
import sys
from pathlib import Path

import httpx

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"
USER = "smoketest"
PASS = "smokepass123"

checks: list[str] = []


def ok(name: str, cond: bool, extra: str = "") -> None:
    checks.append(name)
    if not cond:
        print(f"FAIL {name} {extra}")
        raise SystemExit(1)
    print(f"ok   {name}")


def main() -> None:
    c = httpx.Client(base_url=BASE, timeout=10)

    r = c.get("/api/health")
    ok("health", r.status_code == 200 and r.json() == {"status": "ok"})

    r = c.post("/api/auth/signup", json={"username": USER, "password": PASS})
    ok("signup 201", r.status_code == 201, r.text)
    token = r.json()["token"]
    auth = {"Authorization": f"Bearer {token}"}

    r = c.post("/api/auth/signup", json={"username": USER, "password": PASS})
    ok("dup signup 409", r.status_code == 409 and r.json()["error"] == "username_unavailable")

    r = c.get("/api/auth/me", headers=auth)
    ok("me", r.status_code == 200 and r.json()["username"] == USER)

    r = c.get("/api/data", headers=auth)
    ok("fresh load v0", r.status_code == 200 and r.json()["version"] == 0 and r.json()["data"] is None)

    snap = {
        "username": USER,
        "install": "2026-07-08",
        "updatedAt": "2026-07-08T10:00:00Z",
        "goals": {"2026-07-08": [{"id": "g1", "topic": "smoke", "hours": 1, "loggedHours": None,
                                   "completed": False, "subtasks": [], "createdAt": "2026-07-08"}]},
        "backlog": [], "recurring": [], "seeded": {}, "carriedThrough": "",
    }
    r = c.put("/api/data", headers=auth, json={"version": 0, "data": snap})
    ok("first save -> v1", r.status_code == 200 and r.json()["version"] == 1, r.text)

    r = c.get("/api/data", headers=auth)
    ok("load round-trip", r.json()["version"] == 1 and r.json()["data"]["goals"]["2026-07-08"][0]["topic"] == "smoke")

    r = c.put("/api/data", headers=auth, json={"version": 1, "data": snap})
    ok("CAS save -> v2", r.status_code == 200 and r.json()["version"] == 2)

    r = c.put("/api/data", headers=auth, json={"version": 1, "data": snap})
    body = r.json()
    ok("stale save 409 + winning doc", r.status_code == 409 and body["error"] == "version_conflict"
       and body["version"] == 2 and body["data"]["username"] == USER)

    r = c.put("/api/data", headers=auth, json={"version": 2, "data": {"goals": "nope"}})
    ok("bad shape 422", r.status_code == 422 and r.json().get("error") == "invalid_input", r.text)

    r = c.post("/api/auth/login", json={"username": USER, "password": "wrong-password"})
    ok("wrong password generic 401", r.status_code == 401 and r.json()["error"] == "invalid_credentials")

    r = c.post("/api/auth/login", json={"username": "nobody-here", "password": "wrong-password"})
    ok("unknown user same 401", r.status_code == 401 and r.json()["error"] == "invalid_credentials")

    r = c.get("/api/data/export", headers=auth)
    ok("export headers", r.status_code == 200 and "attachment" in r.headers.get("content-disposition", "")
       and r.json()["username"] == USER)

    r = c.post("/api/auth/logout", headers=auth)
    ok("logout 204", r.status_code == 204)
    r = c.get("/api/auth/me", headers=auth)
    ok("token dead after logout", r.status_code == 401 and r.json().get("error") == "unauthorized")

    # Legacy import parity: PUT the real v1 userData file shape if present.
    legacy = Path(__file__).resolve().parents[2] / "userData" / "harsh.json"
    if legacy.exists():
        r = c.post("/api/auth/signup", json={"username": "smokelegacy", "password": PASS})
        t2 = {"Authorization": f"Bearer {r.json()['token']}"}
        doc = json.loads(legacy.read_text(encoding="utf-8"))
        r = c.put("/api/data", headers=t2, json={"version": 0, "data": doc})
        ok("legacy v1 snapshot accepted", r.status_code == 200, r.text)
        r = c.get("/api/data", headers=t2)
        ok("legacy round-trip intact", r.json()["data"] == doc)

    print(f"\nSMOKE PASSED: {len(checks)} checks")


if __name__ == "__main__":
    main()
