# Features

Momentum is a daily-goals and habit tracker built around one question: how did the time you planned compare to the time you actually spent?

Version 2.0 is a client-server web app: a React 19 + TypeScript frontend (Vite, Tailwind v4, Zustand) and a FastAPI + Postgres backend.
It runs locally with one command (`npm run dev`, SQLite, no cloud) and deploys free to Vercel + Render + Neon (see `DEPLOYMENT.md`).
The interface is organized into five tabs: **Today**, **Backlog**, **Habits**, **History**, and **Momentum** (metrics).

> This file documents what the app does. Work in flight lives in `workMatter.md`; wire/engine contracts in `CONTRACT.md`. The 1.x local-only app is preserved under `legacy/`.

## Accounts & data

- **Username + password accounts** - passwords are hashed with argon2id; sessions are opaque bearer tokens with a 30-day sliding expiry. Usernames are lowercase letters/numbers/`-`/`_` (max 32).
- **Sign up / log in** - one screen with both actions. Unknown-user and wrong-password failures are deliberately indistinguishable (no account enumeration), and auth endpoints are rate-limited.
- **Recent profiles** - the login screen offers one-tap pills for usernames previously used on this device (stored locally, never listed by the server).
- **Switch user** - the avatar button (your initial) in the header logs out and returns to the login screen.
- **Automatic save** - every change is saved to the server after a 400ms debounce; a header chip shows "Saving… / Saved", or "Save failed - retry" (click to retry). A pending change is flushed when the tab closes or hides.
- **Multi-device safety** - each save carries a version number; if another tab or device saved first, the app adopts the newer copy instead of silently overwriting it.
- **One document per user** - all state is a single JSON snapshot, stored opaquely in Postgres (JSONB). The server never inspects its contents.
- **Export** - download your data as a formatted JSON file (`momentum-<user>-<date>.json`).
- **Import** - load data from a JSON file, replacing the current profile (with a confirmation prompt). v1 `userData/*.json` files import cleanly.

## Onboarding & personalization

- **Personalized greeting** - "Good morning / afternoon / evening", "Burning the midnight oil", or "Winding down" by the current hour, addressed to your name.
- **Daily quote** - chosen deterministically from the day of the month, so it stays the same all day and rotates over time.
- **Streak chip** - the header shows your current day streak (hidden on very small screens).
- **Light & dark themes** - a sun/moon toggle; the first visit follows your OS preference.

## Today tab

The main workspace for a single day's goals.

- **Date navigation** - move day-by-day with the ← / → arrows or pick a date directly. You cannot go before your install date (or your earliest data). A **Today** shortcut appears when you're viewing another day.
- **Day Dial** - the day summary is a chronograph-style face: a 60-tick ring where **each goal is its own arc segment**, filling with that goal's partial credit (completed subtasks count), plus a sweep hand at total progress. Beside it: goals done (`completed/total`), time **planned**, and time **logged** (as `1h 30m`).
Logged time counts as soon as it is recorded - a partially-done goal's completed subtasks already contribute; only the planned-hours fallback waits for full completion.
- **Add a goal** - the collapsible add form sits at the top of the list; each goal has a topic, **planned time in hours + minutes** (minutes in 5-min steps), and optional subtasks (one per line). In the evening the button reads "Add a goal for tomorrow".
- **Complete a goal** - tap the check; completing it fires a **confetti** celebration (palette-colored tick slivers) and auto-checks all its subtasks.
- **Subtasks** - check them off individually; completing every subtask auto-completes the parent goal, and adding a new one re-opens it. A `done/total` counter is shown. Structural editing (add/remove/rename) lives in edit mode.
- **Reorder by dragging** - drag the grip handle (⠿) to reorder goals within the day and subtasks within their goal. Works with mouse, **touch, and keyboard** (pick up with Space, move with arrows).
- **Edit a goal** - inline edit (✎) rewrites the title, adjusts planned time, and adds/edits/removes subtasks in auto-growing fields. Blank lines are trimmed and emptied subtasks dropped on Done; completion state is preserved. Works on habit-derived goals too.
- **Log actual time** - for a goal **with subtasks**, check each subtask done and log its own "took" time; the goal's actual time is the **sum of its subtasks**. For a goal **without subtasks**, log the whole-goal time directly. Completed goals show a **Planned → Actual** line (green at/under plan, amber over).
- **No scroll-to-change on time fields** - the hours/minutes inputs have no spinner arrows and ignore the mouse wheel, so time only changes when you type it.
- **Move to backlog** - manually send a single unfinished goal (today or future) to the backlog. Not available for habit-generated goals: habits are day-bound, so a missed habit just stays unfinished for that day.
- **Empty state** - an encouraging prompt that changes between day and evening.
- **Future-day hint** - viewing a future date shows which habits are scheduled to appear that day (habits materialize only when the day arrives).
- **Read-only past days** - once a day is in the past it becomes a frozen record: nothing can be toggled, added, edited, deleted, reordered, or logged. A lock notice explains this, so a past day's score always reflects what actually happened.
- **Automatic carry-over** - any unfinished, non-habit goal from a past day is copied into the backlog **exactly once** (marked "↩ carried"). Only the incomplete remainder is copied - a partially-done goal carries just its unfinished subtasks - and the original stays put, so its score is never inflated. A persisted **`carriedThrough` watermark** ensures a refresh never carries the same day twice ("Auto-carried through <date>" in the Backlog tab). Habits are never carried.

## Backlog tab

A holding area for goals that didn't get done.

- Lists carried-over goals (automatic past-day copies plus anything sent manually), most recent first, with an **age label** ("yesterday", "3d ago", "2w ago", ...) and the original date.
- Shows the **"Auto-carried through <date>"** watermark line.
- Subtasks appear as compact chips (completed ones struck through).
- **Reschedule** - send an item straight to **Today**, or pick any future date.
- **Remove** - delete a backlog item outright (with confirmation).
- Friendly empty state when nothing is waiting.

## Habits tab

Recurring routines (yoga, walking, reading, ...) defined once as templates.

- **Create / edit** a habit with a topic, per-day time in hours + minutes, optional subtasks, and a **weekday schedule**.
- **Weekday picker** with quick presets: **Every day**, **Weekdays**, **Weekends**, or hand-pick days. At least one day is required.
- Habits appear **automatically** on their scheduled days, marked with a habit badge, and are seeded only on the day itself (never pre-filled into future days). A deleted instance never reappears.
- Editing a habit updates today's still-untouched instance immediately (and removes it if today is no longer scheduled).
- Each habit shows its schedule label ("Every day" / "Weekdays" / specific days) and start date.
- **Delete** a habit; days already logged keep their record.

## History tab

A chronological record of past days (today and earlier).

- One collapsible card per day, with a color-coded completion badge (green 100% / amber ≥50% / rose below) and a summary (`goals done · hours logged`).
- **Filter** across all days by **All**, **Done**, or **Missed** goals.
- Expand a day to see each goal, its logged hours, completion state, and subtask chips.

## Momentum tab (metrics)

Progress analytics computed on the fly from your goal history.

- **Summary cards**: current day streak, 7-day completion rate, hours logged (last 7 days), and total goals (last 7 days).
- **Daily chart** - completed vs. planned goals over the last 7 days (bar).
- **Weekly chart** - completion rate over the last 4 weeks, color-graded by performance (bar).
- **Hours chart** - hours logged per day over the last 7 days (line).
- Charts are hand-drawn SVG (no chart library): theme-aware, animated, each with a screen-reader data table.

## Scoring rules

- **Partial credit** - a goal's progress is 1 when complete, else the fraction of its subtasks done. A day's percentage is the average across its goals, **capped at 99% unless every goal is truly done**.
- **Streak** - consecutive days at **≥70%** partial credit, walking back from today; a day with no goals breaks it.
- **Planned vs. logged hours** - planned hours are the estimate and fallback; logged hours take over once recorded. Logged totals include partially-done goals; the planned-hours fallback applies only to fully completed goals.

## Cross-cutting behavior

- **3am day boundary** - a logical "day" starts at **03:00 local**, so late-night work still counts toward the previous day.
- **Live day rollover** - at the 03:00 boundary the app advances the day without a reload: carries unfinished work to the backlog, seeds the new day's habits, re-picks the quote. Waking from sleep triggers the same catch-up.
- **Design system ("Instrument")** - a flat, chronograph-inspired identity: dial neutrals with one rationed signal orange, hairline borders, Archivo display type, IBM Plex Mono for every numeral, tick-rule dividers. Light and dark.
- **Accessible** - full keyboard operation (including drag-reorder), ARIA roles/labels on the dial, charts, tabs, and toggles, AA-checked contrast tokens, and `prefers-reduced-motion` support throughout.
- **Responsive** - the tab bar docks to the bottom on phones; layout adapts from 360px to desktop widths.
