# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Momentum" - a daily-goals / habit tracker.
This branch (`momentum-2.0`) is the full rewrite: `frontend/` (React 19 + Vite + TypeScript + Tailwind v4 + Zustand) and `backend/` (FastAPI + SQLAlchemy 2 async + Alembic).
The 1.x single-file Alpine app still runs from the `main` branch; `legacy/` here is a frozen read-only reference for the engine port - never edit it.
`CONTRACT.md` pins the wire contract (API routes/shapes) and the engine function signatures; keep it in sync with any signature change.
`userData/` holds real personal data, is gitignored, and must never be committed or moved.

## Commands

- `npm run dev` (repo root) - API on :8000 (SQLite `backend/dev.db`) + Vite on :5173 with `/api` proxied. No cloud DB needed locally.
- `cd frontend && npx vitest run` - frontend tests. `npx tsc -b --noEmit` - typecheck. `npm run build` - production build.
- `cd backend && .venv/Scripts/python -m pytest` - backend tests.
- `cd backend && .venv/Scripts/python scripts/smoke_e2e.py` - wire-level smoke (start the API first).
- Backend venv lives at `backend/.venv`; always invoke it explicitly (`.venv/Scripts/python`), never assume an activated shell.
- Alembic: `cd backend && .venv/Scripts/python -m alembic upgrade head` (SQLite dev never needs it - tables auto-create on startup).

## Architecture

### Where logic lives (the most important rule)

ALL business logic is in `frontend/src/lib/engine/` - pure, framework-free TypeScript modules (time, dates, scoring, goals, backlog, carryover, habits, metrics, copy, validate) operating on the `Snapshot` type.
Engine functions mutate a passed snapshot in place (they run inside immer drafts), take `today` as a parameter, and never call `Date.now()` internally.
The Zustand store (`src/store/useAppStore.ts`) is thin: actions are two-line wrappers that call an engine function and mark the store dirty.
UI components dispatch store actions and compute derived values by calling engine functions directly.
New behavior goes in the engine with unit tests first, then gets a thin store action, then UI.

### Persistence

The whole app state is ONE JSON document per user (the `Snapshot` in `src/types/domain.ts` - same shape as v1 `userData/<name>.json`, keep import compatibility).
`src/store/persistence.ts` debounces saves 400ms, drives the save-status chip, flushes with `fetch keepalive` on pagehide, and adopts the server doc on a 409.
The backend stores it opaquely in a JSONB column with an integer-version compare-and-swap (`PUT /api/data {version, data}`); the server never reads inside the doc.
Auth is argon2id + opaque Bearer session tokens (localStorage); the username regex `^[a-z0-9][a-z0-9_-]{0,31}$` must stay identical in `frontend/src/types/domain.ts` and `backend/app/models.py`.

### Domain invariants (preserve these when editing)

- Dates are `YYYY-MM-DD` strings in state, never Date objects; parse via `parseLocalDate` (`+ 'T00:00:00'`). The logical day starts at 3am (`currentDay`).
- Time is stored as decimal hours; h+m is UI-only (`HmInput`, `fmtDuration` - never renders "60m").
- Partial credit: `dayProgressPct` caps at 99 unless every goal is complete; streak needs >= 70% and a zero-goal day breaks it.
- Habits are templates (`recurring`), seeded ONLY on today by `ensureRecurring`, gated by weekday/startDate/`seeded` registry; day-bound - never carried over, never movable to backlog.
- Carry-over (`sweepPastDays`) copies incomplete non-habit remainders to backlog exactly once (watermark `carriedThrough` + per-goal `carried` flag).
- Goal <-> subtask coupling: completing a goal checks all subtasks; all-subtasks-done completes the goal; adding a subtask un-completes it; subtask logged time rolls up to `goal.loggedHours` (null when 0).
- Past days are read-only: engine mutators guard via `isReadonly(date, today)` AND the UI hides/disables the controls.

### Design system ("Instrument")

Tokens live in `frontend/src/styles/theme.css` (Tailwind v4 `@theme`; `.dark` class overrides).
Flat instrument-panel look: hairline borders, radius tokens (card 10 / btn 8 / badge 6), no glassmorphism, no shadows except overlays.
Orange (`--color-accent`) is rationed: dial sweep, active tab, primary buttons, streak. Grades use good/warn/alert only.
All numerals render in IBM Plex Mono (`.font-mono-num`); display type is Archivo (`.font-display`); icons are hand-drawn thin-stroke SVGs, never emoji.
Motion uses `--ease-click` (120-160ms) and `--ease-sweep` (400ms) and must respect `prefers-reduced-motion`.

## Conventions

- IDs come from `uid()` in `src/lib/id.ts`.
- Colocate tests next to the module (`foo.test.ts`); engine test fixtures live in `src/lib/engine/testFactories.ts`.
- Backend error bodies are top-level `{"error": "<machine_code>"}`; routes return `JSONResponse` for errors, Pydantic models for success.
- Keep `backend/app/db.py` and `backend/migrations/versions/` in sync when touching the schema (new Alembic revision, never edit an applied one).
- The deployed API must never grow a user-enumeration endpoint or `/api/quit` (v1 leftovers - see CONTRACT.md).

Dont commit untill I ask explicity to do that.
