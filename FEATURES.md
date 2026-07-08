# Features

Momentum is a daily-goals and habit tracker.
It runs on your machine via a small local server (`server.py`) and stores each person's data as a JSON file in the `userData/` folder next to the project - no cloud, no external service, no sync.
The interface is organized into five tabs: **Today**, **Backlog**, **Habits**, **History**, and **Momentum** (metrics).

> This file documents what the app does. Work in progress and task tracking live in `workMatter.md`.

## Accounts & data (local, multi-user)

- **Double-click to launch** - open `Momentum.pyw` and the app starts silently (no console window) and opens in your browser. Double-clicking again while it's running just opens another tab.
- **Quit from the app** - the power button (⏻) in the header saves your data, stops the hidden server, and shows a goodbye screen.
- **Username login** - on open, a modal asks for a username. A new name creates a fresh profile; an existing name loads that person's saved data. Usernames are lowercase letters/numbers/`-`/`_` (max 32).
- **Pick an existing profile** - the modal lists profiles already on this machine as one-tap buttons.
- **Multiple users, one machine** - each user's data is an independent `userData/<username>.json` file.
- **Switch user** - the avatar button (your initial) in the header logs out and returns to the login screen.
- **Automatic save** - every change is written to your JSON file within a moment; a header indicator shows "Saving… / Saved ✓", or "Save failed - retry" (click to retry) if the server is unreachable.
- **Export** - download your data as a formatted JSON file (`momentum-<user>-<date>.json`).
- **Import** - load data from a JSON file, replacing the current profile (with a confirmation prompt).

## Onboarding & personalization
- **Personalized greeting** - the hero shows "Good morning / afternoon / evening", "Burning the midnight oil", or "Winding down" based on the current hour, addressed to your username, alongside the full date.
- **Daily quote** - a motivational quote is chosen deterministically from the day of the month, so it stays the same all day and rotates over time.
- **Streak chip** - the header shows your current day streak (hidden on very small screens).

## Today tab

The main workspace for a single day's goals.

- **Date navigation** - move day-by-day with the ← / → arrows or pick a date directly. You cannot go before your install date (or your earliest data). A **Today** shortcut appears when you're viewing another day.
- **Day summary** - a progress ring shows percent of goals completed, alongside three stats: goals done (`completed/total`), time **planned**, and time **logged** (both shown as `1h 30m`).
- **Add a goal** - the add-goal form sits at the **top** of the list; each goal has a topic, **planned time in hours + minutes** (separate `h` and `m` fields, minutes in 5-min steps), and optional subtasks (one per line). In the evening the button reads "Add a goal for tomorrow".
- **Complete a goal** - tap the checkbox; completing it fires a **confetti** celebration and auto-checks all its subtasks.
- **Subtasks** - check them off individually; completing every subtask auto-completes the parent goal, and adding a new one re-opens the parent. A `done/total` counter is shown. Adding and removing subtasks happens in **edit mode** (see "Edit a goal").
- **Reorder by dragging** - drag the grip handle (⠿) to reorder goals up or down within the day, and to reorder subtasks within their own goal. Mouse/desktop only.
- **Edit a goal** - open inline edit (✎) to rewrite the title, adjust planned time (hours + minutes), and **add** ("+ Add subtask"), edit, or remove subtasks in auto-growing text fields. All structural editing lives here - there is no separate add-subtask button outside edit mode. Blank lines are trimmed and emptied subtasks dropped on save (✓ Done), while subtask completion is preserved. Works on habit-derived goals too.
- **Log actual time** - record how long things actually took, in hours + minutes, to compare against the plan. For a goal **with subtasks**, check each subtask done and log its own time (a "took" field); the goal's actual time is the **sum of its subtasks**. For a goal **without subtasks**, log the whole-goal time directly. Either way the goal shows a **Planned → Actual** line (green when at/under plan), and the day summary totals planned vs logged.
- **No scroll-to-change on time fields** - the hours/minutes inputs have no spinner arrows and ignore mouse-wheel, so time only changes when you type it.
- **Move to backlog** - manually send a single unfinished goal (on today) to the backlog. Not available for habit-generated goals: habits are day-bound, so a missed habit just stays unfinished for that day rather than being carried anywhere.
- **Empty state** - shows an encouraging prompt that changes between day and evening.
- **Future-day hint** - viewing a future date shows which habits are scheduled to appear that day (habits are only materialized when the day actually arrives).
- **Read-only past days** - once a day is in the past it becomes a frozen record: goals and subtasks can no longer be toggled, added, edited, deleted, reordered, or logged. A 🔒 notice explains this, so a past day's score always reflects what actually happened.
- **Automatic carry-over** - on load, any unfinished, non-habit goal from a past day is copied into the backlog **exactly once** (marked "↩ carried"). Only the incomplete remainder is copied - a partially-done goal carries just its unfinished subtasks - and the original stays put in the past day, so its score is preserved and never inflated to 100%. Habits are never carried (a missed habit just stays missed). A persisted **`carriedThrough` watermark** records the last day already swept, so re-opening or refreshing never carries the same day twice (shown as "Auto-carried through &lt;date&gt;" in the Backlog tab).

## Backlog tab

A holding area for goals that didn't get done.

- Lists carried-over goals (automatic past-day copies plus anything you sent manually), most recent first, with an **age label** ("yesterday", "3d ago", "2w ago", ...) and the original date.
- Shows an **"Auto-carried through &lt;date&gt;"** line - the last past day already swept into the backlog.
- Subtasks are shown as compact chips (completed ones struck through).
- **Reschedule** - send an item straight to **Today**, or pick any future date and schedule it there.
- **Remove** - delete a backlog item outright.
- Friendly empty state when nothing is waiting.

## Habits tab

Recurring routines (yoga, walking, reading, etc.) defined once as templates.

- **Create / edit** a habit with a topic, per-day time in hours + minutes, optional subtasks, and a **weekday schedule**.
- **Weekday picker** with quick presets: **Every day**, **Weekdays**, **Weekends**, or hand-pick individual days. At least one day is required.
- Habits appear **automatically** on their scheduled days, marked with a 🔁 badge, and are seeded only on the day itself (never pre-filled into future days).
- Editing a habit updates today's still-untouched instance immediately (and removes it if today is no longer a scheduled day).
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
- Charts render when the tab is opened.

## Cross-cutting behavior

- **Automatic persistence** - every change is saved to your `userData/<username>.json` file (debounced), and flushed on tab close so nothing is lost.
- **3am day boundary** - a logical "day" starts at **03:00 local**, not midnight, so late-night work (up to 3am) still counts toward the previous day. Everything that reads "today" respects this offset (`dayStartHour`).
- **Live day rollover** - the app is built to run continuously. At the **03:00 boundary** it automatically runs the new-day setup without a reload: advances the current day, carries the previous day's unfinished work into the backlog, and seeds that day's habits. If the machine slept across the boundary, returning to the tab (focus/visibility) triggers the same catch-up. This is the always-on companion to the carry-over that also runs on a fresh launch/login.
- **Planned vs. logged hours** - planned hours act as the estimate and default; logged hours override once recorded, and metrics prefer logged values.
- **Fully local & private** - all data stays on your machine, and every library and font is bundled in `vendor/`, so the app works with no internet connection at all.
- **Responsive** - layout adapts from phone to desktop widths.
