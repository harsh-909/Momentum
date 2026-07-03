#!/usr/bin/env python3
"""Backend regression tests for server.py.

Runs the real server against an ISOLATED temp data dir (via MOMENTUM_DATA_DIR),
so your real userData/ is never touched, and exercises the JSON API as the
dedicated 'testuser' account. Stdlib only - no third-party deps, matching the app.

Run directly:  python tests/server_test.py
Exit code is non-zero if any check fails (so CI / the slash command can detect it).
"""
import json
import os
import shutil
import sys
import tempfile
import threading
import urllib.error
import urllib.parse
import urllib.request
from http.server import ThreadingHTTPServer

# Redirect the data dir BEFORE importing server: DATA_DIR is resolved at import time.
TEST_DATA_DIR = tempfile.mkdtemp(prefix="momentum_test_")
os.environ["MOMENTUM_DATA_DIR"] = TEST_DATA_DIR

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import server  # noqa: E402  (import after env var is set)

TEST_USER = "testuser"

# Windows consoles default to cp1252 and choke on ✓/✗; force UTF-8 output.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

# ---- tiny assert harness (matches the JS runner's ✓/✗ style) ----
_passed = 0
_failed = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print(f"  ✓ {name}")
    else:
        _failed += 1
        print(f"  ✗ {name}" + (f"  ->  {detail}" if detail else ""))


# ---- HTTP helpers ----
PORT = 0


def _url(path):
    return f"http://127.0.0.1:{PORT}{path}"


def http_get(path):
    try:
        with urllib.request.urlopen(_url(path)) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))


def http_post(path, obj):
    data = json.dumps(obj).encode("utf-8")
    req = urllib.request.Request(
        _url(path), data=data, headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))


SNAPSHOT = {
    "username": TEST_USER,
    "install": "2026-07-01",
    "updatedAt": "2026-07-03T00:00:00.000Z",
    "goals": {
        "2026-07-03": [
            {
                "id": "g1",
                "topic": "Test goal",
                "hours": 1,
                "loggedHours": None,
                "completed": False,
                "subtasks": [{"id": "s1", "text": "step one", "completed": False}],
                "createdAt": "2026-07-03",
            }
        ]
    },
    "backlog": [],
    "recurring": [],
    "seeded": {},
}


def run():
    print("Backend tests (server.py) - isolated env, user 'testuser'")

    # --- unit: username normalization + path-traversal guard ---
    check("normalize lowercases", server.normalize_username("TestUser") == "testuser")
    check("normalize accepts valid", server.normalize_username("ok-name_1") == "ok-name_1")
    check("normalize rejects traversal", server.normalize_username("../secret") is None)
    check("normalize rejects empty", server.normalize_username("") is None)
    check("normalize rejects too long", server.normalize_username("a" * 33) is None)
    check("normalize rejects non-string", server.normalize_username(None) is None)
    check(
        "user_path stays inside DATA_DIR",
        os.path.abspath(server.user_path("testuser")).startswith(os.path.abspath(TEST_DATA_DIR)),
    )

    # --- integration: real API on isolated env ---
    status, body = http_get("/api/users")
    check("users list empty on fresh env", status == 200 and body == [], f"{status} {body}")

    status, body = http_get("/api/load?" + urllib.parse.urlencode({"user": TEST_USER}))
    check("load missing user -> 404", status == 404, f"{status} {body}")

    status, body = http_post("/api/save", {"username": TEST_USER, "data": SNAPSHOT})
    check("save testuser -> 200 ok", status == 200 and body.get("ok") is True, f"{status} {body}")

    check(
        "file written to isolated dir",
        os.path.exists(os.path.join(TEST_DATA_DIR, "testuser.json")),
    )

    status, body = http_get("/api/load?" + urllib.parse.urlencode({"user": TEST_USER}))
    check("load testuser round-trips data", status == 200 and body == SNAPSHOT, f"{status}")

    status, body = http_get("/api/load?" + urllib.parse.urlencode({"user": "TestUser"}))
    check("load is case-insensitive (TestUser -> testuser)", status == 200 and body == SNAPSHOT)

    status, body = http_get("/api/load?" + urllib.parse.urlencode({"user": "../secret"}))
    check("load rejects path traversal -> 400", status == 400, f"{status} {body}")

    status, body = http_post("/api/save", {"username": "../evil", "data": SNAPSHOT})
    check("save rejects bad username -> 400", status == 400, f"{status} {body}")

    status, body = http_post("/api/save", {"username": TEST_USER, "data": "not-an-object"})
    check("save rejects non-object data -> 400", status == 400, f"{status} {body}")

    status, body = http_get("/api/users")
    check("users list now contains testuser", status == 200 and body == ["testuser"], f"{body}")

    print(f"\nBackend: {_passed} passed, {_failed} failed")
    return _failed == 0


def main():
    global PORT
    server.Handler.log_message = lambda *a, **k: None  # keep the test report clean
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
    PORT = httpd.server_address[1]
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    try:
        ok = run()
    finally:
        httpd.shutdown()
        shutil.rmtree(TEST_DATA_DIR, ignore_errors=True)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
