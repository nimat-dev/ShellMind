# PROJECT STATE — MASTER FILE

> Read this first, every session. Rewrite it for a cold reader before you stop.

## Where we are
- **Phase**: Phase 00 — De-risk (COMPLETE) -> entering Phase 01 — Foundation
- **Active feature**: F000 — Claude Code headless spike (COMPLETE); next: F001 — Monorepo + protocol core
- **Overall progress**: 1 / 12 features COMPLETE (8%)

## Last verified
- **Date**: 2026-10-07
- **F000 De-risk Verification**:
  - `claude -p` runs on user's subscription without `ANTHROPIC_API_KEY` (raw log in `.harness/evidence/F000-subscription-say-hi-raw.jsonl`).
  - `--verbose` discovered as mandatory flag when `--output-format=stream-json` is passed with `-p`.
  - Rate limit telemetry events (`rate_limit_event`) emitted with 5h/7d window utilization and `resetsAt`.
  - Programmatic permission prompt interception proven via internal MCP server (`--permission-prompt-tool mcp__perm_server__permission_prompt`).
  - Allow path verified: executes command, creates output file (`.harness/evidence/F000-allow-run-raw.jsonl`).
  - Deny path verified: blocks execution with reason, creates no output file (`.harness/evidence/F000-deny-run-raw.jsonl`).
  - Stream parser implemented and verified (`spike/stream_parser.ts`, parsed transcripts in `.harness/evidence/F000-*-parsed.json`).
  - ADR-0001 documented and indexed in `DECISIONS.md`.
- **Git**: branch `feat/F000`

## Next step
Start F001: scaffold pnpm workspace (`packages/protocol`, `packages/agent`, `packages/mobile`), pure protocol envelope + zod schemas (`ping`/`pong`/`error`), dependency-cruiser boundary checks, and CI workflow.

## Open blockers
See `BLOCKERS.md`. None open. Core assumption de-risked and confirmed.

## Notes for the next agent
- ShellMind core thesis is verified: headless Claude Code CLI on user's subscription with programmatic MCP permission prompt routing works reliably.
- Always include `--verbose` when using `--output-format=stream-json` with `-p`.
- When using `--permission-prompt-tool`, remember that Claude prefixes MCP tools with `mcp__<server_name>__<tool_name>`.
- F001 creates the real monorepo.
