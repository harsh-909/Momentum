---
name: momentum-qa
description: QA for the Momentum 2.0 app specifically - inherits the global /qa methodology, then tests whatever the prompt asks - an isolated feature (e.g. "habits seeding"), the automated suites only ("suites"), the workMatter.md In Progress item ("board"), or the full project end to end (no args). Use for "test this feature", "run the suites", "full E2E of Momentum".
---

# /momentum-qa - project QA for Momentum 2.0

## Step 1 - Load the methodology

FIRST read the global QA skill and adopt it wholesale:

```
C:\Users\Harsh\.claude\skills\qa\SKILL.md
```

Everything there applies: the senior-test-engineer stance, risk-based planning, the named test-design techniques (boundary values, equivalence partitions, decision tables, state transitions, negative testing, exploratory charters), parallel subagent workstreams, adversarial verification, severity/priority triage, and the report format with exit criteria.
If that file is missing, say so and proceed with its principles as summarized in this sentence.

This file only adds what is Momentum-specific, and Momentum facts override generic recon.

## Step 2 - Pick the mode from the prompt args

- **No args / "full" / "e2e"** - the full Phase 0-3 pass over the whole app, all applicable workstreams.
- **"suites"** - automated checks only: frontend typecheck + Vitest, backend pytest, production build, plus the wire smoke script. One suite-runner agent, quick report, no exploratory work.
- **"board"** - read `workMatter.md`, take the **In Progress** item, and QA exactly that feature (as the old `/run-test` did): happy path plus edge cases designed with the global techniques.
- **Anything else** - treat the args as the feature/flow under test (e.g. "habit seeding", "import/export", "auth"). Scope the plan to that feature, its engine module(s), its API surface, and its UI, plus the blast radius of shared code it touches.

## Momentum facts (skip generic recon; verify only if something fails)

**Stack**: `frontend/` React 19 + Vite + TS + Zustand (ALL business logic in pure modules under `frontend/src/lib/engine/`), `backend/` FastAPI + SQLAlchemy async (SQLite dev, Postgres prod). `legacy/` is the frozen 1.x app - OUT of scope, never test or modify it.

**Test oracles**: `FEATURES.md` (product behavior), `CONTRACT.md` (API shapes + engine signatures), the domain invariants section of `CLAUDE.md` (3am day boundary, partial-credit scoring with the 99% cap, 70% streak with zero-goal break, today-only habit seeding, carry-over watermark, goal/subtask coupling, read-only past days).

**Commands** (backend venv is `backend/.venv`; always invoke `.venv/Scripts/python` explicitly):

```
cd frontend && npx tsc -b --noEmit          # typecheck
cd frontend && npx vitest run               # frontend suite (~388 tests)
cd frontend && npm run build                # production build
cd backend  && .venv/Scripts/python -m pytest tests -q       # backend suite (~36 tests)
cd backend  && .venv/Scripts/python -m uvicorn app.main:app --port 8000   # API (run in background)
cd backend  && .venv/Scripts/python scripts/smoke_e2e.py     # 17-check wire smoke (API must be running)
cd frontend && npm run dev                  # Vite on 5173 (proxies /api to 8000); may hop to 5174 if busy
```

**Data safety (hard rules)**:
- `userData/*.json` is real personal data: read-only as a realistic-import fixture, never mutate, never point the server at it.
- Isolate every server run: `DATABASE_URL=sqlite+aiosqlite:///./qa_<purpose>.db` (env var), and delete the file afterward. Never reuse `dev.db` if it might hold real data.
- backend pytest already isolates itself (`test.db` via conftest); the smoke script needs a running isolated API.

**Project-specific traps to test around**:
- Windows: SQLite files stay locked until the engine is disposed - dispose before deleting.
- The in-memory auth rate limiter will 429 rapid scripted logins: space auth attempts or restart the server between hostile-auth runs.
- Time-dependent logic (3am boundary, streaks, rollover) is testable without clock changes: engine functions take `now`/`today` as parameters - test at that layer, plus `checkDayRollover` via the store.
- Save pipeline is debounced 400ms with a version compare-and-swap: concurrency tests should race two clients on one account and expect a 409 whose body carries the winning doc.
- No browser automation is currently wired into this repo: UI journeys need an MCP browser tool if available, otherwise report the UI as component-test-covered-only, honestly.

**Conventions**: repro tests land next to the module (`*.test.ts` Vitest style) or in `backend/tests/` (pytest style). Never commit - Harsh commits explicitly. Report per the global format, including the feature x workstream coverage matrix built against `FEATURES.md` sections.
