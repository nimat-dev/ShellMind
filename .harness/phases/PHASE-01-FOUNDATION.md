# Phase 01 — <<FILL: phase name>>

<<FILL: this is the acceptance-criteria home for the phase's features. Copy this file per
phase (PHASE-02-*.md, …). For each feature, give the full, checkable acceptance criteria the
Evaluator scores against — the same items the sprint contract maps to concrete checks.>>

## F001 — <feature name>
**Status**: NOT STARTED

### Acceptance criteria
- [ ] <criterion 1 — concrete and checkable>
- [ ] <criterion 2>
- [ ] Edge/error cases from `verification/edge-cases.md` (applicable ones) covered by tests.
- [ ] E2E: primary user flow passes end-to-end (or "N/A — not user-facing").
- [ ] Boundary invariants: obeys `rules/layer-boundaries.md` (check-architecture passes).
- [ ] Verification: the FULL verify (CLAUDE.md → Commands, incl. e2e) passes with zero errors,
      no regressions.

### Evidence expected
<what proves each criterion — command output, test id, e2e trace, screenshot path>

## Phase completion criteria
Every feature in this phase is `COMPLETE` with evidence, and the phase smoke test is green,
before Phase 02 starts.
