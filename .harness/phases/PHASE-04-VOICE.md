# Phase 04 — Voice (thin)

Hands-free, the natural phone interaction. Deliberately thin: push-to-talk → on-device speech →
a normal chat turn → spoken reply. Full-duplex conversation is a post-V1 idea. iOS only (V1).

## F010 — Push-to-talk, on-device STT → chat
**Status**: COMPLETE (PR #11)

### Acceptance criteria
- [x] Hold-to-talk control; **on-device** speech-to-text (iOS `SFSpeechRecognizer` via a dev-client
      native module, behind the `SpeechToText` registry in `MODULES.md`) — no audio leaves the
      phone, works offline where iOS supports it.
- [x] The transcript is injected as a normal `agent.prompt` turn (reuses the F009 chat path); the
      recognized text is shown + editable before send.
- [x] Mic permission requested with a clear prompt; denial handled gracefully.
- [x] Edge/error cases: silence/no speech, very long utterance, release-to-stop, cancel mid-capture,
      permission denied, recognizer unavailable → fall back to typing (not a crash).
- [x] E2E (Maestro, iOS): drive the STT module with a fixture → recognized text becomes a chat turn
      → agent answers. Trace under `.harness/evidence/F010/`.
- [x] Boundary invariants: STT behind the provider interface; chat path via protocol;
      `check-architecture` passes.
- [x] Verification: full verify + e2e green, no regressions.

## F011 — On-device TTS spoken replies
**Status**: NOT STARTED

### Acceptance criteria
- [ ] Assistant replies can be spoken via on-device TTS (iOS `AVSpeechSynthesizer` / `expo-speech`,
      behind the `TextToSpeech` registry); a persistent **toggle** controls it.
- [ ] Speaks a concise summary of the turn, not raw tool output; interruptible (new turn stops the
      current speech).
- [ ] Edge/error cases: toggle off = silent; very long reply (summarize/cap); rapid turns don't
      overlap; silent mode / headphones respected.
- [ ] E2E (Maestro, iOS): toggle on → a reply is spoken (assert TTS invoked); toggle off → silent.
      Trace under `.harness/evidence/F011/`.
- [ ] Boundary invariants: TTS behind the provider interface; `check-architecture` passes.
- [ ] Verification: full verify + e2e green, no regressions.

## Phase completion criteria
You can ask by voice and hear the answer, hands-free, on iOS; full suite + e2e green;
check-architecture clean. V1 is feature-complete — run the clean-state checklist and tag it.
