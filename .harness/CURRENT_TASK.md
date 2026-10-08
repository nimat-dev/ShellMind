# CURRENT TASK

**Feature**: F004 — PTY in agent (node-pty): stream output, input, resize, exit
**Phase**: Phase 02 — Terminal & telemetry
**Status**: NOT STARTED (F003 PR ready for review and merge)

## Exact next step
1. In `packages/protocol`:
   - Define protocol messages for terminal streaming: `pty.spawn`, `pty.input`, `pty.output`, `pty.resize`, `pty.exit`.
   - Register PTY messages in `MessageRegistry` and codec.
2. In `packages/agent`:
   - Implement `TerminalManager` / `PtySession` using `node-pty` in adapters layer.
   - Register message handlers in `AgentDaemon` message handler registry.
   - Support streaming binary/text stdout/stderr, handling stdin input, window resizing, and process termination.
3. Unit and integration tests driving interactive shell commands over WebSocket.
4. Verify architecture (`check-architecture`) and full verify (`pnpm verify`).

## Acceptance (summary)
See `phases/PHASE-02-TERMINAL.md` for full criteria.

## Definition of done
Agent spawns interactive PTY session with user shell, streams terminal output chunks over protocol envelope, accepts input and resize frames, handles exit codes cleanly, architecture and tests green.
