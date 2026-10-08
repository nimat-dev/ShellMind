# CURRENT TASK

**Feature**: F010 — Push-to-talk, on-device STT → chat
**Phase**: Phase 04 — Voice (thin)
**Status**: COMPLETE (Ready for PR & squash-merge)

## Summary of Accomplishments
1. Implemented on-device STT provider interface and implementations (`ISpeechToTextProvider`, `MockSpeechToTextProvider`, `NativeSpeechToTextProvider`, provider registry).
2. Integrated push-to-talk button, recording pulse indicator, interim transcript preview, cancellation, and permission denial banner in `ChatScreen.tsx`.
3. Injected speech transcripts into user-editable chat input field.
4. Added 7 unit/integration tests in `packages/mobile/src/mobile.test.ts`.
5. Created Maestro E2E test `.maestro/voice_stt_flow.yaml`.
6. Verified monorepo: 120/120 tests passing, 0 dependency violations.
7. Prepared review and PR artifacts (`.harness/reviews/F010-PR.md`, `.harness/reviews/F010-review.md`).
