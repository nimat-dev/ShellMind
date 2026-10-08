# Phase 02 — Terminal & telemetry

Turn the proven pipe into a usable terminal that feels native on a phone, plus at-a-glance machine
health. This is the SSH-client parity we get for free — necessary, not the pitch.

## F004 — PTY in agent (stream, input, resize, exit)
**Status**: COMPLETE (PR #5)

### Acceptance criteria
- [x] `pty` adapter (`node-pty`) spawns the user's shell; `term.open`→PTY, `term.input`→stdin,
      `term.data`→streamed output, `term.resize`→cols/rows, `term.exit`→close with code.
- [x] Runs as the logged-in user, inheriting their env; one PTY per session, cleaned up on
      disconnect (no orphan processes).
- [x] Edge/error cases (`edge-cases.md`): huge/rapid output (backpressure, no OOM), control chars
      + ANSI colors preserved, UTF-8/emoji, resize mid-command updates `COLUMNS`, shell exit +
      re-open, disconnect kills the PTY.
- [x] E2E/integration: drive `printf`/`ls`/a long-running command over a real socket; assert
      output + exit; assert no leaked child after disconnect. Evidence under `.harness/evidence/F004/`.
- [x] Boundary invariants: PTY only in `adapters/pty/**`; `check-architecture` passes.
- [x] Verification: full verify green, no regressions.

## F005 — Mobile terminal UI
**Status**: COMPLETE (PR #6)

### Acceptance criteria
- [x] A real terminal emulator view (decision: xterm.js in a WebView vs native RN term — record in
      an ADR) rendering `term.data`; readable mono font, scrollback.
- [x] Mobile-native accessory keyboard row: Ctrl, Esc, Tab, arrows, `|`, `/`, `-`, `~`; tab-to-rerun
      from command history.
- [x] Resize on rotate/keyboard sends `term.resize`; input latency acceptable over tailnet.
- [x] Edge/error cases: long lines wrap/scroll, control sequences render, paste, rapid typing,
      disconnect shows a clear state (not a frozen screen), history recall.
- [x] E2E (Maestro): type `pwd`→see cwd; run `ls`; recall from history; rotate device. Trace under
      `.harness/evidence/F005/`.
- [x] Boundary invariants: UI mutates only via protocol messages; `check-architecture` passes.
- [x] Verification: full verify + e2e green, no regressions.

## F006 — System-info tiles
**Status**: IN PROGRESS

### Acceptance criteria
- [ ] `sysinfo` adapter returns CPU %, memory used/total, disk used/total on `sys.request`; mobile
      shows tiles (works on macOS + Linux).
- [ ] Refreshes on an interval while visible; stops when backgrounded (no battery drain).
- [ ] Edge/error cases: metric unavailable on a platform → graceful "n/a", not a crash; stale data
      marked when disconnected.
- [ ] E2E (Maestro): tiles render real numbers against a running agent. Trace under
      `.harness/evidence/F006/`.
- [ ] Boundary invariants: metrics gathering only in `adapters/sysinfo/**`; `check-architecture`
      passes.
- [ ] Verification: full verify + e2e green, no regressions.

## Phase completion criteria
From the phone you can run real shell commands with a usable mobile terminal and see live CPU/mem/
disk; full suite + e2e green; check-architecture clean. Then Phase 03 starts.
