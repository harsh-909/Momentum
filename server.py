#!/usr/bin/env python3
"""Local-only server for the Momentum app.

Serves the static app AND persists each user's data as userData/<username>.json
in the project folder. Nothing leaves this machine - there is no external service,
database, or network dependency beyond the CDN libraries the page itself loads.

Run:
    python server.py            # http://localhost:8899
    python server.py 9000       # custom port
"""
import json
import os
import re
import sys
import tempfile
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(ROOT, "userData")
DEFAULT_PORT = 8899
MAX_BODY = 8 * 1024 * 1024  # 8 MB cap - guards against a runaway payload

# A username maps 1:1 to a filename, so it must be strictly safe: lowercase
# alnum plus - and _, starting alphanumeric, max 32 chars. This is what keeps
# "../../etc/passwd" and friends out of user_path().
USERNAME_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,31}$")


def normalize_username(name):
    """Return a filesystem-safe username, or None if it can't be made valid."""
    if not isinstance(name, str):
        return None
    name = name.strip().lower()
    return name if USERNAME_RE.match(name) else None


def user_path(username):
    # username is already validated by normalize_username; join stays inside DATA_DIR.
    return os.path.join(DATA_DIR, username + ".json")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # Never let the browser cache the app shell: a cached index.html shown
        # while the server is down produces a confusing half-working page
        # ("Cannot reach the local server") instead of an honest error page.
        if self.path == "/" or self.path.endswith(".html"):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    # ---- helpers ----
    def _send_json(self, obj, status=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        # This is a local single-user tool; no caching of API responses.
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            return None
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return None

    # ---- routing ----
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/users":
            return self._list_users()
        if parsed.path == "/api/load":
            qs = parse_qs(parsed.query)
            return self._load_user(qs.get("user", [""])[0])
        # Fall back to static file serving (index.html, etc.)
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/save":
            return self._save_user()
        if parsed.path == "/api/quit":
            # Used by the app's power button (and the .pyw launcher flow):
            # reply first, then stop the server from another thread so this
            # request can finish cleanly. The launcher process then exits.
            self._send_json({"ok": True})
            threading.Thread(target=self.server.shutdown, daemon=True).start()
            return
        self._send_json({"error": "not found"}, 404)

    # ---- API handlers ----
    def _list_users(self):
        try:
            names = sorted(
                f[:-5]
                for f in os.listdir(DATA_DIR)
                if f.endswith(".json") and normalize_username(f[:-5])
            )
        except FileNotFoundError:
            names = []
        self._send_json(names)

    def _load_user(self, raw_name):
        username = normalize_username(raw_name)
        if not username:
            return self._send_json({"error": "invalid username"}, 400)
        path = user_path(username)
        if not os.path.exists(path):
            return self._send_json({"error": "not found", "exists": False}, 404)
        try:
            with open(path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
        except (OSError, ValueError):
            return self._send_json({"error": "corrupt record"}, 500)
        self._send_json(data)

    def _save_user(self):
        payload = self._read_json_body()
        if not isinstance(payload, dict):
            return self._send_json({"error": "invalid body"}, 400)
        username = normalize_username(payload.get("username"))
        data = payload.get("data")
        if not username or not isinstance(data, dict):
            return self._send_json({"error": "invalid username or data"}, 400)

        os.makedirs(DATA_DIR, exist_ok=True)
        # Atomic write: dump to a temp file in the same dir, then replace, so a
        # crash mid-write never leaves a half-written record.
        fd, tmp = tempfile.mkstemp(dir=DATA_DIR, suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                json.dump(data, fh, indent=2, ensure_ascii=False)
            os.replace(tmp, user_path(username))
        except OSError:
            if os.path.exists(tmp):
                os.remove(tmp)
            return self._send_json({"error": "write failed"}, 500)
        self._send_json({"ok": True, "username": username})

    def log_message(self, fmt, *args):
        # Under pythonw (the Momentum.pyw launcher) there is no console and
        # sys.stderr is None, so the base log_message would raise and kill the
        # request mid-response - the client sees a dead connection instead of
        # its 404/4xx. Skip logging entirely in that case.
        if sys.stderr is None:
            return
        # Keep the console quiet except for genuine errors.
        if str(args[1] if len(args) > 1 else "").startswith(("4", "5")):
            super().log_message(fmt, *args)


def main():
    port = DEFAULT_PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"Ignoring invalid port {sys.argv[1]!r}, using {DEFAULT_PORT}")
    os.makedirs(DATA_DIR, exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Momentum running at http://localhost:{port}")
    print(f"Saving user data to {DATA_DIR}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping.")
        server.shutdown()


if __name__ == "__main__":
    main()
