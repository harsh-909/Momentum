---
description: Turn a rough feature idea into a requirement, then (after owner OK) build it, test it, and open a PR.
argument-hint: <your feature idea in plain words>
---

You are running the owner's end-to-end feature pipeline. The owner is non-technical and wants to touch this only twice: once to approve the requirement, once to read the finished pull request. Follow the two stages below in order. Do NOT write any product code before Stage 1 is approved.

The raw idea from the owner:

$ARGUMENTS

## Stage 1 - Requirement (STOP for approval)

1. Read `CLAUDE.md`, `CONTRACT.md`, `FEATURES.md`, and `workMatter.md` so the requirement fits the existing app, wire contract, and task board. Read the relevant engine modules and UI so scope is realistic.
2. Write a short requirement spec to `requirements/<type>-<short-slug>.md` (create the `requirements/` folder if missing). Keep it plain-language and cover:
   - **What part of the app** this touches, in user terms.
   - **What the user can do** after this ships (the observable behavior).
   - **Acceptance criteria** - a short checklist of "it works when...".
   - **Edge cases & risks** you spotted (data, login, past-day read-only rules, streak/carry-over invariants, etc.).
   - **Out of scope** - what this deliberately does not do.
   - **Test & rollout notes** - which engine units and UI get tests; any migration/config/deploy implication.
   - **Open questions** - anything you need the owner to decide.
3. Present the requirement back to the owner in the communication style from `CLAUDE.md`: lead with plain language, name the app part the user sees, give real-world impact, and end with your recommendation plus the one or two decisions you need. Flag if the idea is better done a different way.
4. **STOP and wait for the owner's reply.** Do not proceed to Stage 2 until they approve (they may tweak scope first). If they change things, update the spec and re-confirm.

## Stage 2 - Build, test, ship (after approval only)

1. Follow the architecture rules in `CLAUDE.md`: new behavior goes in `frontend/src/lib/engine/` as pure functions with unit tests FIRST, then a thin store action, then UI. Backend changes keep `db.py` and Alembic migrations in sync and return the standard error/success shapes.
2. Write/extend tests alongside the code (colocated `*.test.ts`; backend `pytest`). Cover the acceptance criteria and the edge cases from the spec.
3. Run the full checks and fix anything red before shipping:
   - `cd frontend && npx tsc -b --noEmit && npx vitest run`
   - `cd backend && .venv/Scripts/python -m pytest`
4. Update `workMatter.md` (move the item to Completed) and `FEATURES.md`/`CONTRACT.md` if behavior or the wire contract changed.
5. Ship it by following the `ship` skill: branch off up-to-date `main` as `type/short-slug`, commit with a conventional-commit message (no co-author trailer), push, and open a PR with the business-language template. Never merge.
6. Hand back the PR link and a one-line plain-language summary, then stop. The owner merges or closes.

If the checks cannot be made green, do not open the PR - report what failed in plain language and what you'd do next.
