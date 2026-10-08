# PROJECT STATE — MASTER FILE

> Read this first, every session. Rewrite it for a cold reader before you stop.

## Where we are
- **Phase**: Phase 03 — AI (Claude Code bridge) (100% COMPLETE) -> Phase 04 — Voice next
- **Active feature**: F009 — Chat UI + session continuity + project picker (COMPLETE)
- **Overall progress**: 8 / 12 features COMPLETE (67%)

## Last verified
- **Date**: 2026-10-08
- **F009 Verification**:
  - `@shellmind/protocol`:
    - Added `ChatTurn`, `ChatTurnStatus`, `chat.history.req`, and `chat.history.resp` messages in `src/messages/chat.ts`.
    - Registered in codec, registry, index.
    - 29/29 protocol tests passing.
  - `@shellmind/agent`:
    - Pure core interface `ITranscriptStore` in `src/core/transcript.ts` with 0 Node builtins or I/O.
    - Implemented `FileTranscriptStore` adapter with mode 0600, project path isolation, maxTurns pruning, and corrupt JSON resilience.
    - Wired `transcriptStore` into `AgentDaemon`: records user and assistant turns on `agent.prompt`, serves `chat.history.req`, switches context cleanly on `project.set`.
    - 52/52 agent tests passing.
  - `@shellmind/mobile`:
    - Added `onChatHistory`, `requestChatHistory` to `AgentClient`.
    - Implemented `ToolRenderer` registry with `DefaultRenderer`, `BashRenderer`, `FileRenderer`, and `SearchRenderer`.
    - Implemented `ChatScreen.tsx` with project picker dropdown, streaming feed, tool cards, permission card embed, and prompt input/abort bar.
    - 32/32 mobile tests passing.
    - Maestro flow in `.maestro/chat_flow.yaml` and trace in `.harness/evidence/F009/e2e-trace.txt`.
  - 113/113 tests passing monorepo-wide (`pnpm test`).
  - Clean architecture verified with `dependency-cruiser` (`pnpm check-architecture`, 70 modules, 209 dependencies cruised, 0 violations).
  - Full suite verified clean (`pnpm verify`).
- **Git**: branch `feat/F009`

## Next step
Merge PR #10 for F009. Advance to Phase 04 — Voice (thin): F010 (`push-to-talk, on-device STT -> chat turn`).

## Open blockers
See `BLOCKERS.md`. None open.

## Notes for the next agent
- Pure core rule: `packages/protocol` and `packages/agent/src/core` must not import Node builtins or I/O.
- PTY adapter lives exclusively in `packages/agent/src/adapters/pty/`.
- Mobile imports only `@shellmind/protocol`, never `@shellmind/agent`.
- Run `./scripts/init.sh` at the start of any session.
