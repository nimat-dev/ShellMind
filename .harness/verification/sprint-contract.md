# Sprint Contract — F007: Claude driver (stream-json, project cwd, abort)

Feature: F007 — Claude driver: spawn `claude -p` stream-json, parse → protocol, switchable project cwd
Phase: Phase 03 — AI (Claude Code bridge)
Date: 2026-10-07

## 1. Scope & Acceptance Criteria
- [x] Wire protocol messages in `@shellmind/protocol`:
  - `agent.prompt`: Client prompt payload (`prompt: string`, `cwd?: string`).
  - `agent.stream`: Stream frame (`event: AgentStreamEvent` where event is `assistant_text`, `tool_use`, `tool_result`, `rate_limit`, `done`, `aborted`, `error`).
  - `agent.abort`: Client request to abort the current turn.
  - `project.list` & `project.list.resp`: List known project directories.
  - `project.set` & `project.set.resp`: Switch active project cwd.
- [x] Pure core interfaces in `@shellmind/agent`:
  - `IClaudeDriver`, `ClaudeTurnOptions`, `ClaudeStreamEvent` in `src/core/claude.ts`.
  - `IProjectManager`, `ProjectInfo` in `src/core/project.ts`.
  - Pure core contains 0 Node builtins or I/O imports (`check-architecture.sh` enforced).
- [x] Concrete adapter in `@shellmind/agent`:
  - `src/adapters/claude-driver/driver.ts` spawning `claude -p <prompt> --output-format stream-json --verbose` with child process lifecycle management.
  - Incremental line buffer stream parser converting JSONL into `ClaudeStreamEvent`.
  - Clean abort (`SIGINT`/`SIGTERM`) killing child process without zombies or orphans.
  - Typed, actionable errors when `claude` is not found, not logged in, or exits abnormally.
  - `src/adapters/project/project-manager.ts` safely listing and validating cwd directories.
- [x] Daemon message routing in `packages/agent/src/core/daemon.ts`:
  - Handles `agent.prompt` and streams `agent.stream` messages back to the active session.
  - Handles `agent.abort` and terminates in-flight turn.
  - Handles `project.list` and `project.set`.
- [x] Mobile client methods in `packages/mobile/src/client.ts`:
  - `sendAgentPrompt(prompt: string, cwd?: string)`
  - `abortAgent()`
  - `onAgentStream(callback)`
  - `listProjects()`, `setProject(cwd: string)`
- [x] Edge cases covered:
  - Claude CLI not installed or missing in PATH -> actionable error event.
  - Malformed JSONL line in stream -> skipped/tolerated without crash.
  - Abort mid-stream or mid-tool -> child process killed cleanly, `aborted` event dispatched.
  - Very large output / rapid stream chunks -> buffer handles incremental chunks cleanly.
  - Empty prompt -> rejected before spawning process.
  - Disconnect during active turn -> child process terminated immediately (no orphan child).
- [x] Architecture boundaries: pure core contains 0 I/O; `check-architecture.sh` reports 0 violations.
- [x] Full verification suite passing (`pnpm verify`).

## 2. Edge cases & failure paths (from `verification/edge-cases.md`)
- `claude` not installed / not logged in -> typed actionable error, never unhandled exception.
- Malformed JSONL line from Claude Code -> logged and ignored, parser keeps running.
- Abort mid-tool execution -> kills subprocess immediately, releases turn lock.
- Empty or whitespace prompt -> validation error before spawn.
- Process crash / non-zero exit code without result -> surfaces `error` stream event, no zombie.
- Session disconnect while prompt running -> process killed immediately.

## 3. E2E scenario(s)
1. Agent receives `agent.prompt` with "list files".
2. Claude driver spawns `claude -p` stream-json in project directory.
3. Stream parser emits `assistant_text`, `tool_use`, `tool_result`, `done`.
4. Mobile receives `agent.stream` events.
5. In-flight `agent.abort` cleanly kills child process and emits `aborted`.

## 4. Plan (thinnest vertical slice)
1. Protocol schemas in `packages/protocol/src/messages/agent.ts` and `project.ts`.
2. Pure core interfaces in `packages/agent/src/core/claude.ts` and `src/core/project.ts`.
3. Stream parser and Claude driver adapter in `packages/agent/src/adapters/claude-driver/`.
4. Project manager adapter in `packages/agent/src/adapters/project/`.
5. Wire into `AgentDaemon` and tests in `src/agent.test.ts`.
6. Mobile client methods in `packages/mobile/src/client.ts` and tests in `src/mobile.test.ts`.
7. E2E flow specification in `.maestro/claude_stream_flow.yaml`.
8. Architecture check and full verify (`pnpm verify`).
