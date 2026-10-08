# PROJECT STATE — MASTER FILE

> Read this first, every session. Rewrite it for a cold reader before you stop.

## Where we are
- **Phase**: Phase 03 — AI (Claude Code bridge) (in progress)
- **Active feature**: F008 — Permission bridge + confirm UI + allowlist + audit log (COMPLETE, PR review & merge pending) -> F009 next
- **Overall progress**: 9 / 12 features COMPLETE (75%)

## Last verified
- **Date**: 2026-10-08
- **F008 Verification**:
  - `@shellmind/protocol`:
    - Added `perm.request` and `perm.response` messages in `src/messages/permission.ts`.
    - Pure risk classification (`classifyRisk`) and allowlist evaluation (`isReadonlyCommand`).
    - 28/28 protocol tests passing.
  - `@shellmind/agent`:
    - Pure core interfaces `IPermissionBridge`, `IAuditLogger` with 0 Node builtins or I/O.
    - Implemented `PermissionBridge` with auto-allow for safe reads, session allowlist, timeouts, idempotency, and denyAllPending.
    - Implemented `FileAuditLogger` (atomic append-only JSONL mode 0600) written BEFORE tool execution.
    - Intercepted stdio permission control requests in `ClaudeStreamParser` and `LocalClaudeDriver`.
    - Wired permission handlers into `AgentDaemon` and tested live socket flows in `src/agent.test.ts`.
    - 43/43 agent tests passing.
  - `@shellmind/mobile`:
    - Added `onPermissionRequest`, `respondPermission` to `AgentClient`.
    - Implemented accessible `PermissionCard.tsx` React Native component with risk pill and session toggle.
    - 28/28 mobile tests passing.
    - Maestro flow in `.maestro/permission_flow.yaml`.
  - 99/99 tests passing monorepo-wide (`pnpm test`).
  - Clean architecture verified with `dependency-cruiser` (`pnpm check-architecture`, 61 modules, 165 dependencies cruised, 0 violations).
  - Full suite verified clean (`pnpm verify`).
- **Git**: branch `feat/F008`

## Next step
Merge PR for F008. Advance to F009 (`Chat UI (streaming) + session continuity (reconnect resumes) + project picker`) on `feat/F009`.

## Open blockers
See `BLOCKERS.md`. None open.

## Notes for the next agent
- Pure core rule: `packages/protocol` and `packages/agent/src/core` must not import Node builtins or I/O.
- PTY adapter lives exclusively in `packages/agent/src/adapters/pty/`.
- Mobile imports only `@shellmind/protocol`, never `@shellmind/agent`.
- Run `./scripts/init.sh` at the start of any session.
