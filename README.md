# Momentum

A daily-goals and habit tracker built around one honest question: how did the time you planned compare to the time you actually spent?

Version 2.0 is a full rewrite: React 19 + TypeScript + Tailwind v4 frontend, FastAPI + Postgres backend, deployable free on Vercel + Render + Neon.
The 1.x single-file Alpine.js app lives on the `main` branch (frozen reference copy in `legacy/`).

## Features

- **Today**: plan goals with h+m estimates and subtasks, check them off (confetti included), log actual time per subtask or per goal, reorder by drag or keyboard.
- **Partial-credit scoring**: a day's progress ring fills per goal, subtask by subtask; a day shows 100% only when everything is truly done.
- **Habits**: weekday-scheduled templates that materialize on the day itself; day-bound - a missed habit stays missed.
- **Backlog + auto carry-over**: unfinished (non-habit) goals from past days sweep into the backlog exactly once, with their pending subtasks.
- **Read-only past days**: history reflects what actually happened; the day rolls over live at 3am.
- **History + Metrics**: color-graded day log with filters, streak (70% partial-credit threshold), 7-day and 4-week charts drawn as hand-rolled SVG.
- **Multi-user with real auth**: username + password (argon2id), opaque bearer sessions, per-user snapshot storage with optimistic-concurrency saves.
- **Import/export**: your data is one JSON document; v1 exports import cleanly.

## Repo layout

```
frontend/   React 19 + Vite + TS + Tailwind v4 + Zustand (business logic in src/lib/engine - pure, framework-free)
backend/    FastAPI + SQLAlchemy 2 async + Alembic (SQLite locally, Postgres in prod)
legacy/     Frozen 1.x app (reference for the engine port)
CONTRACT.md The wire + engine contracts the workstreams built against
DEPLOYMENT.md  Step-by-step free-tier deploy (Neon + Render + Vercel)
```

## Local development (Windows-friendly, no Docker)

One-time setup:

```
cd frontend && npm install && cd ..
python -m venv backend/.venv
backend\.venv\Scripts\python -m pip install -r backend/requirements-dev.txt
npm install               # root: just the `concurrently` dev runner
```

Run both halves:

```
npm run dev               # API on :8000 (SQLite dev.db), Vite on :5173 with /api proxied
```

Open http://localhost:5173 and sign up.
No cloud database needed - `DATABASE_URL` unset means a local SQLite file.

## Tests

```
npm test                                  # frontend (Vitest) + backend (pytest)
cd frontend && npx vitest run             # 388 tests: engine parity + components
cd backend && .venv\Scripts\python -m pytest   # 36 tests: auth + data + validation
cd backend && .venv\Scripts\python scripts/smoke_e2e.py   # wire-level smoke (needs the API running)
```

## Production-like single-origin smoke

```
cd frontend && npm run build
cd ../backend && set SERVE_STATIC=1 && .venv\Scripts\python -m uvicorn app.main:app --port 8000
```

Serves the built frontend and the API from one origin at http://localhost:8000.

## Deploying

See [DEPLOYMENT.md](DEPLOYMENT.md) - Neon (Postgres) + Render (API) + Vercel (static) + a cron pinger, all free tier.
