# CLAUDE.md — Session Bootstrap

Quick reference. `AGENTS.md` is the full contract; this is the checklist you run every session.

## On session start (in order)
1. Read `PROJECT_STATE.md` — the master file. Where we are.
2. Read `CURRENT_TASK.md` — the one feature + its exact next step.
3. Read `ROADMAP.md` — the feature list + statuses.
4. Read the active phase file under `phases/` — acceptance criteria.
5. Read `DECISIONS.md` + `BLOCKERS.md`.
6. Run `init` (see `scripts/SCRIPTS.md`) to confirm a clean baseline.
7. **Inspect the actual code.** Never trust the tracking files blindly — the codebase is
   the truth for what exists. If they disagree, correct the tracking files and note it in
   `CHANGELOG.md`.

## The one rule you break most often
Work the ONE feature that is `IN PROGRESS`. Evidence before you move on. Don't "quickly
also add" the next thing.

## Where things live
| I need to know... | Read |
|---|---|
| Where the project is right now | `PROJECT_STATE.md` (master) |
| What to do next | `CURRENT_TASK.md` |
| The whole feature list + status | `ROADMAP.md` |
| Acceptance for the current feature | the active `phases/PHASE-XX-*.md` |
| What's been shipped | `CHANGELOG.md` |
| What's decided (don't relitigate) | `DECISIONS.md` (+ `architecture/decisions/` ADRs) |
| What's stuck | `BLOCKERS.md` |
| Why / for whom | `product/PRODUCT.md`, `product/PERSONAS.md` |
| How it's structured / the data shape | `architecture/ARCHITECTURE.md`, `DATA_MODEL.md` |
| What I may import | `rules/layer-boundaries.md` |
| What's off-limits now | `rules/scope-guard.md` |
| How I prove it works | `verification/evaluator-rubric.md`, `acceptance-evidence.md` |
| The edge cases I must cover | `verification/edge-cases.md` |
| What to do when state is abnormal | `loops/failure-modes.md` |

## Commands
Locked toolchain (pnpm · TypeScript · vitest · ESLint · dependency-cruiser · Expo/Maestro).
Many commands below are **aspirational until F001 scaffolds the monorepo** — F001 creates the
workspace, scripts, and CI that make them real. Keep this table current.

| Action | Command |
|---|---|
| Install | `pnpm install` |
| Dev — agent | `pnpm --filter @shellmind/agent dev` (foreground daemon) |
| Dev — mobile | `pnpm --filter @shellmind/mobile start` (Expo dev client, iOS) |
| Typecheck | `pnpm -r typecheck` (`tsc --noEmit`) |
| Lint | `pnpm -r lint` (ESLint) |
| Test (full suite) | `pnpm -r test` (vitest) |
| E2E | `pnpm e2e` (Maestro flows on iOS sim + a real agent; runs in CI) |
| Build | `pnpm -r build` |
| Verify baseline | `./scripts/init.sh` (install + build + typecheck + lint + full test + check-architecture + e2e smoke) |
| Check boundaries | `./scripts/check-architecture.sh` (dependency-cruiser vs `.dependency-cruiser.cjs`) |
| Progress % | see `scripts/SCRIPTS.md` → progress-counter |

## Current target
**Phase 00 — De-risk. Feature F000** — spike: prove headless Claude Code runs on the subscription
(no key) and its permission prompt is interceptable. Throwaway code; no monorepo yet. Details in
`CURRENT_TASK.md`.

## Before you stop
Run the Session-completion protocol in `AGENTS.md`: update PROJECT_STATE, CURRENT_TASK,
ROADMAP (+ phase file), CHANGELOG, BLOCKERS/DECISIONS as needed; leave the tree clean
(`state/clean-state-checklist.md`); commit on `feat/<FID>` (or `docs/<slug>`/`chore/<slug>`
for harness-only work). If the feature just went COMPLETE: push, open/reuse the PR, review
it, fix findings, and repeat until clean before starting the next feature
(`loops/pr-review-loop.md`).
