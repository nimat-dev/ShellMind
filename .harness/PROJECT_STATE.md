# PROJECT STATE — MASTER FILE

> Read this first, every session. Rewrite it for a cold reader before you stop.

## Where we are
- **Phase**: Phase 01 — Foundation (prove the pipe)
- **Active feature**: F002 — Agent daemon + tailnet transport + device-token auth (COMPLETE, PR review & merge pending)
- **Overall progress**: 3 / 12 features COMPLETE (25%)

## Last verified
- **Date**: 2026-10-07
- **F002 Verification**:
  - `@shellmind/protocol`: Added `hello`, `hello.ack`, `hello.reject` messages and schemas; registered in MessageRegistry.
  - `@shellmind/agent`:
    - Defined `Transport`, `TransportConnection`, `TransportListener` in `src/core/transport.ts`.
    - Defined `IDeviceRegistry`, `PairedDevice` in `src/core/device.ts`.
    - Implemented `AgentDaemon` with `MessageHandler` registry in `src/core/daemon.ts` (pure core, no Node I/O imports).
    - Implemented `TailnetTransportServer` in `src/adapters/transport/tailnet.ts` (refuses `0.0.0.0`, detects Tailscale CGNAT IPs `100.64.0.0/10`).
    - Implemented `FileDeviceRegistry` in `src/adapters/storage/device-registry.ts` (SHA-256 hashed tokens, 0600 file permissions, raw tokens never written to disk).
    - Implemented `shellmind` CLI (`pair`, `devices`, `revoke`, `dev`, `status`) in `src/cli.ts`.
  - 25/25 unit & integration tests passing (`pnpm test`).
  - Architecture verified clean with `dependency-cruiser` (`pnpm check-architecture`).
  - Full suite verified clean (`pnpm verify`).
- **Git**: branch `feat/F002`

## Next step
Merge PR for F002, then begin F003: Mobile skeleton + QR pairing + connect + status on `feat/F003`.

## Open blockers
See `BLOCKERS.md`. None open.

## Notes for the next agent
- Pure core rule: `packages/protocol` must not import Node builtins or I/O.
- Agent rule: `packages/agent/src/core` must not import Node builtins or I/O; concrete socket/file I/O belongs in `packages/agent/src/adapters`.
- Run `./scripts/init.sh` at the start of any session.
