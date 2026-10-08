# Sprint Contract — F006: System-info tiles (CPU / memory / disk)

Feature: F006 — System-info tiles (CPU / memory / disk)
Phase: Phase 02 — Terminal & telemetry
Date: 2026-10-07

## 1. Scope & Acceptance Criteria
- [x] Wire protocol messages in `@shellmind/protocol`:
  - `sys.request`: client telemetry query.
  - `sys.metrics`: agent telemetry response with CPU %, memory (used/total/percent), disk (used/total/percent), uptime, hostname, platform.
- [x] Pure core sysinfo interface in `@shellmind/agent`: `src/core/sysinfo.ts` (`ISysInfoProvider`, `SystemMetrics`).
- [x] Concrete adapter in `@shellmind/agent`: `src/adapters/sysinfo/node-sysinfo.ts` wrapping Node built-ins (`os`, `fs.statfs` for macOS & Linux) without third-party binary bloat.
- [x] Agent daemon message dispatch in `src/core/daemon.ts` responding to `sys.request` with `sys.metrics`.
- [x] Mobile client integration in `@shellmind/mobile`:
  - `requestSystemMetrics()`, `onSystemMetrics()` in `AgentClient`.
  - Tile UI component `SysInfoTiles.tsx` displaying CPU, Memory, Disk, Uptime with color-coded health bars.
  - Integration into `StatusScreen.tsx` with auto-refresh while visible and stale data indication when offline.
- [x] Edge cases covered:
  - Metric unavailable on a platform (e.g. disk access denied) -> graceful fallback ("n/a"), never crash.
  - Disconnected state -> marks metrics as stale without clearing UI.
  - Event loop safety -> non-blocking metric collection.
- [x] Architecture boundaries: pure core contains 0 I/O; `check-architecture.sh` reports 0 violations.
- [x] Full verification suite passing (`pnpm verify`).

## 2. Edge cases & failure paths (from `verification/edge-cases.md`)
- Platform without `statfs` or restricted disk permission: disk metrics return null/fallback; UI gracefully renders "N/A" instead of crashing.
- CPU calculation delta: handles initial sample or multi-core distribution without returning NaN or negative numbers.
- Connection loss during polling: stops polling / flags data as stale; resumes automatically upon reconnection.
- Zero battery drain: polling timer cleaned up when unmounted.

## 3. E2E scenario(s)
1. Agent daemon starts with sysinfo provider.
2. Mobile client connects -> requests telemetry -> receives `sys.metrics` frame.
3. Mobile tiles render live CPU, RAM, and Disk values with valid percentages.
4. Connection disconnects -> tiles display "Disconnected / Stale".

## 4. Plan (thinnest vertical slice)
1. Protocol schemas in `@shellmind/protocol/src/messages/sysinfo.ts` and registry.
2. Core interface and adapter in `packages/agent/src/core/sysinfo.ts` and `src/adapters/sysinfo/node-sysinfo.ts`.
3. Daemon handler in `packages/agent/src/core/daemon.ts` and integration test in `src/agent.test.ts`.
4. Mobile client methods in `packages/mobile/src/client.ts` and UI in `src/components/SysInfoTiles.tsx`.
5. Mobile integration test in `packages/mobile/src/mobile.test.ts`.
6. Maestro flow in `.maestro/sysinfo_flow.yaml`.
7. Full verification (`pnpm verify`) and PR review/merge.

## 5. Out of scope (parked, not built)
- Historical telemetry time-series graphing (Phase 02 requires at-a-glance health, not full Grafana).
- AI Claude Code bridge (Phase 03).

## 6. New dependencies (with justification)
None. Node built-in `os` and `fs.statfsSync`/`fs.promises.statfs` satisfy all telemetry requirements.
