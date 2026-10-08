# CHANGELOG — completed implementation, with evidence

Newest first. One entry per feature that reached `COMPLETE`. An entry is not valid without
reproducible evidence (see `verification/acceptance-evidence.md`).

## Template
```
## <YYYY-MM-DD> — <FID> <feature name> — COMPLETE
Branch/commit: <branch> @ <sha>   PR: <url>   CI: <green + link>
Evidence:
  - <exact command> -> <result / test id / artifact path>
  - full suite: <command> -> <N passed, 0 failed> (no regressions)
  - e2e: <command> -> <scenarios passed / N-A not user-facing> (trace: .harness/evidence/<FID>/)
  - edge cases: <the applicable edge-cases.md categories covered, by test>
Evaluator: acceptance=_ correctness=_ boundaries=_ modularity=_ evidence=_ => avg _._  (PASS)
Notes: <anything the next agent should know>
```

<!-- entries go below, newest first -->

## 2026-10-07 — F000 Claude Code headless spike — COMPLETE
Branch/commit: feat/F000
Evidence:
  - `claude -p "say hi" --output-format stream-json --verbose` (no `ANTHROPIC_API_KEY`) -> runs on subscription (`.harness/evidence/F000-subscription-say-hi-raw.jsonl`)
  - `node --experimental-strip-types spike/test_parser.ts` -> parses JSONL into discrete events (`.harness/evidence/F000-allow-parsed.json`, `.harness/evidence/F000-deny-parsed.json`)
  - Programmatic MCP permission allow test -> executes command, creates file (`.harness/evidence/F000-allow-run-raw.jsonl`)
  - Programmatic MCP permission deny test -> rejects command with policy message, prevents file creation (`.harness/evidence/F000-deny-run-raw.jsonl`)
  - full suite: N/A in Phase 00 (no monorepo yet; verified via spike tests)
  - e2e: N/A — de-risking spike, not user-facing
  - edge cases: denial path, rate limit event handling, missing verbose flag requirement, MCP tool namespacing
Evaluator: acceptance=5 correctness=5 boundaries=5 modularity=5 evidence=5 => avg 5.0 (PASS)
Notes: Claude Code strictly requires `--verbose` with `--output-format=stream-json`; MCP tools must be referenced via full namespaced id `mcp__<server>__<tool>`. Documented in ADR-0001 and DECISIONS.md (DEC-009).
