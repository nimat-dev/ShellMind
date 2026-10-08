# Sprint Contract — F011: On-device TTS spoken replies

Feature: F011 — On-device TTS spoken replies (toggle)
Phase: Phase 04 — Voice (thin)
Date: 2026-10-08

## 1. Scope & Acceptance Criteria
- [x] Text-to-Speech provider abstraction in `packages/mobile/src/voice/`:
  - `ITextToSpeechProvider` interface with `isAvailable()`, `speak(text, options)`, `stop()`, `isSpeaking()`.
  - `TTSOptions` for rate, pitch, language, and lifecycle callbacks (`onStart`, `onDone`, `onError`).
  - `MockTextToSpeechProvider` supporting deterministic test fixtures, speaking state tracking, and simulated completion.
  - `NativeTextToSpeechProvider` safely interfacing with platform speech synthesis (`expo-speech` / `AVSpeechSynthesizer` / web speech fallback) with graceful fallback.
  - Provider registry in `registry.ts` with `getTextToSpeechProvider()`, `setTextToSpeechProvider()`, and `resetTextToSpeechProvider()`.
- [x] Concise summary extractor:
  - `extractSpokenSummary(text, maxChars)` strips markdown syntax, code fences, headers, tool traces, and caps speech to concise sentences (default 300 chars).
- [x] UI integration in `ChatScreen.tsx`:
  - Persistent spoken replies toggle (`testID="tts-toggle"`).
  - Speaking indicator (`testID="speaking-indicator"`).
  - Stop / Mute button (`testID="tts-stop-button"`).
  - When toggle is ON: assistant turn completion automatically speaks concise summary.
  - When toggle is OFF: speech is completely bypassed (silent).
  - Interruptibility: new turn arriving, prompt being sent, mic button being pressed, or stop button being tapped immediately cancels/stops speaking.
- [x] Edge cases covered (from `verification/edge-cases.md`):
  - Toggle off: silent, no provider invocation.
  - Very long reply: summarized and capped to prevent runaway speech.
  - Rapid turns: previous utterance immediately aborted before new utterance starts (no audio overlap).
  - Empty or tool-only turn: cleanly omitted or safely handled without awkward silence.
  - Provider error / unavailable: fails gracefully without interrupting UI flow or throwing unhandled errors.
- [x] Architecture boundaries: mobile voice modules stay in `packages/mobile`; pure core untouched; zero violations in `check-architecture.sh`.
- [x] Full verification suite passing (`pnpm verify`).

## 2. Edge cases & failure paths (from `verification/edge-cases.md`)
- TTS toggle off: zero speech output.
- Excessive length: summarized and capped to ~300 chars.
- Overlapping turns: previous speech stopped immediately upon new turn.
- User interruption: tap mic / send / stop halts active playback immediately.
- Synthesizer error: caught and handled without UI crash.

## 3. E2E scenario(s)
1. User enables TTS toggle in ChatScreen (`testID="tts-toggle"`).
2. Agent completes assistant turn response.
3. ChatScreen extracts concise summary and calls TTS provider (`isSpeaking` becomes true, `speaking-indicator` visible).
4. Audio completes or user taps stop (`testID="tts-stop-button"`), returning to idle.
5. User disables TTS toggle: subsequent turns remain silent.

## 4. Plan (thinnest vertical slice)
1. TTS types (`tts-types.ts`), summary extractor (`summary.ts`), mock provider (`mock-tts.ts`), native provider (`native-tts.ts`), and registry extensions (`registry.ts`).
2. Integrate TTS toggle, speaking state, and auto-speak on turn completion into `ChatScreen.tsx`.
3. Unit and integration tests in `packages/mobile/src/mobile.test.ts`.
4. Maestro E2E specification `.maestro/voice_tts_flow.yaml`.
5. Monorepo verification (`pnpm verify`).
