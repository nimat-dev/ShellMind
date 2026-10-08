# Maker-Checker Review: F011 (On-device TTS spoken replies)

## 1. Acceptance Criteria Verification
- [x] On-device TTS provider abstraction `ITextToSpeechProvider` defined in `packages/mobile/src/voice/tts-types.ts`.
- [x] Mock provider `MockTextToSpeechProvider` supports deterministic test fixtures, history tracking, autocomplete, and error/availability simulation.
- [x] Native provider `NativeTextToSpeechProvider` bridges platform synthesizers with graceful fallback.
- [x] Summary extractor `extractSpokenSummary` cleans markdown, code fences, and tool JSON, capping to concise sentences `<= maxChars`.
- [x] Provider registry in `packages/mobile/src/voice/registry.ts` supports runtime swapping (`getTextToSpeechProvider`, `setTextToSpeechProvider`, `resetTextToSpeechProvider`).
- [x] Spoken replies toggle (`testID="tts-toggle"`), active speaking indicator (`testID="speaking-indicator"`), and mute button (`testID="tts-stop-button"`) implemented in `ChatScreen.tsx`.
- [x] Turn completion triggers spoken reply when toggle is active; remains completely silent when toggle is inactive.
- [x] Active speech is immediately interrupted upon prompt submission, voice recording start, abort, or manual stop.
- [x] Rapid turns do not overlap (prior utterance terminated before subsequent utterance starts).
- [x] 130/130 tests pass across all packages (41 mobile tests).
- [x] Dependency cruiser reports 0 violations across 79 modules.
- [x] Pure core invariant preserved: voice TTS is mobile-only; protocol and agent remain pure and audio-agnostic.
- [x] Maestro E2E specification in `.maestro/voice_tts_flow.yaml`.
- [x] Harness docs and evidence logged in `.harness/evidence/F011/`.

## 2. Evaluation Scores
- **Acceptance**: 5/5
- **Correctness**: 5/5
- **Boundaries**: 5/5
- **Modularity**: 5/5
- **Evidence**: 5/5
- **Average**: 5.0 (PASS)

## 3. Decision
APPROVE. Ready for squash merge to `main`.
