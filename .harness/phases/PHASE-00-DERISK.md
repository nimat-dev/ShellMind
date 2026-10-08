# Phase 00 — De-risk

The whole product rests on one assumption. Prove it with throwaway code before building anything
real. If it fails, re-plan Phase 03 (or the product) — do not proceed on hope.

## F000 — Claude Code headless spike
**Status**: IN PROGRESS

### The question
Can the desktop agent use the **local Claude Code subscription** (no API key) as the AI brain,
and **intercept its permission prompts** to answer them from elsewhere (the phone)?

### Acceptance criteria
- [ ] `claude -p "<prompt>" --output-format stream-json` runs under the logged-in **subscription**
      (no `ANTHROPIC_API_KEY` set) and emits a parseable JSONL stream — captured verbatim as evidence.
- [ ] The stream is parsed in Node (TypeScript) into discrete events (assistant text, tool_use,
      tool_result, done) — a tiny parser + a sample transcript committed as evidence.
- [ ] A **permission prompt is intercepted and answered programmatically**: using a
      `--permission-prompt-tool` (MCP) and/or hooks, a tool call (e.g. a write/`Bash`) is paused,
      a decision is supplied by *our* code (not an interactive TTY), and allow→runs / deny→skips is
      demonstrated. Evidence: the two runs’ output.
- [ ] Findings documented in `DECISIONS.md` + an ADR under `architecture/decisions/`: exact
      command/flags, auth behavior, the permission mechanism chosen for F007/F008, and any limits
      hit (version, flags, MCP setup).
- [ ] Spike code is throwaway: kept under `spike/` and git-ignored from the product build, or
      deleted after the ADR captures what matters. It is **not** wired into any package.

### Explicitly NOT in this phase
No monorepo, no protocol package, no transport, no mobile app. Just answer the question.

### Evidence expected
Captured terminal output of the subscription run, the sample parsed JSONL, the two
permission-decision runs, and the committed ADR.

## Phase completion criteria
The thesis is confirmed (or disproven + re-planned) and recorded in an ADR before Phase 01 starts.
If disproven: open a blocker, revise `PRODUCT.md`/`ROADMAP.md`, and decide the fallback (e.g.
API-key mode) before building the bridge.
