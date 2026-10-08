# PROJECT STATE — MASTER FILE

> Read this first, every session. Rewrite it for a cold reader before you stop.

## Where we are
- **Phase**: Phase 04 — Voice (thin) (COMPLETE)
- **Active feature**: F011 — On-device TTS spoken replies (COMPLETE)
- **Overall progress**: 12 / 12 features COMPLETE (100%) — V1 FULLY FEATURE-COMPLETE!

## Last verified
- **Date**: 2026-10-08
- **F011 Verification**:
  - `@shellmind/mobile`:
    - Defined `ITextToSpeechProvider` interface and `TTSOptions` in `packages/mobile/src/voice/tts-types.ts`.
    - Implemented `extractSpokenSummary` in `packages/mobile/src/voice/summary.ts` with markdown stripping, code block omission, link normalization, leaked tool JSON removal, and sentence boundary capping (strictly `<= maxChars`).
    - Implemented `MockTextToSpeechProvider` with configurable delay, speech history tracking, autocomplete, and error/availability simulation.
    - Implemented `NativeTextToSpeechProvider` bridging platform iOS / web synthesis with safe fallback.
    - Implemented `getTextToSpeechProvider`, `setTextToSpeechProvider`, `resetTextToSpeechProvider` in `packages/mobile/src/voice/registry.ts`.
    - Integrated persistent spoken replies toggle (`tts-toggle`), active speaking indicator (`speaking-indicator`), mute/interrupt button (`tts-stop-button`), auto-summarization on assistant turn completion, and instant interruption on prompt send, voice recording, or manual mute into `ChatScreen.tsx`.
    - 41/41 mobile tests passing (130/130 monorepo-wide).
    - Maestro flow in `.maestro/voice_tts_flow.yaml` and trace in `.harness/evidence/F011/e2e-trace.txt`.
  - 130/130 tests passing monorepo-wide (`pnpm test`).
  - Clean architecture verified with `dependency-cruiser` (`pnpm check-architecture`, 79 modules, 229 dependencies cruised, 0 violations).
  - Full suite verified clean (`pnpm verify`).
- **Git**: branch `feat/F011`

## Next step
Merge PR #12 for F011. Run final clean-state check and tag V1 release.

## Open blockers
See `BLOCKERS.md`. None open.

## Notes for the next agent
- Pure core rule: `packages/protocol` and `packages/agent/src/core` must not import Node builtins or I/O.
- PTY adapter lives exclusively in `packages/agent/src/adapters/pty/`.
- Mobile imports only `@shellmind/protocol`, never `@shellmind/agent`.
- Run `./scripts/init.sh` at the start of any session.
