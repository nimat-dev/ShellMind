# Sprint Contract — F009: Chat UI + session continuity + project picker

Feature: F009 — Chat UI + session continuity + project picker
Phase: Phase 03 — AI (Claude Code bridge)
Date: 2026-10-08

## 1. Scope & Acceptance Criteria
- [x] Wire protocol messages in `@shellmind/protocol`:
  - `ChatTurn` schema: `id`, `role: "user" | "assistant"`, `text?: string`, `toolEvents?: AgentStreamEvent[]`, `timestamp: number`, `status?: "streaming" | "done" | "aborted" | "error"`.
  - `chat.history.req`: Client history query (`projectCwd?: string`, `limit?: number`).
  - `chat.history.resp`: Agent history payload (`currentCwd: string`, `turns: ChatTurn[]`).
- [x] Pure core interfaces in `@shellmind/agent`:
  - `ITranscriptStore` in `src/core/transcript.ts` (0 Node builtins or I/O imports).
  - Methods: `appendTurn()`, `getTranscript()`, `clearTranscript()`.
- [x] Concrete adapters in `@shellmind/agent`:
  - `FileTranscriptStore` in `src/adapters/storage/file-transcript.ts`:
    - Local JSON file storage under `~/.shellmind/transcripts/` (mode 0600).
    - Capped at max N turns (e.g. 100) to guarantee bounded storage.
    - Project context isolation (hash/slug key per directory path).
  - `AgentDaemon` integration:
    - Appends user and assistant turns to transcript upon execution.
    - Handles `chat.history.req` and replies with `chat.history.resp`.
    - Automatically switches transcript context when `project.set` changes cwd.
- [x] Mobile Client, Tool Renderers & UI in `@shellmind/mobile`:
  - `AgentClient` methods: `requestChatHistory()`, `onChatHistory()`.
  - `ToolEventRenderer` registry in `packages/mobile/src/renderers/`:
    - `BashRenderer`: terminal output with command and status pill.
    - `FileRenderer`: file read/write/edit display.
    - `SearchRenderer`: glob/grep patterns and findings.
    - `DefaultRenderer`: fallback JSON card for unrecognized tools.
  - `ChatScreen.tsx` component:
    - Streaming message timeline (user bubbles, assistant streaming text, tool renderer cards).
    - Project picker dropdown (calling `project.list` and `project.set`).
    - Abort button to cancel in-flight turns.
    - Session continuity: on reconnect, requests chat history and resumes transcript without duplicates.
- [x] Edge cases covered (from `verification/edge-cases.md`):
  - Reconnect mid-stream resumes transcript without duplicate bubbles.
  - Empty or huge transcript handled safely (capped size).
  - Switching project mid-session resets context to that project's clean transcript.
  - Unknown/custom tool types fall back gracefully to default renderer.
  - Backgrounding/reconnecting during in-flight turn preserves state.
- [x] Architecture boundaries: pure core contains 0 I/O; `check-architecture.sh` reports 0 violations.
- [x] Full verification suite passing (`pnpm verify`).

## 2. Edge cases & failure paths (from `verification/edge-cases.md`)
- Reconnect during turn: transcript deduplication by turn `id`.
- Empty transcript: renders empty chat state without crashes.
- Corrupted transcript on disk: logs error, recovers with empty transcript.
- Very long transcript: capped at max turns to prevent memory/disk exhaustion.
- Unknown tool type: renders safely using `DefaultRenderer`.
- Rapid project switching: updates active cwd and loads corresponding transcript cleanly.

## 3. E2E scenario(s)
1. User opens ChatScreen: project picker loads available projects (`project.list`).
2. User selects project: switches cwd (`project.set`) and fetches project transcript (`chat.history.req`).
3. User prompts: prompt sent (`agent.prompt`), stream renders assistant text and tool events.
4. Client disconnects and reconnects: client fetches transcript (`chat.history.req`) and recovers conversation history without duplicates.

## 4. Plan (thinnest vertical slice)
1. Protocol schemas in `packages/protocol/src/messages/chat.ts` and registry.
2. Core `ITranscriptStore` in `packages/agent/src/core/transcript.ts`.
3. Adapter `FileTranscriptStore` in `packages/agent/src/adapters/storage/file-transcript.ts` and daemon wiring.
4. Tool renderer registry and `ChatScreen.tsx` in `packages/mobile`.
5. Tests (protocol, transcript store, daemon integration, mobile client and renderers).
6. Maestro flow in `.maestro/chat_flow.yaml`.
7. Monorepo verification (`pnpm verify`) and PR review/merge.
