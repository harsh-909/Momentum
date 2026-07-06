# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Momentum" - a daily-goals / habit tracker. The **UI is a single file: `index.html`**, paired with a tiny local backend `server.py`.
There is no build step, no package manager, and no tests. The app is **fully offline** - all frontend dependencies are vendored in `vendor/` (pinned copies; do not point back to CDNs):

- **Alpine.js 3.14.9** (`vendor/alpine.min.js`) - reactivity (`x-data`, `x-model`, `x-for`, `x-show`, `$watch`, `$nextTick`). The whole app is one Alpine component returned by the `app()` factory in the `<script>` block.
- **Tailwind CSS 3.4.16 Play build** (`vendor/tailwind.js`, in-browser JIT) plus a custom `<style>` block for the aurora background, glass morphism, confetti, and CSS variables (`--bg`, `--accent`, etc.). It logs a "not for production" console warning - expected and fine for this personal, local-only app.
- **Chart.js 4.4.0** (`vendor/chart.umd.min.js`) - the three canvases on the Momentum tab, rendered lazily in `renderCharts()`.
- **Fonts** (Plus Jakarta Sans, Fraunces) - self-hosted woff2 files under `vendor/fonts/` with `vendor/fonts/fonts.css` (URLs already rewritten to relative paths).

## Running it

Two ways:

- **Like an app (what the user does):** double-click `Momentum.pyw`. It runs under `pythonw` (no console), starts the server invisibly, and opens the browser at `http://localhost:8899`. If the server is already running it just opens a tab. The app is stopped from the UI's power button (⏻), which POSTs `/api/quit` -> `server.shutdown()` -> process exits.
- **For development:** `python server.py` (optional port arg, default 8899) - same server, but with a console for logs and Ctrl+C.

The backend is stdlib only (no dependencies); it serves the app **and** the persistence API. Do **not** use `python -m http.server` - that serves the static files but not the `/api/*` routes, so login and saving break. The `.claude/launch.json` "app" config runs `python server.py 8899`.

## Architecture (the parts that span the file)

### Client <-> server persistence

State lives in the Alpine component and is persisted **per user** to `userData/<username>.json` via `server.py`. There is no database and nothing leaves the machine.

- `server.py` (Python stdlib `http.server`) serves static files from the project root and exposes four JSON routes:
  - `GET /api/users` -> `["harsh", ...]` (filenames in `userData/`, minus `.json`)
  - `GET /api/load?user=<name>` -> that user's saved object, or `404` if new
  - `POST /api/save` `{username, data}` -> writes `userData/<username>.json` **atomically** (temp file + `os.replace`)
  - `POST /api/quit` -> replies `{ok: true}`, then shuts the server down (used by the header power button; how the invisible `Momentum.pyw` instance gets stopped)
- **Usernames are the identity and the filename.** They're validated by the SAME regex on both sides - JS `normalizeUsername()` and Python `normalize_username()` / `USERNAME_RE`: `^[a-z0-9][a-z0-9_-]{0,31}$`, lowercased. This is the path-traversal guard; keep the two in sync if you change it.
- The saved object shape (`snapshot()` in the client) is `{ username, install, updatedAt, goals, backlog, recurring, seeded }`.

Saving is **debounced** (`save()` -> 400ms -> `flushNow()`), so every mutation still just calls `this.save()` as before - it no longer writes synchronously. `flushNow()` drives the header save indicator (`saveStatus`: idle/saving/saved/error; error is click-to-retry). A `beforeunload` handler calls `beacon()` (`navigator.sendBeacon`) so a pending debounced change isn't lost on tab close. New profiles are created by `login()` calling `flushNow()` immediately so the file exists.

`login(name)` loads or creates a profile and only then sets `loggedIn = true`; `logout()` flushes and returns to the modal. **Alpine `$watch`es are registered once in `init()`, not in `login()`**, so repeated logout/login cycles don't stack duplicate watchers - they no-op while `loggedIn` is false.

Import/Export (`exportData()` / `importData()`) round-trips the same `snapshot()` shape as a downloadable/uploadable JSON file; import replaces the current profile and immediately `flushNow()`s.

**Dates are strings, never Date objects, in state.** Always `YYYY-MM-DD` via `dateStr()`. When you need a real Date, parse with `new Date(str + 'T00:00:00')` (local midnight - avoids UTC off-by-one). Follow this pattern; mixing raw `new Date(str)` will introduce timezone bugs.

**Habits are templates, not stored instances.** A habit in `recurring` is materialized into a day's goal list on demand by `ensureRecurring(date)`, which only ever seeds **today** (never past or future days, even on navigation), only on weekdays in the habit's `days` array, and records the placement in `seeded` so a deleted instance never reappears. Materialized goals carry a `recurringId` back-reference. Consequences to preserve when editing:
- `autoCarryPastDays()` never carries habits automatically (`recurringId` goals are skipped).
- `syncHabitToToday()` propagates a template edit onto today's instance *only if untouched/incomplete*, and pulls the instance out if it's no longer scheduled today.
- The "move to backlog" button IS available for habit-derived goals, but `moveToBacklog()` detaches the instance from its template (drops `recurringId`) so a rescheduled catch-up task doesn't collide with a freshly-seeded instance on the target day.

**Goal <-> subtask completion coupling:** toggling a goal complete marks all subtasks complete (`toggleGoal`); toggling subtasks recomputes the parent's `completed` as "every subtask done" (`toggleSubtask`); adding a subtask un-completes the parent.

**Tabs** (`today` / `backlog` / `habits` / `history` / `metrics`) are all rendered in one DOM, gated by `x-show` on `activeTab`. Metrics charts render only when that tab is opened (via the `$watch('activeTab', ...)` in `init`), and each render destroys the previous Chart instance to avoid leaks.

Metrics are computed on the fly from `dg_goals` over rolling windows: `getLast7Days()`, `getLast4Weeks()`, `metrics()` (streak, 7-day avg, logged hours, goal count). `loggedHours ?? hours` is the recurring pattern - planned hours are the fallback until the user logs actuals.

## Conventions

- IDs come from `uid()` (`Math.random` + timestamp). Keep using it for new goals/subtasks/habits.
- UI copy is time-of-day aware via `isEvening()` / `greeting()` - "add a goal for tomorrow" in the evening, etc.
- Prefer editing the existing `index.html` over splitting the UI into multiple files unless there is an pragmatic requirement to split things; the zero-build frontend is intentional. Keep `server.py` dependency-free (stdlib only).

Dont commit untill I ask explicity to do that.
