# PROJECT STATE — MASTER FILE

> Read this first, every session. Rewrite it for a cold reader before you stop.

## Where we are
- **Phase**: Phase 02 — Terminal & telemetry (in progress)
- **Active feature**: F005 — Mobile terminal UI (COMPLETE, PR review & merge pending) -> F006 next
- **Overall progress**: 6 / 12 features COMPLETE (50%)

## Last verified
- **Date**: 2026-10-07
- **F005 Verification**:
  - `ADR-0002`: Recorded architectural decision selecting Native React Native ANSI Stream Buffer (`TerminalBuffer`) over xterm.js in WebView.
  - `@shellmind/mobile`:
    - Implemented high-performance `TerminalBuffer` in `src/terminal/buffer.ts` with ANSI 16/256/truecolor parsing, carriage return `\r` overwrites, backspace `\b`, OSC stripping, and 2000-line scrollback buffer.
    - Added 8 unit tests in `src/terminal/buffer.test.ts`.
    - Added terminal client streaming methods (`openTerminal`, `sendTerminalInput`, `resizeTerminal`, `onTerminalData`, `onTerminalExit`) to `AgentClient`.
    - Implemented React Native components: `AccessoryBar.tsx`, `HistoryModal.tsx`, and `TerminalScreen.tsx` with responsive layout resize tracking and auto-scrolling monospace display.
    - Updated `App.tsx` with tab switching between Terminal (default) and Status views.
    - Added terminal streaming integration test in `src/mobile.test.ts` driving live WebSocket server.
    - Flow specification created at `.maestro/terminal_flow.yaml`.
  - 49/49 tests passing across all packages (`pnpm test`).
  - Architecture verified clean with `dependency-cruiser` (`pnpm check-architecture`, 42 modules, 97 dependencies cruised, 0 violations).
  - Full suite verified clean (`pnpm verify`).
- **Git**: branch `feat/F005`

## Next step
Merge PR for F005. Advance to F006 (`system-info tiles`) on `feat/F006`.

## Open blockers
See `BLOCKERS.md`. None open.

## Notes for the next agent
- Pure core rule: `packages/protocol` and `packages/agent/src/core` must not import Node builtins or I/O.
- PTY adapter lives exclusively in `packages/agent/src/adapters/pty/`.
- Mobile imports only `@shellmind/protocol`, never `@shellmind/agent`.
- Run `./scripts/init.sh` at the start of any session.
