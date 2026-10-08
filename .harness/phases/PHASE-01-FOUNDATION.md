# Phase 01 — Foundation (prove the pipe)

Stand up the monorepo, the pure `protocol` core, and an authenticated, encrypted phone⇄agent
connection. The user-visible proof: a phone pairs with the agent over the tailnet and sees it go
Online, with a round-trip. No terminal/AI yet. Build the plumbing before the polish.

## F001 — Monorepo + protocol core + scripts
**Status**: NOT STARTED

### Acceptance criteria
- [ ] pnpm workspace with `packages/protocol`, `packages/agent`, `packages/mobile`; TS strict mode
      across all; shared base tsconfig.
- [ ] `@shellmind/protocol` exports the message envelope + zod schemas for `ping`/`pong` and the
      `error` message; a pure round-trip (parse→validate→serialize) unit test passes.
- [ ] `scripts/init.sh` and `scripts/check-architecture.sh` exist and run; `check-architecture`
      runs dependency-cruiser against the rules in `rules/layer-boundaries.md` and **passes** on
      the skeleton (and would fail on a seeded violation — prove with one throwaway test case).
- [ ] CI workflow runs typecheck + lint + test + check-architecture on push.
- [ ] Edge/error cases from `verification/edge-cases.md` (applicable): malformed/oversized message
      rejected by zod with a typed error; unknown message type handled.
- [ ] E2E: N/A — no user-facing flow yet (library/scaffold); recorded as N/A in the contract.
- [ ] Boundary invariants: `check-architecture` passes; `protocol` imports nothing with I/O.
- [ ] Verification: full verify (typecheck + lint + test + check-architecture) green, no regressions.

## F002 — Agent daemon + tailnet transport + device-token auth
**Status**: NOT STARTED

### Acceptance criteria
- [ ] `shellmind` daemon binds a transport server on the **tailnet interface only** (not
      `0.0.0.0`); refuses to start if no tailnet iface is found (clear error).
- [ ] `Transport` interface in agent core with a `tailnet` adapter registered (per `MODULES.md`);
      core never imports the concrete adapter.
- [ ] Device-token handshake: a connection with a valid paired token → `hello.ack` + `pong` on
      `ping`; **missing/invalid/revoked token → `hello.reject`, connection closed**, logged.
- [ ] A local device registry persists paired devices (hashed token, 0600 file); `shellmind
      devices` lists + revokes.
- [ ] Edge/error cases: no token, wrong token, revoked device, malformed handshake, duplicate
      pairing, token literal never logged — each covered by an integration test.
- [ ] E2E: N/A at mobile level (covered by F003); agent-side integration test drives a real socket.
- [ ] Boundary invariants: `check-architecture` passes (I/O only in `adapters/**`).
- [ ] Verification: full verify green, no regressions.

## F003 — Mobile skeleton + QR pairing + connect + status
**Status**: NOT STARTED

### Acceptance criteria
- [ ] Expo app (dev client) with a pairing screen that **scans the QR** printed by `shellmind
      pair` (tailnet host + one-time token + pubkey fingerprint); token stored in secure storage
      (`expo-secure-store`), never in plaintext/source.
- [ ] After pairing, the app connects and shows **Online / Offline**, with ping RTT.
- [ ] Edge/error cases: wrong/expired token → clear error (not a crash); agent offline → Offline
      state + retry; airplane mode / no tailnet → actionable message; app backgrounded→foregrounded
      reconnects.
- [ ] E2E (Maestro): against a running agent — scan a test pairing payload → Online; bad token →
      error; kill agent → Offline. Trace saved under `.harness/evidence/F003/`.
- [ ] Boundary invariants: mobile talks to the agent only via `@shellmind/protocol`;
      `check-architecture` passes.
- [ ] Verification: full verify + e2e green, no regressions.

## Phase completion criteria
A phone pairs over the tailnet and shows Online with a round-trip; bad/revoked tokens are
rejected; full suite + e2e green; check-architecture enforcing. Then Phase 02 starts.
