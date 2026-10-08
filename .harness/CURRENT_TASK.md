# CURRENT TASK

**Feature**: F009 — Chat UI + session continuity + project picker
**Phase**: Phase 03 — AI (Claude Code bridge)
**Status**: COMPLETE (Ready for PR & merge)

## Exact next steps
1. **Protocol definitions (`packages/protocol`)**:
   - `ChatTurn` schema and types:
     `id: string` (`msg_...`), `role: "user" | "assistant"`, `text?: string`, `toolEvents?: AgentStreamEvent[]`, `timestamp: number`, `status: "streaming" | "done" | "aborted" | "error"`.
   - `chat.history.req` message (`projectCwd?: string`, `limit?: number`).
   - `chat.history.resp` message (`currentCwd: string`, `turns: ChatTurn[]`).
   - Register in `registry.ts`, `codec.ts`, `index.ts`.
2. **Pure core interfaces (`packages/agent/src/core`)**:
   - `ITranscriptStore`, `TranscriptFilter` in `src/core/transcript.ts` (0 Node builtins or I/O imports).
   - Manages ordered turns per project session key, truncation/size cap, and retrieval.
3. **Transcript Store Adapter & Daemon Integration (`packages/agent`)**:
   - `FileTranscriptStore` in `src/adapters/storage/file-transcript.ts`:
     - Local JSON persistence under `~/.shellmind/transcripts/` (mode 0600).
     - Caps history to last N turns (default 100) to prevent unbounded file growth.
     - Isolate transcripts by project directory key.
   - Wire into `AgentDaemon`:
     - On `agent.prompt`: records user turn; streams events and records completed assistant turn.
     - On `chat.history.req`: returns stored turns for the current project.
     - On `project.set`: switches active project transcript context.
4. **Mobile Tool Renderer Registry & Chat UI (`packages/mobile`)**:
   - `ToolEventRenderer` registry in `packages/mobile/src/renderers/`:
     - `Bash`: terminal command & output card.
     - `Read` / `Write` / `Edit`: file modification card.
     - `GlobTool` / `GrepTool`: search query card.
     - `Default`: fallback generic renderer for arbitrary/unrecognized tools.
   - `ChatScreen.tsx`:
     - Project Picker dropdown (drives `project.list` and `project.set`).
     - Live streaming chat timeline: user bubbles, assistant streaming text, tool renderer cards, in-flight `PermissionCard` embed.
     - Input bar: prompt text field, Send button, Abort button (visible when busy).
     - Reconnect resume: calls `requestChatHistory()` to populate transcript seamlessly without duplicates.
   - Update `AgentClient` in `packages/mobile/src/client.ts` with `requestChatHistory` and `onChatHistory`.
5. **Testing and Verification**:
   - Protocol tests for `chat.history` messages and schemas.
   - Unit tests for `FileTranscriptStore` (turn appending, size cap, project isolation, corrupted file resilience).
   - Integration tests in `claude-driver.test.ts` & `agent.test.ts` for chat history sync and reconnect resumption.
   - Mobile tests for `AgentClient.requestChatHistory`, `ToolEventRenderer` registry, and `ChatScreen`.
   - Maestro flow specification (`.maestro/chat_flow.yaml`).
   - Full verification suite: `pnpm verify`.
