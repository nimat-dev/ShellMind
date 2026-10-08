# PROJECT STATE — MASTER FILE

> Read this first, every session. Rewrite it for a cold reader before you stop.

## Where we are
- **Phase**: Phase 02 — Terminal & telemetry (in progress)
- **Active feature**: F004 — PTY in agent (node-pty) (COMPLETE, PR review & merge pending) -> F005 next
- **Overall progress**: 5 / 12 features COMPLETE (42%)

## Last verified
- **Date**: 2026-10-07
- **F004 Verification**:
  - `@shellmind/protocol`:
    - Wire protocol messages added: `term.open`, `term.input`, `term.data`, `term.resize`, `term.exit`.
    - Integrated in `MessageRegistry`, codec serialization, and type unions.
    - 18/18 protocol unit tests pass.
  - `@shellmind/agent`:
    - Configured `node-pty@^1.1.0` with workspace build approval in `pnpm-workspace.yaml`.
    - Added executable permission validation/fix for `spawn-helper` on macOS/Linux.
    - Pure core interfaces in `src/core/terminal.ts` (`ITerminalSession`, `ITerminalManager`).
    - PTY adapter in `src/adapters/pty/node-pty.ts`.
    - Message handlers in `src/core/daemon.ts` (`term.open`, `term.input`, `term.resize`) and automated child process cleanup on socket disconnect/stop (no orphan processes).
    - Added integration tests in `agent.test.ts` driving real shell session, stdin commands, stdout streaming, resize, exit codes, and disconnect cleanup.
  - 40/40 tests passing across all packages (`pnpm test`).
  - Architecture verified clean with `dependency-cruiser` (`pnpm check-architecture`, 38 modules, 82 dependencies cruised, 0 violations).
  - Full suite verified clean (`pnpm verify`).
- **Git**: branch `feat/F004`

## Next step
Merge PR for F004. Advance to F005 (`mobile terminal UI`) on `feat/F005`.

## Open blockers
See `BLOCKERS.md`. None open.

## Notes for the next agent
- Pure core rule: `packages/protocol` and `packages/agent/src/core` must not import Node builtins or I/O.
- PTY adapter lives exclusively in `packages/agent/src/adapters/pty/`.
- Mobile imports only `@shellmind/protocol`, never `@shellmind/agent`.
- Run `./scripts/init.sh` at the start of any session.
