# PROJECT STATE — MASTER FILE

> Read this first, every session. Rewrite it for a cold reader before you stop.

## Where we are
- **Phase**: Phase 04 — Voice (thin) (in progress)
- **Active feature**: F010 — Push-to-talk, on-device STT → chat (COMPLETE) -> F011 next
- **Overall progress**: 9 / 12 features COMPLETE (75%)

## Last verified
- **Date**: 2026-10-08
- **F010 Verification**:
  - `@shellmind/mobile`:
    - Defined `ISpeechToTextProvider` interface in `packages/mobile/src/voice/types.ts`.
    - Implemented `MockSpeechToTextProvider` with fixture text, interim results streaming, permission controls, and cancel handling.
    - Implemented `NativeSpeechToTextProvider` with platform iOS detection and safe runtime fallback.
    - Implemented `getSpeechToTextProvider`, `setSpeechToTextProvider`, `resetSpeechToTextProvider` in `packages/mobile/src/voice/registry.ts`.
    - Integrated push-to-talk mic button (`mic-button`), active recording indicator (`recording-indicator`), editable prompt populating, and permission denial banner (`voice-error-banner`) into `ChatScreen.tsx`.
    - 39/39 mobile tests passing.
    - Maestro flow in `.maestro/voice_stt_flow.yaml` and trace in `.harness/evidence/F010/e2e-trace.txt`.
  - 120/120 tests passing monorepo-wide (`pnpm test`).
  - Clean architecture verified with `dependency-cruiser` (`pnpm check-architecture`, 75 modules, 220 dependencies cruised, 0 violations).
  - Full suite verified clean (`pnpm verify`).
- **Git**: branch `feat/F010`

## Next step
Merge PR #11 for F010. Advance to F011 (`On-device TTS spoken replies`).

## Open blockers
See `BLOCKERS.md`. None open.

## Notes for the next agent
- Pure core rule: `packages/protocol` and `packages/agent/src/core` must not import Node builtins or I/O.
- PTY adapter lives exclusively in `packages/agent/src/adapters/pty/`.
- Mobile imports only `@shellmind/protocol`, never `@shellmind/agent`.
- Run `./scripts/init.sh` at the start of any session.
