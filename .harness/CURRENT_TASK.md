# CURRENT TASK

**Feature**: F007 — Claude driver: spawn `claude -p` stream-json, parse → protocol, switchable project cwd
**Phase**: Phase 03 — AI (Claude Code bridge)
**Status**: IN PROGRESS

## Exact next steps
1. **Protocol definitions (`packages/protocol`)**:
   - `agent.prompt` (`prompt`, `cwd` optional)
   - `agent.stream` (`event`: `assistant_text`, `tool_use`, `tool_result`, `rate_limit`, `done`, `aborted`, `error`)
   - `agent.abort`
   - `project.list` / `project.list.resp`
   - `project.set` / `project.set.resp`
2. **Pure core interfaces (`packages/agent/src/core`)**:
   - `IClaudeDriver`, `ClaudeTurnOptions`, `ClaudeStreamEvent` in `src/core/claude.ts`
   - `IProjectManager`, `ProjectInfo` in `src/core/project.ts`
   - Zero Node built-ins or I/O imports
3. **Claude Driver adapter (`packages/agent/src/adapters/claude-driver`)**:
   - `LocalClaudeDriver`: Spawns `claude -p --output-format stream-json --verbose`
   - Incremental JSONL line parsing into discrete stream events
   - Clean abortion (`SIGINT` -> `SIGTERM`), orphan process prevention
   - Actionable errors for binary not found or login required
   - `LocalProjectManager`: list and set active project directory safely
4. **Agent Daemon wiring (`packages/agent/src/core/daemon.ts`)**:
   - Route `agent.prompt`, `agent.abort`, `project.list`, `project.set`
   - Dispatch `agent.stream` events to the active client session
5. **Mobile Client methods (`packages/mobile/src/client.ts`)**:
   - `sendAgentPrompt()`, `abortAgent()`, `onAgentStream()`, `listProjects()`, `setProject()`
6. **Testing and Verification**:
   - Protocol tests for all new schemas
   - Driver unit tests (mocked child process stream, abort, malformed jsonl lines)
   - Agent integration tests over live socket
   - Mobile integration tests
   - Maestro flow specification (`.maestro/claude_stream_flow.yaml`)
   - Monorepo build, typecheck, lint, test, `check-architecture.sh`, `pnpm verify`
