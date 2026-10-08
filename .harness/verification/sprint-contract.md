# Sprint Contract — F000: Claude Code headless spike

Feature: F000 — Claude Code headless spike
Phase: Phase 00 — De-risk
Date: 2026-10-07

## 1. Scope & Acceptance Criteria
- [x] `claude -p "<prompt>" --output-format stream-json --verbose` runs under the logged-in subscription (no `ANTHROPIC_API_KEY` set) and emits a parseable JSONL stream — captured verbatim in `.harness/evidence/F000-subscription-say-hi-raw.jsonl`.
- [x] Stream parsed in Node (TypeScript) into discrete events (assistant_text, tool_use, tool_result, rate_limit, done) — implemented in `spike/stream_parser.ts`, verified via `spike/test_parser.ts`, parsed transcripts saved in `.harness/evidence/F000-allow-parsed.json` and `F000-deny-parsed.json`.
- [x] Permission prompt intercepted and answered programmatically: using an internal MCP server with `--permission-prompt-tool mcp__perm_server__permission_prompt`, demonstrating allow→runs and deny→skips with zero interactive TTY prompts. Captured in `.harness/evidence/F000-allow-run-raw.jsonl` and `F000-deny-run-raw.jsonl`.
- [x] Boundary invariants: spike code kept isolated in `spike/` and git-ignored; no workspace packages modified.
- [x] Edge/error cases from §2 covered: denial handling, missing verbose flag handling, namespaced tool identifier matching.
- [x] E2E: N/A — throwaway spike, de-risking foundation before Phase 01.
- [x] No regressions: N/A — no prior features.
- [x] Findings documented in ADR-0001 and indexed in `DECISIONS.md`.

## 2. Edge cases & failure paths (from `verification/edge-cases.md`)
- Unauthenticated / missing API key: verified that Claude uses the user's subscription token when `ANTHROPIC_API_KEY` is not present.
- Missing `--verbose` flag: identified that Claude CLI 2.1.293 exits with code 1 if `--output-format=stream-json` is passed without `--verbose`.
- Namespaced MCP tool names: identified that Claude CLI prefixes MCP tools with `mcp__<server_name>__<tool_name>` and the CLI flag requires the full namespaced name.
- Deny permission path: verified that returning `{"behavior": "deny", "message": "..."}` aborts tool execution and reports error to model without writing files.
- Rate limit event parsing: verified that periodic `rate_limit_event` payloads are captured and parsed with window utilization and reset timestamps.

## 3. E2E scenario(s)
N/A — Phase 00 de-risking spike. Monorepo and user-facing clients start in Phase 01.

## 4. Plan (thinnest vertical slice)
1. Verify `claude -p` headless execution without `ANTHROPIC_API_KEY`.
2. Determine required flags (`--verbose`, `--output-format stream-json`).
3. Construct minimal MCP permission server implementing `tools/call`.
4. Test allow path (command executes, file written).
5. Test deny path (command denied, file omitted).
6. Implement TS JSONL stream parser and verify output.
7. Record ADR-0001 and update DECISIONS.md.

## 5. Out of scope (parked, not built)
- Monorepo structure, protocol envelope, agent daemon, mobile app (reserved for Phase 01+).

## 6. New dependencies (with justification)
None. Built with Node 25 built-in TypeScript support and child_process.

## 7. Risks
- Future Claude Code CLI releases changing MCP namespacing or flag requirements: mitigated by locking version expectation and encapsulating driver options in agent package in F007.
