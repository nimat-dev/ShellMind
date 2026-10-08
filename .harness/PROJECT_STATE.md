# PROJECT STATE — MASTER FILE

> Read this first, every session. Rewrite it for a cold reader before you stop.

## Where we are
- **Phase**: Phase 03 — AI (Claude Code bridge) (in progress)
- **Active feature**: F007 — Claude driver: spawn claude -p stream-json, project cwd, abort (COMPLETE, PR review & merge pending) -> F008 next
- **Overall progress**: 8 / 12 features COMPLETE (67%)

## Last verified
- **Date**: 2026-10-07
- **F007 Verification**:
  - `@shellmind/protocol`:
    - Added `agent.prompt`, `agent.stream`, `agent.abort`, `project.list`, `project.set` messages and schemas in `src/messages/agent.ts` and `src/messages/project.ts`.
    - 24/24 protocol tests passing.
  - `@shellmind/agent`:
    - Defined pure core `IClaudeDriver`, `ClaudeTurnOptions`, `IProjectManager`, `ProjectInfo` interfaces with 0 Node built-ins or I/O.
    - Implemented `ClaudeStreamParser` in `src/adapters/claude-driver/parser.ts` with streaming line buffering and JSONL event emission.
    - Implemented `LocalClaudeDriver` in `src/adapters/claude-driver/driver.ts` spawning `claude -p` stream-json with cancellation (`SIGINT`/`SIGKILL`), busy guard, and actionable errors.
    - Implemented `NodeProjectManager` in `src/adapters/project/node-project.ts`.
    - Wired message handlers into `AgentDaemon` and tested over live WebSocket server in `src/agent.test.ts`.
    - 28/28 agent tests passing.
  - `@shellmind/mobile`:
    - Added `sendAgentPrompt`, `abortAgent`, `onAgentStream`, `requestProjectList`, `setProject` to `AgentClient`.
    - 25/25 mobile tests passing.
    - Maestro flow in `.maestro/claude_stream_flow.yaml`.
  - 77/77 tests passing monorepo-wide (`pnpm test`).
  - Clean architecture verified with `dependency-cruiser` (`pnpm check-architecture`, 54 modules, 139 dependencies cruised, 0 violations).
  - Full suite verified clean (`pnpm verify`).
- **Git**: branch `feat/F007`

## Next step
Merge PR for F007. Advance to F008 (`Permission bridge + confirm UI + allowlist + audit log`) on `feat/F008`.

## Open blockers
See `BLOCKERS.md`. None open.

## Notes for the next agent
- Pure core rule: `packages/protocol` and `packages/agent/src/core` must not import Node builtins or I/O.
- PTY adapter lives exclusively in `packages/agent/src/adapters/pty/`.
- Mobile imports only `@shellmind/protocol`, never `@shellmind/agent`.
- Run `./scripts/init.sh` at the start of any session.
