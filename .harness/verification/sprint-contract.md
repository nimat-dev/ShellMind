# Sprint Contract — F004: PTY in agent (node-pty): stream output, input, resize, exit

Feature: F004 — PTY in agent (node-pty): stream output, input, resize, exit
Phase: Phase 02 — Terminal & telemetry
Date: 2026-10-07

## 1. Scope & Acceptance Criteria
- [x] Wire protocol messages in `@shellmind/protocol`:
  - `term.open`: request to open a new PTY session with initial dimensions (`cols`, `rows`), optional `cwd`, and optional `env`.
  - `term.input`: client keystroke / stdin transmission.
  - `term.data`: server PTY stdout/stderr chunk streaming to client.
  - `term.resize`: client viewport resize event (`cols`, `rows`).
  - `term.exit`: server PTY process termination notification (`exitCode`, `signal`).
- [x] Protocol schemas added to `MessageRegistry` and codec `KnownMessage` union with 100% round-trip unit test coverage.
- [x] Pure core terminal interfaces in `packages/agent/src/core/terminal.ts` (`ITerminalSession`, `ITerminalManager`).
- [x] Concrete adapter implemented in `packages/agent/src/adapters/pty/node-pty.ts` using `node-pty`:
  - Auto-detection and executable permission fix (`0755`) for macOS/Linux `spawn-helper`.
  - Clean child process lifecycle management and signal forwarding.
- [x] Agent daemon message dispatch in `packages/agent/src/core/daemon.ts`:
  - Handles `term.open`, `term.input`, `term.resize`.
  - Automated teardown: kills child PTY processes immediately when client socket disconnects or agent daemon stops (no orphan processes).
- [x] Architecture boundary: pure core in `src/core/` does not import `node-pty` or OS builtins; `check-architecture.sh` passes with 0 violations.
- [x] Full integration tests in `packages/agent/src/agent.test.ts` verifying real PTY spawn, stdout streaming, stdin command execution, resize, exit code reporting, and orphan cleanup on disconnect.

## 2. Edge cases & failure paths (from `verification/edge-cases.md`)
- `node-pty` macOS prebuild permission issue: `spawn-helper` extracted with mode `0644`. Resolved via `ensureSpawnHelperExecutable` before spawn and `scripts/init.sh`.
- Client disconnects while command is executing: daemon catches socket `close`, immediately invokes `term.kill()`, removing from active sessions and preventing zombie / orphan processes.
- Process exits naturally: `session.onExit` event broadcasts `term.exit` frame and cleans up session registry.
- Client attempts multiple `term.open` on the same session: existing PTY is safely terminated and replaced.

## 3. E2E scenario(s)
Integration tests in `packages/agent/src/agent.test.ts`:
1. Authenticate client -> `term.open` -> verify initial shell prompt received via `term.data`.
2. Send command via `term.input` (`printf '__MAGIC_ECHO__\n'`) -> verify response contains echo.
3. Send `term.resize` (120x40) -> verify handled.
4. Send `exit 0` via `term.input` -> verify `term.exit` received with exitCode 0.
5. Disconnect socket -> verify active PTY is terminated and session map cleared.

## 4. Plan (thinnest vertical slice)
1. Protocol schemas for terminal messages in `@shellmind/protocol`.
2. Core interfaces (`ITerminalSession`, `ITerminalManager`) in `packages/agent/src/core/terminal.ts`.
3. Adapter implementation (`NodePtySession`, `NodePtyManager`) in `packages/agent/src/adapters/pty/node-pty.ts`.
4. Message handlers in `packages/agent/src/core/daemon.ts` and CLI integration.
5. End-to-end integration tests in `packages/agent/src/agent.test.ts`.
6. Monorepo verification and architecture validation.

## 5. Out of scope (parked, not built)
- Mobile terminal renderer / xterm.js / WebView terminal (F005).
- Mobile accessory keyboard bar (F005).
- System telemetry metrics (F006).

## 6. New dependencies (with justification)
- `node-pty@^1.1.0` in `packages/agent`: Industry-standard pseudoterminal binding for Node.js, required for native shell emulation.
