# PROJECT STATE — MASTER FILE

> Read this first, every session. Rewrite it for a cold reader before you stop.

## Where we are
- **Phase**: Phase 01 — Foundation (prove the pipe)
- **Active feature**: F002 — Agent daemon + tailnet transport + device-token auth (IN PROGRESS)
- **Overall progress**: 2 / 12 features COMPLETE (16%)

## Last verified
- **Date**: 2026-10-07
- **F001 Verification**:
  - Monorepo configured with pnpm workspaces (`packages/protocol`, `packages/agent`, `packages/mobile`).
  - Strict TypeScript configuration across all packages (`tsconfig.base.json`, `tsc -b` clean).
  - `@shellmind/protocol` implemented: pure envelope, Zod schemas (`ping`, `pong`, `error`), registry pattern, codec with size limits and typed errors.
  - 15/15 unit tests passing (`packages/protocol/src/protocol.test.ts`).
  - `scripts/init.sh` and `scripts/check-architecture.sh` running cleanly.
  - Dependency-cruiser rules actively enforced; seeded violation caught and verified.
  - CI workflow (`.github/workflows/ci.yml`) added.
- **Git**: branch `feat/F001`

## Next step
Implement F002: Agent daemon core transport interface + tailnet transport adapter, device-token authentication handshake, and secure hashed device registry.

## Open blockers
See `BLOCKERS.md`. None open.

## Notes for the next agent
- Pure core rule: `packages/protocol` must not import Node builtins or I/O.
- Agent rule: `packages/agent/src/core` must not import Node builtins or I/O; concrete socket/file I/O belongs in `packages/agent/src/adapters`.
- Run `./scripts/init.sh` at the start of any session.
