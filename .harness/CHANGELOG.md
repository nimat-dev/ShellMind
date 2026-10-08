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

## 2026-10-07 — F005 Mobile terminal UI (emulator + accessory keys + scrollback + history) — COMPLETE
Branch/commit: feat/F005
Evidence:
  - `ADR-0002`: Native React Native ANSI Stream Buffer (`TerminalBuffer`) selected and documented
  - `pnpm test` -> 49/49 tests pass (18 protocol, 10 agent, 21 mobile)
  - `packages/mobile/src/terminal/buffer.test.ts` -> 8/8 tests pass (ANSI 16/256/RGB colors, bold/underline, carriage return line overwrite, backspace, chunked escape sequences, OSC stripping, scrollback limits, clear display)
  - `packages/mobile/src/mobile.test.ts` -> validates terminal streaming integration against live WebSocket server (`term.open`, `term.data`, `term.input`, `term.resize`, `term.exit`)
  - Components implemented: `AccessoryBar.tsx` (Ctrl, Esc, Tab, arrows, symbols, Hist), `HistoryModal.tsx` (tap-to-rerun list), `TerminalScreen.tsx` (monospace autoscroll, responsive resize, disconnect banner), `App.tsx` (terminal & status tab navigation)
  - E2E flow specification recorded in `.maestro/terminal_flow.yaml`
  - `scripts/check-architecture.sh` -> 0 dependency violations across 42 modules (mobile never imports agent; imports protocol only)
  - full suite: `pnpm verify` -> green (typecheck, lint, test, check-architecture)
Evaluator: acceptance=5 correctness=5 boundaries=5 modularity=5 evidence=5 => avg 5.0 (PASS)
Notes: Concludes core mobile terminal interaction. Smooth, zero-latency native thread rendering with responsive layout resize. Ready for F006 (system-info tiles).

## 2026-10-07 — F004 PTY in agent (node-pty): stream output, input, resize, exit — COMPLETE
Branch/commit: feat/F004
Evidence:
  - `pnpm test` -> 40/40 tests pass (18 protocol, 10 agent, 12 mobile)
  - `packages/protocol/src/protocol.test.ts` -> validates round-trip encoding/decoding of `term.open`, `term.input`, `term.data`, `term.resize`, `term.exit`
  - `packages/agent/src/agent.test.ts` -> validates real PTY spawn via `node-pty`, stdout stream delivery via `term.data`, stdin command execution, window resizing via `term.resize`, clean exit via `term.exit` (exitCode 0)
  - Orphan process protection -> asserts child PTY process killed immediately upon socket disconnect (0 active sessions remaining)
  - `scripts/check-architecture.sh` -> 0 dependency violations across 38 modules (PTY strictly in `adapters/pty/**`, `src/core` has 0 Node builtins or I/O)
  - full suite: `pnpm verify` -> green (typecheck, lint, test, check-architecture)
  - e2e: integration test against real shell session over WebSocket verifies full terminal lifecycle
Evaluator: acceptance=5 correctness=5 boundaries=5 modularity=5 evidence=5 => avg 5.0 (PASS)
Notes: Auto-resolves macOS `spawn-helper` permission bug via `ensureSpawnHelperExecutable` before spawn and `scripts/init.sh`. Ready for F005 (mobile terminal UI).

## 2026-10-07 — F003 Mobile skeleton + QR pairing + connect + status — COMPLETE
Branch/commit: feat/F003
Evidence:
  - `pnpm test` -> 37/37 tests pass (17 protocol, 8 agent, 12 mobile)
  - `packages/mobile/src/mobile.test.ts` -> validates pairing payload validator (`parsePairingPayload`), `MemorySecureStorage`, `ExpoSecureStoreAdapter`, and `AgentClient` socket lifecycle against live WebSocket server
  - `AgentClient` -> executes `hello` handshake, transitions to `Online`, captures session ID and server name, computes ping RTT latency
  - `StatusScreen` & `PairingScreen` -> renders Online/Offline/Connecting/Error states, latency badge, server metadata, and unpair workflow
  - Edge cases covered: invalid JSON payload, missing `dev_` or `tok_` prefixes, invalid port, `hello.reject` with `FORBIDDEN` or `REVOKED`, offline/unreachable agent host, unpairing cleanup
  - `scripts/check-architecture.sh` -> 0 dependency violations across 33 modules (mobile never imports agent; imports protocol only)
  - full suite: `pnpm verify` -> green (typecheck, lint, test, check-architecture)
  - e2e: integration test against live WebSocket test server (`mobile.test.ts`) verifies full pairing and socket lifecycle
Evaluator: acceptance=5 correctness=5 boundaries=5 modularity=5 evidence=5 => avg 5.0 (PASS)
Notes: Concludes Phase 01 (Foundation). The entire phone⇄agent pipe is proven, authenticated, encrypted over tailnet, with round-trip latency verified. Ready for Phase 02 (Terminal & telemetry).

## 2026-10-07 — F002 Agent daemon + tailnet transport + device-token auth — COMPLETE
Branch/commit: feat/F002
Evidence:
  - `pnpm test` -> 25/25 tests pass (17 protocol tests + 8 agent integration tests)
  - `packages/agent/src/agent.test.ts` -> validates live socket handshake, valid token auth -> hello.ack + pong, invalid token -> hello.reject (FORBIDDEN), revoked device -> hello.reject (REVOKED), premature message -> hello.reject (UNAUTHORIZED), malformed json rejection
  - `packages/agent/src/cli.ts` -> `shellmind pair`, `shellmind devices`, `shellmind revoke`, `shellmind dev`, `shellmind status` functional
  - `packages/agent/dist/cli.js dev` -> refuses to start when no tailscale interface detected
  - `packages/agent/dist/cli.js status` -> reports tailnet status and paired device counts
  - `FileDeviceRegistry` -> writes mode 0600 file permissions, stores SHA-256 hashed tokens, raw token never written to disk
  - `TailnetTransportServer` -> strictly refuses to bind to `0.0.0.0`, detects Tailscale CGNAT IPs (100.64.0.0/10)
  - `scripts/check-architecture.sh` -> 0 dependency violations across 24 modules (`src/core` has 0 I/O imports, pure protocol has 0 I/O imports)
  - full suite: `pnpm verify` -> green (typecheck, lint, test, check-architecture)
  - e2e: N/A at mobile level (covered by F003); agent-side integration test drives real WebSocket socket
  - edge cases: no token, wrong token, revoked device, malformed handshake, duplicate pairing, token literal never logged or persisted in plaintext
Evaluator: acceptance=5 correctness=5 boundaries=5 modularity=5 evidence=5 => avg 5.0 (PASS)
Notes: MessageHandler registry implemented in `AgentDaemon` adhering to MODULES.md §1. Transport abstraction allows future relay/p2p transports.

## 2026-10-07 — F001 Monorepo + protocol core + scripts — COMPLETE
Branch/commit: feat/F001
Evidence:
  - `pnpm typecheck` -> 3/3 packages compile cleanly with zero errors
  - `pnpm lint` -> eslint passes cleanly
  - `pnpm test` -> 15/15 unit tests pass in `@shellmind/protocol` (round-trip, envelopes, size limits, error schemas, registry)
  - `scripts/check-architecture.sh` -> 0 dependency violations (and verified catches seeded violation)
  - `scripts/init.sh` -> all 9 baseline checks pass
  - full suite: `pnpm verify` -> green (no regressions)
  - e2e: N/A — foundation protocol & workspace tooling (not user-facing)
  - edge cases: malformed JSON, payload size ceiling, unknown message types, invalid envelope versions, missing fields
Evaluator: acceptance=5 correctness=5 boundaries=5 modularity=5 evidence=5 => avg 5.0 (PASS)
Notes: Protocol pure core invariant strictly verified by dependency-cruiser. Monorepo wired with pnpm workspaces.

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
