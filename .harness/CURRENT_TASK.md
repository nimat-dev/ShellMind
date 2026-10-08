# CURRENT TASK

**Feature**: F005 — mobile terminal UI (emulator + accessory keys + scrollback + history)
**Phase**: Phase 02 — Terminal & telemetry
**Status**: IN PROGRESS

## Exact next step
1. In `packages/mobile`:
   - Decision record: xterm.js in WebView vs Native RN terminal component (ADR).
   - Implement terminal emulator screen integrating `term.open`, `term.data`, `term.input`, `term.resize`, `term.exit`.
   - Implement mobile-native accessory keyboard row (Ctrl, Esc, Tab, Arrows, `|`, `/`, `-`, `~`).
   - Support command history recall and tap-to-rerun.
   - Dynamic viewport resize calculation on orientation change / on-screen keyboard toggle.
2. Integration / unit tests for terminal screen state machine, input handling, and ANSI stream buffering.
3. Verify clean architecture (`pnpm check-architecture`) and full verify (`pnpm verify`).

## Acceptance (summary)
See `phases/PHASE-02-TERMINAL.md` for full criteria.

## Definition of done
Mobile terminal UI connects to agent PTY session, renders ANSI colors/output smoothly, receives input via virtual keyboard and accessory keys, resizes appropriately, and passes full verification with no regressions.
