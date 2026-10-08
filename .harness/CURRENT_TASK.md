# CURRENT TASK

**Feature**: F011 — On-device TTS spoken replies (toggle)
**Phase**: Phase 04 — Voice (thin)
**Status**: COMPLETE (Ready for PR & squash-merge)

## Summary of Accomplishments
1. Implemented on-device TTS provider interfaces and implementations (`ITextToSpeechProvider`, `TTSOptions`, `MockTextToSpeechProvider`, `NativeTextToSpeechProvider`, provider registry).
2. Implemented `extractSpokenSummary` function stripping code fences, markdown tags, tool JSON artifacts, and capping output at sentence boundaries (strictly `<= maxChars`).
3. Integrated persistent spoken replies toggle (`testID="tts-toggle"`), active speaking indicator banner (`testID="speaking-indicator"`), and mute button (`testID="tts-stop-button"`) in `ChatScreen.tsx`.
4. Connected turn completion to auto-speak concise summary when toggle is ON, and silent when OFF.
5. Handled instant speech interruption across user prompt sends, voice recording begins, turn aborts, and manual mute.
6. Handled rapid turns without audio overlap.
7. Added 10 unit and integration tests in `packages/mobile/src/mobile.test.ts` (130/130 tests passing monorepo-wide).
8. Created Maestro E2E test `.maestro/voice_tts_flow.yaml`.
9. Verified monorepo: 130/130 tests passing, 0 dependency violations (79 modules cruised).
10. Prepared review and PR artifacts (`.harness/reviews/F011-PR.md`, `.harness/reviews/F011-review.md`).
