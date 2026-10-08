# Sprint Contract — F003: Mobile skeleton + QR pairing + connect + status

Feature: F003 — Mobile skeleton + QR pairing + connect + status
Phase: Phase 01 — Foundation (prove the pipe)
Date: 2026-10-07

## 1. Scope & Acceptance Criteria
- [x] Expo mobile client skeleton configured with TypeScript strict mode in `packages/mobile`.
- [x] Secure storage abstraction (`ISecureStorage`) with `ExpoSecureStoreAdapter` for native runtime and test fallback. Device token stored securely, never in plaintext source.
- [x] Pairing model & screen: parses pairing payload (`{ host, port, deviceId, token }`) from QR code scan or manual input.
- [x] Connection client (`AgentClient`):
  - Connects to agent daemon over WebSocket (`ws://<host>:<port>`).
  - Initiates `hello` handshake frame using `@shellmind/protocol`.
  - Transitions to `Online` upon `hello.ack`; captures `sessionId` and `serverName`.
  - Computes and tracks ping RTT round-trip latency (`rttMs`).
  - Transitions to `Offline` on connection loss; gracefully attempts reconnection.
  - Captures `hello.reject` with actionable error messages (`FORBIDDEN`, `REVOKED`, `UNAUTHORIZED`).
- [x] Status UI (`App` / `StatusScreen`): displays Online/Offline badge, RTT latency, host, session details, and unpair option.
- [x] Edge/error cases from §2 covered: wrong token, agent offline, socket drops, unpair flow.
- [x] Boundary invariants: mobile imports `@shellmind/protocol` only, never `packages/agent`; `check-architecture` passes.
- [x] Verification: full verify (`pnpm verify`) passes cleanly.

## 2. Edge cases & failure paths (from `verification/edge-cases.md`)
- Wrong or expired token -> `hello.reject` received, mobile displays clear error message ("Pairing rejected: Invalid credentials"), does not crash.
- Agent offline / unreachable host -> Socket emits error / close, client transitions to `Offline` state with retry button.
- Malformed pairing JSON -> Parsing validator flags error before attempting connection.
- Sudden disconnect / agent restarted -> Socket close event transitions client to `Offline`, resumes reconnection loop.
- Unpairing -> Clears secure storage token, cleans up active socket, resets state back to Pairing screen.

## 3. E2E scenario(s)
Integration tests in `packages/mobile/src/mobile.test.ts` drive end-to-end socket interaction against a WebSocket transport server:
1. Valid pairing payload -> connects -> `hello.ack` -> reports `Online` with ping RTT.
2. Invalid token -> connects -> `hello.reject` -> reports `Error: FORBIDDEN`.
3. Agent server stops -> reports `Offline`, unpair resets state to clean pairing view.

## 4. Plan (thinnest vertical slice)
1. Write sprint contract (`.harness/verification/sprint-contract.md`).
2. Implement secure storage abstraction (`packages/mobile/src/storage.ts`).
3. Implement pairing payload schema and validator (`packages/mobile/src/pairing.ts`).
4. Implement `AgentClient` state machine (`packages/mobile/src/client.ts`) managing socket lifecycle, `hello` handshake, ping keepalive, and RTT measurement.
5. Implement React components: `PairingScreen.tsx`, `StatusScreen.tsx`, and root `App.tsx`.
6. Write integration and unit tests in `packages/mobile/src/mobile.test.ts`.
7. Verify architecture (`pnpm check-architecture`) and full verify (`pnpm verify`).

## 5. Out of scope (parked, not built)
- Terminal PTY streaming / terminal emulator (Phase 02 / F004-F005).
- System telemetry tiles (Phase 02 / F006).
- Claude Code bridge (Phase 03).

## 6. New dependencies (with justification)
- `react`, `react-native`, `expo`, `expo-secure-store` for Expo mobile runtime.

## 7. Risks
- Platform difference in WebSockets: React Native has global `WebSocket`. Tests running in Node environment can use standard `ws` or polyfilled `WebSocket`.
