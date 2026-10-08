# CURRENT TASK

**Feature**: F002 — Agent daemon + tailnet transport + device-token auth
**Phase**: Phase 01 — Foundation (prove the pipe)
**Status**: IN PROGRESS

## Exact next step
1. In `packages/agent`:
   - Implement `Transport` interface in `src/core/transport.ts` (per `MODULES.md`).
   - Implement Tailscale interface detector & binder in `src/adapters/transport/tailnet.ts`.
   - Implement device-token auth handshake (`hello` -> `hello.ack` / `hello.reject`) and device registry (`src/adapters/storage/device-registry.ts` with hashed tokens and 0600 file permissions).
   - Wire `shellmind` CLI daemon commands (`pair`, `devices`, `dev`).
2. Integration tests driving a real tailnet/localhost socket handshake: valid token -> `hello.ack` + `pong`; invalid/missing/revoked token -> `hello.reject` + connection closed.
3. Obey layer boundaries: `check-architecture` passes (`src/core` contains no I/O; adapters hold side-effects).

## Acceptance (summary)
See `phases/PHASE-01-FOUNDATION.md` for full criteria.

## Definition of done
Agent daemon binds tailnet interface only, rejects missing/invalid/revoked device tokens with clean rejection, persists paired hashed tokens, full test suite and `check-architecture` green, PR reviewed clean.
