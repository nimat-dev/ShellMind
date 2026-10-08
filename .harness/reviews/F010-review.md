# Maker-Checker Review: F010 (Push-to-talk, on-device STT → chat)

## 1. Acceptance Criteria Verification
- [x] On-device STT provider abstraction `ISpeechToTextProvider` defined in `packages/mobile/src/voice/types.ts`.
- [x] Mock provider `MockSpeechToTextProvider` supports deterministic test fixtures, interim streaming, permission overrides, and cancellation.
- [x] Native provider `NativeSpeechToTextProvider` bridges native speech recognizers with graceful fallback.
- [x] Provider registry in `packages/mobile/src/voice/registry.ts` supports runtime swapping.
- [x] Push-to-talk mic button (`testID="mic-button"`), recording indicator (`testID="recording-indicator"`), cancel button (`testID="voice-cancel-button"`), and error banner (`testID="voice-error-banner"`) implemented in `ChatScreen.tsx`.
- [x] Speech output populates `testID="chat-input-field"` allowing review and editing before dispatch.
- [x] Permission denial falls back cleanly to typing without application crashes.
- [x] 120/120 tests pass across all packages (39 mobile tests).
- [x] Dependency cruiser reports 0 violations across 75 modules.
- [x] Pure core invariant preserved: voice STT is mobile-only; protocol and agent remain audio-agnostic.
- [x] Maestro E2E specification in `.maestro/voice_stt_flow.yaml`.
- [x] Harness docs and evidence logged in `.harness/evidence/F010/`.

## 2. Evaluation Scores
- **Acceptance**: 5/5
- **Correctness**: 5/5
- **Boundaries**: 5/5
- **Modularity**: 5/5
- **Evidence**: 5/5
- **Average**: 5.0 (PASS)

## 3. Decision
APPROVE. Ready for squash merge to `main`.
