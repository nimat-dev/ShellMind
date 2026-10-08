# DECISIONS — decision log

Indexes the architecture ADRs (`architecture/decisions/`) and records lighter decisions that
don't need a full ADR. Don't relitigate a decision here without a new one that supersedes it.

## Format
```
DEC-00N (<YYYY-MM-DD>): <decision, stated plainly>. — <why> [ADR-XXXX if applicable]
```

DEC-001 (2026-10-07): Product is a bridge to the **local Claude Code**, not a new AI agent. The
machine's Claude Code (tools + permission system) is the brain; ShellMind adds a mobile head +
voice. — Avoids reimplementing agent loop/tools/permissions; leverages what's installed.

DEC-002 (2026-10-07): Brain runs on the user's **Claude subscription via headless `claude -p
--output-format stream-json`** — no Anthropic API key, no billing, no cloud backend. — User has a
subscription; keeps it free + private. Validated in F000. [ADR-0001]

DEC-003 (2026-10-07): Transport = the user's **Tailscale (WireGuard) mesh** + a paired
device-token; agent binds the tailnet interface only. Transport is an interface so relay/P2P slot
in later. — WireGuard gives E2E + NAT traversal for free; no custom crypto/relay to build in V1.

DEC-004 (2026-10-07): Stack = **TypeScript end-to-end** in a pnpm monorepo — `protocol` (pure
core, zod only), `agent` (Node), `mobile` (Expo/RN). — One language, shared types are the pure
core; fits the harness's pure-core invariant and the one-feature cadence.

DEC-005 (2026-10-07): Tooling = vitest, ESLint, **dependency-cruiser** (enforces layer
boundaries), Maestro (iOS e2e). — Greenfield TS-monorepo defaults; dependency-cruiser flips
check-architecture to a real gate.

DEC-006 (2026-10-07): Agent distribution = **`npm i -g @shellmind/agent`** + a `shellmind` CLI
that installs a **user service** (launchd LaunchAgent / systemd --user); runs as the logged-in
user, never root. Agent targets macOS + Linux. — Claude Code is itself a Node CLI, so Node is
already present ⇒ the agent adds no new runtime dep; a single npm publish beats 2–3 packaging
pipelines. Single-binary/brew/curl deferred.

DEC-007 (2026-10-07): V1 scope = **one computer; iOS-only mobile; terminal + AI + thin voice**.
Voice is on-device iOS speech (STT→chat, TTS replies). Deferred (design-for only): multi-computer,
notifications/push, screen capture, Android, Windows, hosted relay. — Tightest provable slice;
the differentiator is the AI + permission model, not voice or breadth.

DEC-008 (2026-10-07): Phase 00 is a **throwaway spike (F000)** run before any product code,
because the entire thesis depends on DEC-002 holding. — Cheap to verify; expensive to discover
late. If disproven, re-plan Phase 03 (e.g. fall back to API-key mode).

DEC-009 (2026-10-07): Programmatic permission interception uses an internal MCP server via
`--permission-prompt-tool mcp__<server>__<tool>` and requires `--verbose` with `--output-format stream-json`.
Decisions are delivered as JSON strings `{ behavior: "allow" }` or `{ behavior: "deny", message: "..." }`.
— Proven in F000 spike; avoids brittle TTY parsing or SDK stdin handshake. [ADR-0001]

DEC-010 (2026-10-07): Mobile terminal UI uses a **Native React Native ANSI Stream Buffer (`TerminalBuffer`)**
rather than xterm.js in a WebView. Delivers zero input latency, native mobile keyboard & accessory bar
integration, and pure-TypeScript unit-testability without native webview binary overhead. [ADR-0002]

