---
name: ship
description: Package the current work as a pull request the owner can approve or reject - branch, verify, commit, push, open a PR with a plain-language (business) description. Never merges (that's the owner's call). Use for "ship this", "open a PR", "commit and PR this". Optional args set the PR title/scope (e.g. "/ship the two QA fixes").
---

# /ship - task -> commit -> PR

Turn the work in progress into a reviewable pull request. The owner reads the PR description (not the code) and merges to approve or closes to reject. See the "How work ships" section of CLAUDE.md for the standing convention; this command executes it.

## Steps

1. **Survey the working tree.** `git status` + `git diff --stat`. Group changes by logical unit. If there is MORE than one unrelated change (e.g. a bug fix plus a half-built feature), do NOT lump them - ship the one the owner asked for (or the clearly-complete one) and say the rest is left for a separate PR. Args, if given, name the scope/title.

2. **Confirm scope in one plain-language line** before committing when it's ambiguous which changes go in ("Shipping just the two QA fixes; the plans feature stays behind for its own PR - ok?"). Skip this if the scope is obvious or the owner already said.

3. **Branch.** Ensure `main` is current (`git fetch`), then `git switch -c type/short-slug` off `main`. Name by change type: `fix/`, `feat/`, `refactor/`, `chore/`, `docs/`. If unrelated changes must be excluded, use `git stash` / selective `git add` so the branch holds only this unit.

4. **Verify** (unless the owner asked to ship failing work):
   - frontend: `cd frontend && npx tsc -b --noEmit && npx vitest run`
   - backend: `cd backend && .venv/Scripts/python -m pytest tests -q`
   Run whichever the change touches (both if unsure). If red, stop and report in plain language - do not open the PR.

5. **Commit** staged changes with a conventional-commit message (`fix:`, `feat:`, ...). No co-author trailer.

6. **Push**: `git push -u origin <branch>`.

7. **Open the PR**: `gh pr create --base main --head <branch> --title "<conventional title>" --body "<template below>"`. Write the body to a temp file and pass `--body-file` if it has newlines.

8. **Report** the PR URL + a one-line summary. STOP. Do not merge (`gh pr merge` is blocked by design). The owner approves by merging, rejects by closing.

## PR body template (business language)

```
## What this does
<1-3 plain sentences: which part of the app, what changes for a user.>

## Why
<the problem or request.>

## What to check (for you)
<real-world things to eyeball, in user terms.>

## Risk
<quick / medium / large; note if data or login is touched.>

## Technical detail (ignore unless curious)
<files touched, test results.>
```

## If `gh` is missing or unauthenticated

Detect with `gh --version` / `gh auth status`. If unavailable: do steps 1-6 (branch, verify, commit, push), then give the owner the exact `gh pr create ...` command (or the GitHub "compare" URL) to finish, plus the ready-written PR body. Tell them the one-time fix: `winget install --id GitHub.cli` then `gh auth login`.

## Guardrails

- Never commit to `main`; never `gh pr merge`; never force-push.
- Never commit `userData/`, `.env`, `dev.db`, `node_modules/`, or build output (they are gitignored - verify `git status` is clean of them before committing).
- One logical change per PR. When in doubt, smaller PR.
