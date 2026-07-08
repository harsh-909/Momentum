#!/usr/bin/env python3
"""Double-click launcher for Momentum.

.pyw means Windows runs this with pythonw - no console window. It starts the
local server invisibly and opens the app in your default browser. If Momentum
is already running, it just opens a new browser tab. Quit from the app's
power button (top-right), which stops the hidden server.
"""
import os
import sys
import threading
import urllib.request
import webbrowser

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import server  # server.py in this folder

PORT = server.DEFAULT_PORT
URL = f"http://localhost:{PORT}"


def already_running():
    try:
        with urllib.request.urlopen(f"{URL}/api/users", timeout=1) as res:
            return res.status == 200
    except Exception:
        return False


def main():
    if already_running():
        webbrowser.open(URL)
        return
    os.makedirs(server.DATA_DIR, exist_ok=True)
    httpd = server.ThreadingHTTPServer(("127.0.0.1", PORT), server.Handler)
    # Open the browser once the socket is bound (it is, after the ctor above).
    threading.Timer(0.3, webbrowser.open, args=(URL,)).start()
    # Runs until /api/quit calls shutdown(), then the process exits.
    httpd.serve_forever()


if __name__ == "__main__":
    # pythonw has no console, so an uncaught exception would vanish without a
    # trace. Log it to a file next to the app instead.
    try:
        main()
    except Exception:
        import traceback
        with open(os.path.join(HERE, "launcher-error.log"), "a", encoding="utf-8") as fh:
            fh.write(traceback.format_exc() + "\n")
        raise
