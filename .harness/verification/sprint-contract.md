# Sprint Contract — F002: Agent daemon + tailnet transport + device-token auth

Feature: F002 — Agent daemon + tailnet transport + device-token auth
Phase: Phase 01 — Foundation (prove the pipe)
Date: 2026-10-07

## 1. Scope & Acceptance Criteria
- [x] `shellmind` daemon binds a transport server on the **tailnet interface only** (not `0.0.0.0`); refuses to start if no tailnet interface is found (clear, actionable error).
- [x] `Transport` interface defined in agent core with a `tailnet` adapter registered (per `MODULES.md`); core never imports the concrete adapter directly.
- [x] Device-token handshake: a connection with a valid paired token → `hello.ack` + `pong` on `ping`; **missing/invalid/revoked token → `hello.reject`, connection closed**, logged without leaking secrets.
- [x] Local device registry persists paired devices (SHA-256 hashed token, mode 0600 file); `shellmind devices` lists + revokes.
- [x] Wire messages in `@shellmind/protocol`: `hello`, `hello.ack`, `hello.reject` schemas added and registered.
- [x] Edge/error cases from §2 covered: no token, wrong token, revoked device, malformed handshake, duplicate pairing, token literal never logged.
- [x] E2E: N/A at mobile level (covered by F003); agent-side integration tests drive a real socket.
- [x] Boundary invariants: `check-architecture` passes (I/O strictly in `src/adapters/**`, `src/core` has no I/O).
- [x] Verification: full verify (`pnpm verify`) green, no regressions.

## 2. Edge cases & failure paths (from `verification/edge-cases.md`)
- Tailscale not running / no tailnet interface found -> Refuses to start, emits descriptive exit error explaining tailnet interface is missing.
- Missing authentication token in hello handshake -> Returns `hello.reject` with `UNAUTHORIZED`, closes connection.
- Invalid token hash mismatch -> Returns `hello.reject` with `FORBIDDEN`, closes connection.
- Revoked device -> Device exists in registry but `revokedAt` is set; returns `hello.reject` with `REVOKED`, refuses connection.
- Malformed handshake message (not valid `hello` frame) -> Returns `hello.reject` with `MALFORMED_HANDSHAKE`, terminates connection.
- Token secrecy: raw token literals must never be saved to disk or logged to stdout/stderr (stored as SHA-256 hash).
- File permissions: device registry file is written with strict 0600 (owner read/write only) permissions.

## 3. E2E scenario(s)
N/A at mobile level. Agent-side integration tests drive a real network socket over localhost/tailnet test harness.

## 4. Plan (thinnest vertical slice)
1. Add `hello`, `hello.ack`, `hello.reject` schemas to `@shellmind/protocol`.
2. Define `Transport`, `TransportConnection`, and `TransportListener` interfaces in `packages/agent/src/core/transport.ts`.
3. Implement `DeviceRegistry` adapter (`packages/agent/src/adapters/storage/device-registry.ts`) with SHA-256 hashing and 0600 file mode.
4. Implement tailnet interface detection and WebSocket/TCP server adapter in `packages/agent/src/adapters/transport/tailnet.ts`.
5. Implement daemon server core (`packages/agent/src/core/daemon.ts`) coordinating transport, handshake, and message dispatch.
6. Implement CLI commands (`shellmind pair`, `shellmind devices`, `shellmind dev`, `shellmind start/stop/status`) in `packages/agent/src/cli.ts`.
7. Write unit and integration tests covering valid handshake, bad token, revoked device, malformed handshake, and secret leak checks.
8. Verify layer boundaries with `pnpm check-architecture` and full suite with `pnpm verify`.

## 5. Out of scope (parked, not built)
- Mobile UI and QR scanner (F003).
- Terminal PTY streaming (F004).
- Claude Code process execution (F007).

## 6. New dependencies (with justification)
- `ws` in `packages/agent` for WebSocket transport server.
- `@types/ws` in devDependencies.

## 7. Risks
- OS network interface naming differences: Tailscale interfaces can be named `tailscale0`, `utun*` with 100.x.y.z IP, or custom CGNAT range (100.64.0.0/10). Detect by both interface name patterns and 100.64.0.0/10 subnet match.
