# CURRENT TASK

**Feature**: F000 — Claude Code headless spike
**Phase**: Phase 00 — De-risk
**Status**: IN PROGRESS

## Exact next step
In a throwaway `spike/` directory (not a workspace package):
1. Run `claude -p "say hi" --output-format stream-json` with **no `ANTHROPIC_API_KEY`** in the
   env; confirm it runs on the subscription and capture the raw JSONL stream.
2. Write a tiny TS parser that turns the JSONL into events (assistant_text, tool_use, tool_result,
   done); save a sample parsed transcript.
3. Make a tool call pause and be **answered by our code** (not an interactive TTY) via
   `--permission-prompt-tool` (a minimal MCP server) and/or hooks; demonstrate allow→runs and
   deny→skips.
4. Record findings + the chosen permission mechanism in an ADR under
   `architecture/decisions/ADR-0001-*.md` and index it in `DECISIONS.md`.

## Acceptance (summary)
See `phases/PHASE-00-DERISK.md` for full criteria, and write the signed
`verification/sprint-contract.md` for F000 before building.

## Definition of done
Thesis confirmed (or disproven + re-planned) with captured evidence + an ADR; spike code is
throwaway (git-ignored or deleted), not wired into any package. Evaluator PASS.
(`AGENTS.md` → Definition of done. Note: init/full-suite/e2e are N/A in Phase 00 — the "evidence"
is the captured runs + ADR; say so in the contract.)
