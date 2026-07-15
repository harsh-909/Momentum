# Work Matter - Task Board

Task tracking for what we're building in Momentum. This file is only about work in
flight; the catalog of what the app *does* lives in `FEATURES.md`.

Every feature we **add / update / remove** is a checkbox item across three sections:

- **🚧 In Progress** - being worked on right now (ideally one focused task).
- **📋 Not Completed** - planned or requested tasks not yet started.
- **✅ Completed** - recently finished tasks. Kept short: older history lives in `git log`.

**Workflow (applied automatically):**
- **Starting a task** - it is created in **In Progress**, or pulled there from Not Completed / Completed if it already exists. Duplicates are fused into a single entry holding all the detail.
- **Committing a task's work** - the task moves to **Completed** and is checked off.
- Keep **In Progress** focused (ideally one task at a time).

**`/momentum-qa board` reads the In Progress section below** to decide what to test.

---

## 🚧 In Progress

- [ ] **Mandatory email + verification** - accounts now require an email. Signup emails a 6-digit code (Resend in prod; logged to the console in dev) and no longer logs you straight in - you enter the code to activate. Login of a verified account works as before; unverified or pre-email (legacy) accounts are routed through add-email / verify-code first. Enumeration-safe (neutral responses + notice email to already-registered addresses), HMAC-hashed codes, attempt/expiry caps, rate limits. New endpoints: verify-email / resend-code / add-email; `users` gains email + email_verified (partial unique index on verified emails) plus an `email_verifications` table (Alembic 0002). Built on top of the landing page (merged in) since the flow extends the sign-in card. Needs `RESEND_API_KEY` + `VERIFICATION_SECRET` set at deploy time.
- [ ] **Public landing / home page** - anonymous visitors see a marketing home page (hero with a decorative Day Dial, capabilities grid, how-it-works, CTAs) before sign-in. "Get started" opens create-account; "Log in" opens sign-in; a "Back" link returns to the home page. (Committed on `feat/landing-page`; folded into the email branch.)

## 📋 Not Completed

- [ ] **Deploy to the free tier** - execute `DEPLOYMENT.md`: Neon project, Render web service, Vercel frontend, CORS loop, cron-job.org pinger, then import `userData/harsh.json` into the deployed app.
- [ ] **In-browser visual QA pass** - click through the walkthrough (signup, import, Today dial, habits seeding, read-only past day, charts, both themes, 360px width) and log anything that looks wrong.
- [ ] **Rich-text formatting in the editor** - bold / italic / lists. Now feasible with the bundler (a small editor dependency), but still a deliberate scope decision.

## ✅ Completed

- [x] **QA tooling for 2.0** (2026-07-09) - replaced the 1.x `/run-test` / `/run-fulltest` commands (deleted) with `/momentum-qa` (`.claude/skills/momentum-qa/`), which inherits the global `/qa` senior-test-engineer methodology and takes a mode from its prompt: no args = full E2E, "suites" = automated checks only, "board" = test this file's In Progress item, anything else = isolated-feature QA.

- [x] **Momentum 2.0 full rewrite** (2026-07-08) - ground-up rebuild on the `momentum-2.0` branch: React 19 + Vite + TS + Tailwind v4 + Zustand frontend with all business logic in pure `lib/engine` modules; FastAPI + SQLAlchemy async + Alembic backend (argon2id auth, bearer sessions, JSONB snapshot per user with version compare-and-swap saves); "Instrument" chronograph design system (light/dark, per-goal segmented Day Dial, hand-rolled SVG charts); dnd-kit reorder with keyboard/touch support. Parity audit confirmed 16/16 v1 invariant groups preserved; correctness + a11y reviews applied. 388 frontend tests, 36 backend tests, 17-check wire smoke (real v1 data round-trips), CI workflow, DEPLOYMENT/README/CLAUDE docs. The 1.x app is frozen in `legacy/` and on `main`'s history. Supersedes the pre-rewrite backlog items "decouple visual effects from the component" and "centralize the clock" (both structural in the new engine).
- [x] **Docs refresh for 2.0** (2026-07-08) - FEATURES.md rewritten for the client-server app (auth, multi-device saves, Day Dial, themes, scoring rules section); this board trimmed (git history is the archive for pre-2.0 work).
