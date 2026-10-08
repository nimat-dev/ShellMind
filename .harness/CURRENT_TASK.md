# CURRENT TASK

**Feature**: F006 — system-info tiles (CPU / memory / disk)
**Phase**: Phase 02 — Terminal & telemetry
**Status**: IN PROGRESS

## Exact next step
1. In `packages/protocol`:
   - Wire messages: `sys.request`, `sys.metrics`.
   - Metrics payload schema: CPU %, memory (used/total), disk (used/total), uptime.
   - Register in `MessageRegistry` and codec.
2. In `packages/agent`:
   - Implement `sysinfo` adapter (`os` builtins / systeminfo) in `adapters/sysinfo/`.
   - Wire message handler into `AgentDaemon`.
3. In `packages/mobile`:
   - Telemetry client polling and auto-refresh on interval when visible.
   - React Native metrics tiles component (CPU, RAM, Disk).
4. Unit and integration tests, verify architecture (`pnpm check-architecture`), and full verify (`pnpm verify`).

## Acceptance (summary)
See `phases/PHASE-02-TERMINAL.md` for full criteria.

## Definition of done
Agent gathers real-time CPU/mem/disk metrics without blocking event loop; mobile renders clean metrics tiles with auto-refresh; 100% tests green, clean boundaries.
