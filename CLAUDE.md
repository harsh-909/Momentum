# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## How to communicate with the owner (READ FIRST)

The owner runs this project through AI-driven development and is NOT a hands-on engineer. Talk to them like a product manager briefing a stakeholder, not like an engineer reading a bug tracker. This applies to EVERY explanation, status update, finding, and report - not just when asked.

- **Lead with plain language.** Say which part of the app you mean by what the user sees or does (e.g. "the little Saving/Saved label in the top bar", "the login screen", "the habits page"), not by file or function name.
- **For any issue, always answer three questions in this order:** (1) *What part of the app* is this about, in user terms? (2) *What is the problem* - what could a real person experience or lose, and how likely is it? (3) *What's the plan* to fix it, and how big a job is it (quick / medium / large).
- **Rank by real-world impact,** not technical severity. "Could someone lose data or fail to log in?" matters; "the type is loosely coerced" usually does not.
- **Keep code/file references out of the main explanation.** If precise pointers are useful, put them in a short "Technical detail" line at the end that the owner can ignore or hand back to an AI.
- **Avoid jargon** (409, CAS, watermark, contrast ratio, coercion, ...). If a term is unavoidable, define it in half a sentence.
- **Always give a recommendation and a decision.** End with what you'd do and the one or two choices you need from them, in business terms.

## How work ships: task -> commit -> pull request (FOLLOW EVERY TASK)

The owner reviews **pull requests (PRs)**, not code. Every substantive change ships as its own PR with a plain-language description; the owner approves by merging or rejects by closing. Never merge PRs yourself - merging is the owner's decision (it is also blocked in settings). Never commit directly to `main`.

For each task/request that changes files:
1. **Branch.** Create a branch off up-to-date `main`, named `type/short-slug` (e.g. `fix/save-status-edge`, `feat/plans-email-reminders`). Keep one logical change per branch - if the working tree already contains unrelated in-flight work, separate it into its own branch/PR rather than lumping it in.
2. **Verify before shipping.** Run the project's checks (frontend `npx tsc -b --noEmit` + `npx vitest run`; backend `python -m pytest`). Do not open a PR on red unless the owner asked to see failing work.
3. **Commit** with a conventional-commit message (`feat:`, `fix:`, `refactor:`, `chore:`, ...), no co-author trailer (per the owner's global rule).
4. **Push** the branch and **open a PR** with `gh pr create`, using the business-language template below.
5. **Hand back the PR link** and a one-line plain-language summary. Stop there - the owner merges or closes.

**PR description template (business language - the owner reads this, not the diff):**
```
## What this does
<1-3 sentences a non-engineer understands: which part of the app, what changes for a user.>

## Why
<the problem or request this addresses.>

## What to check (for the owner)
<the real-world things to eyeball, in user terms - e.g. "the Save failed message is now easier to read".>

## Risk
<quick / medium / large, and what could go wrong. Note if data or login is touched.>

## Technical detail (ignore unless curious)
<files/areas touched, test results - the only place code/jargon lives.>
```

Use the `/ship` command to run this whole flow. `gh` (GitHub CLI) must be installed and authenticated (`gh auth login`); if it is not, prepare the branch + commit and give the owner the one command to run. Recommend the owner enable branch protection on `main` so nothing lands without an approved PR.

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
