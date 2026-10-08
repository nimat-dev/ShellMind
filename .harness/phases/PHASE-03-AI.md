# Phase 03 — AI (Claude Code bridge)

The differentiator. Bridge the phone to the local Claude Code (proven in F000). The agent stays a
thin, auditable executor; Claude Code is the brain and owns the tools; the human approves on the
phone. **Gated on Phase 00** — if the spike disproved the thesis, re-plan before starting F007.

## F007 — Claude driver
**Status**: COMPLETE (PR #8)

### Acceptance criteria
- [x] `claude-driver` adapter spawns `claude -p --output-format stream-json` under the subscription
      (no API key), scoped to a `projectCwd`; parses the JSONL stream into `agent.stream` events
      (`assistant_text`, `tool_use`, `tool_result`, `done`, `aborted`, `error`).
- [x] `project.list` / `project.set` switch the cwd (phone-switchable); `agent.abort` cancels the
      current turn and kills the child cleanly.
- [x] Edge/error cases: `claude` not installed / not logged in → typed `error` (actionable);
      malformed JSONL line tolerated; very long stream (backpressure); abort mid-tool; empty prompt;
      process crash surfaced, no zombie.
- [x] E2E/integration: prompt "list the files here" → stream shows an `LS`/`Bash` tool_use + a text
      answer, against a seeded project dir. Evidence under `.harness/evidence/F007/`.
- [x] Boundary invariants: spawning/parsing only in `adapters/claude-driver/**`; stream event types
      defined in `@shellmind/protocol`; `check-architecture` passes.
- [x] Verification: full verify green, no regressions.

## F008 — Permission bridge + confirm UI + allowlist + audit log
**Status**: COMPLETE (PR #9 pending)

### Acceptance criteria
- [x] Claude Code's permission prompt (mechanism chosen in F000) is intercepted and routed as a
      `perm.request` → phone **allow/deny card** showing the command/tool, cwd, and the pure
      `RiskHint` from `protocol`; `perm.response` releases or skips it.
- [x] Deny-by-default for writes/exec; a configurable **allowlist** auto-allows read-only commands;
      destructive patterns get extra friction (explicit confirm). The hint is a UX signal — the
      human decision is the gate (`PRODUCT.md`/`layer-boundaries.md`).
- [x] **Append-only audit log** on the agent: every executed/approved tool call recorded with
      decision + result, **written before** a dangerous command runs.
- [x] Edge/error cases (`edge-cases.md`, exhaustively): obfuscated/chained commands
      (`a && rm -rf`, `$(…)`, aliases) still gated by the human (classifier never trusted as the
      gate); prompt times out → treated as deny; phone disconnects mid-prompt → deny + abort;
      double-tap allow is idempotent; "remember for session" scoped to the session only; revoked
      device mid-session → all pending prompts denied; audit log never silently truncated.
- [x] E2E (Maestro): a write/exec turn pauses → approve → runs + audited; another → deny → skipped
      + audited; an allowlisted read auto-runs. Trace under `.harness/evidence/F008/`.
- [x] Boundary invariants: permission *rules* pure in `protocol`; I/O (audit file, transport) in
      adapters; `check-architecture` passes.
- [x] Verification: full verify + e2e green, no regressions.

## F009 — Chat UI + session continuity + project picker
**Status**: COMPLETE (PR #10)

### Acceptance criteria
- [x] Streaming chat view: user turns, assistant text as it streams, tool events rendered via the
      tool-renderer registry (`MODULES.md`); abort button.
- [x] Project picker drives `project.list`/`project.set`.
- [x] Session continuity: transcript persisted locally on the agent (`DATA_MODEL.md`); reconnect
      resumes the conversation ("continue what I was doing").
- [x] Edge/error cases: reconnect mid-stream resumes without dupes; empty/huge transcript; switch
      project mid-session starts a clean context; unknown tool → generic renderer; backgrounding
      doesn't drop an in-flight turn.
- [x] E2E (Maestro): "why is my project failing?" against a seeded broken project drives tools +
      an answer; disconnect/reconnect resumes the transcript. Trace under `.harness/evidence/F009/`.
- [x] Boundary invariants: UI via protocol only; renderers registered, chat core untouched per
      tool; `check-architecture` passes.
- [x] Verification: full verify + e2e green, no regressions.

## Phase completion criteria
From the phone you can ask the local Claude to investigate a real project, approve/deny its actions
safely with an audit trail, and resume a session after reconnect; full suite + e2e green;
check-architecture clean. Then Phase 04 starts.
