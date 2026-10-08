# Phase 00 — De-risk

The whole product rests on one assumption. Prove it with throwaway code before building anything
real. If it fails, re-plan Phase 03 (or the product) — do not proceed on hope.

## F000 — Claude Code headless spike
**Status**: COMPLETE

### The question
Can the desktop agent use the **local Claude Code subscription** (no API key) as the AI brain,
and **intercept its permission prompts** to answer them from elsewhere (the phone)?

### Acceptance criteria
- [x] `claude -p "<prompt>" --output-format stream-json --verbose` runs under the logged-in **subscription**
      (no `ANTHROPIC_API_KEY` set) and emits a parseable JSONL stream — captured verbatim as evidence in
      `.harness/evidence/F000-subscription-say-hi-raw.jsonl`.
- [x] The stream is parsed in Node (TypeScript) into discrete events (assistant text, tool_use,
      tool_result, rate_limit, done) — parser in `spike/stream_parser.ts` + sample transcripts committed as evidence
      in `.harness/evidence/F000-allow-parsed.json` and `.harness/evidence/F000-deny-parsed.json`.
- [x] A **permission prompt is intercepted and answered programmatically**: using an MCP server with
      `--permission-prompt-tool mcp__perm_server__permission_prompt`, tool calls are intercepted without an
      interactive TTY, demonstrating allow→runs and deny→skips. Evidence: `.harness/evidence/F000-allow-run-raw.jsonl`
      and `.harness/evidence/F000-deny-run-raw.jsonl`.
- [x] Findings documented in `DECISIONS.md` (DEC-002, DEC-009) + ADR-0001 under `architecture/decisions/`: exact
      command/flags, auth behavior, chosen MCP permission mechanism, and CLI flags requirements.
- [x] Spike code is throwaway: kept under `spike/` and git-ignored from the product build in `.gitignore`. Not wired
      into any package.

### Explicitly NOT in this phase
No monorepo, no protocol package, no transport, no mobile app. Just answer the question.

### Evidence expected
Captured terminal output of the subscription run, the sample parsed JSONL, the two
permission-decision runs, and the committed ADR. (All present under `.harness/evidence/` and `architecture/decisions/`).

## Phase completion criteria
The thesis is confirmed (or disproven + re-planned) and recorded in an ADR before Phase 01 starts.
Thesis is **CONFIRMED** — Proceed to Phase 01.
