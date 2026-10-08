# PROJECT STATE — MASTER FILE

> Read this first, every session. Rewrite it for a cold reader before you stop.

## Where we are
- **Phase**: Phase 02 — Terminal & telemetry (COMPLETE) -> Advancing to Phase 03 (AI — Claude Code Bridge)
- **Active feature**: F006 — System-info tiles (CPU / memory / disk) (COMPLETE, PR review & merge pending) -> F007 next
- **Overall progress**: 7 / 12 features COMPLETE (58%)

## Last verified
- **Date**: 2026-10-07
- **F006 Verification**:
  - `@shellmind/protocol`:
    - Added `sys.request` and `sys.metrics` envelope schemas and action creators in `src/messages/sysinfo.ts`.
    - 19/19 protocol unit tests passing.
  - `@shellmind/agent`:
    - Implemented `ISysInfoProvider` pure core interface in `src/core/sysinfo.ts`.
    - Implemented `NodeSysInfoProvider` in `src/adapters/sysinfo/node-sysinfo.ts` (CPU delta, memory, `fs.promises.statfs('/')` disk metrics, uptime).
    - Wired message handler into `AgentDaemon` responding to `sys.request` with `sys.metrics`.
    - Integration test in `src/agent.test.ts` verifying telemetry request/response loop.
  - `@shellmind/mobile`:
    - Added `requestSystemMetrics`, `onSystemMetrics` to `AgentClient`.
    - Implemented `SysInfoTiles.tsx` component with CPU/RAM/Disk bars, cores/GB stats, host/uptime pill, and offline stale badge.
    - Embedded `SysInfoTiles` in `StatusScreen.tsx` with auto-polling.
    - Integration test in `src/mobile.test.ts` verifying client request and metrics dispatch.
    - E2E flow specification in `.maestro/sysinfo_flow.yaml`.
  - 53/53 tests passing across all packages (`pnpm test`).
  - Architecture verified clean with `dependency-cruiser` (`pnpm check-architecture`, 46 modules, 114 dependencies cruised, 0 violations).
  - Full suite verified clean (`pnpm verify`).
- **Git**: branch `feat/F006`

## Next step
Merge PR for F006. Start Phase 03 with F007 (`Claude driver: spawn claude -p stream-json, parse -> protocol, switchable project cwd`) on `feat/F007`.

## Open blockers
See `BLOCKERS.md`. None open.

## Notes for the next agent
- Pure core rule: `packages/protocol` and `packages/agent/src/core` must not import Node builtins or I/O.
- PTY adapter lives exclusively in `packages/agent/src/adapters/pty/`.
- Mobile imports only `@shellmind/protocol`, never `@shellmind/agent`.
- Run `./scripts/init.sh` at the start of any session.
