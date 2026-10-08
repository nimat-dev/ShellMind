# CURRENT TASK

**Feature**: F003 — Mobile skeleton + QR pairing + connect + status
**Phase**: Phase 01 — Foundation (prove the pipe)
**Status**: NOT STARTED (F002 PR ready for review and merge)

## Exact next step
1. In `packages/mobile`:
   - Setup Expo project skeleton with TypeScript strict mode.
   - Implement pairing screen with QR scanner / manual token input.
   - Implement secure token storage (`expo-secure-store`).
   - Implement WebSocket connection to tailnet agent host with `hello` handshake and ping keepalive.
   - Display live Online / Offline status with RTT latency.
2. Write unit and Maestro E2E test flows.
3. Verify architecture and full test suite passes.

## Acceptance (summary)
See `phases/PHASE-01-FOUNDATION.md` for full criteria.

## Definition of done
Mobile client connects over tailnet to running agent daemon, completes handshake, displays Online status with ping RTT, gracefully handles disconnection/bad token.
