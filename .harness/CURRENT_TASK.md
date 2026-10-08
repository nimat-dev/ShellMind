# CURRENT TASK

**Feature**: F001 — Monorepo + protocol core + scripts
**Phase**: Phase 01 — Foundation (prove the pipe)
**Status**: NOT STARTED

## Exact next step
1. Create pnpm workspace structure: `packages/protocol`, `packages/agent`, `packages/mobile`.
2. Configure TypeScript strict base and package tsconfigs.
3. Implement `@shellmind/protocol` message envelope and Zod schemas (`ping`, `pong`, `error`).
4. Add `scripts/init.sh` and `scripts/check-architecture.sh` (dependency-cruiser configuration).
5. Add unit tests for round-trip validation and edge cases.
6. Configure CI workflow.
7. Write and sign `verification/sprint-contract.md` for F001 before implementing.

## Acceptance (summary)
See `phases/PHASE-01-FOUNDATION.md` for full criteria.

## Definition of done
All F001 criteria met; unit tests green; dependency-cruiser enforces layer boundaries; full verify passes.
