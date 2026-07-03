---
description: Full regression across the whole app - logic, UI, and backend. No input needed.
---

Run the **full regression suite** across the whole app and report results. Run to completion without asking me anything.

Run all three suites from the project root:

1. Logic: `node tests/app.test.js`
2. UI end-to-end: `node tests/run_ui.mjs full`
   (headless Chrome drives the real app against an isolated temp server as user "testuser".)
3. Backend API: `python tests/server_test.py`
   (real server.py against an isolated temp data dir.)

Every suite runs in an isolated test environment and never touches my real userData/.

Then give me one combined report:

- Headline: total passed / failed across all three suites.
- A line per suite: `Logic: X/Y`, `UI: X/Y`, `Backend: X/Y`.
- For each ✗ failure: the test name and the most likely cause pointing at the file/function. Do not fix anything unless I ask.
- Note if the UI suite was skipped (no Chrome found).

Do not modify app code and do not commit - only run the tests and report.
