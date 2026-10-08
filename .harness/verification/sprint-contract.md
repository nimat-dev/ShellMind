# Sprint Contract — F010: Push-to-talk, on-device STT → chat

Feature: F010 — Push-to-talk, on-device STT → chat
Phase: Phase 04 — Voice (thin)
Date: 2026-10-08

## 1. Scope & Acceptance Criteria
- [x] Speech-to-Text provider abstraction in `packages/mobile/src/voice/`:
  - `ISpeechToTextProvider` interface in `types.ts` with `isAvailable()`, `requestPermission()`, `startRecording()`, `stopRecording()`, `cancelRecording()`, `isRecording()`.
  - `MockSpeechToTextProvider` in `mock.ts` supporting fixture text, error simulation, and permission control.
  - `NativeSpeechToTextProvider` in `native.ts` safely interfacing with platform speech recognition with graceful fallback.
  - Provider registry in `registry.ts` with `getSpeechToTextProvider()` and `setSpeechToTextProvider()`.
- [x] UI integration in `ChatScreen.tsx`:
  - Push-to-talk microphone button (`testID="mic-button"`).
  - Listening / active recording indicator (`testID="recording-indicator"`).
  - Recognized transcript populates `chat-input-field` (visible and editable before send).
  - Cancel option clears current utterance without populating text.
  - Graceful mic permission denial handling (informative message, falls back to typing, no crash).
- [x] Edge cases covered (from `verification/edge-cases.md`):
  - Silence / no speech: returns empty string cleanly without crashing or blocking UI.
  - Very long utterance: caps gracefully.
  - Release-to-stop / rapid tap: handles quick taps without race conditions.
  - Cancel mid-capture: discards audio buffer without side effects.
  - Permission denied: falls back to typing seamlessly.
- [x] Architecture boundaries: mobile voice modules stay in `packages/mobile`; pure core untouched; zero violations in `check-architecture.sh`.
- [x] Full verification suite passing (`pnpm verify`).

## 2. Edge cases & failure paths (from `verification/edge-cases.md`)
- Silence / empty utterance: returns empty string without error.
- Permission denied: informs user and falls back to typing.
- Speech recognizer unavailable: graceful fallback to standard typing input.
- Cancel mid-utterance: stops recording and leaves input untouched.
- Rapid press/release: prevents overlapping audio sessions.

## 3. E2E scenario(s)
1. User taps mic button in ChatScreen: recording starts, indicator displays listening state.
2. User speaks: interim / final transcript is generated.
3. User stops recording: recognized transcript populates input field.
4. User taps Send: prompt is dispatched to agent as normal chat turn.

## 4. Plan (thinnest vertical slice)
1. STT provider types and registry in `packages/mobile/src/voice/`.
2. Mock and Native STT implementations.
3. Integrate push-to-talk button and recording indicator into `ChatScreen.tsx`.
4. Tests in `packages/mobile/src/mobile.test.ts`.
5. Maestro flow `.maestro/voice_stt_flow.yaml`.
6. Full verification (`pnpm verify`) and PR merge.
