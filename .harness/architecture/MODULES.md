# MODULES — the extension points

Registries/interfaces that new variants register against instead of editing the core. This is
what evaluator-rubric criterion 4 (modularity) and the "registries, not switches" rule in
`layer-boundaries.md` check against.

## 1. Message-handler registry (agent core)
- **Interface:** `MessageHandler = (msg, ctx) => void | Promise<void>`, keyed by protocol message
  `type`.
- **Rule:** the agent dispatches by looking up the registry — no growing `switch` over message
  types. A new message type = register a handler, don't edit the dispatcher.

## 2. Transport provider registry (agent + mobile)
- **Interface:** `Transport` — `listen/connect`, `send(frame)`, `onFrame`, `close`, plus the
  device-token auth handshake. V1 impl: `tailnet` (TCP/WS over the WireGuard interface).
- **Rule:** core imports the `Transport` interface only. Future `relay` / `p2p` impls register
  here; nothing in core knows which is live. Enables the deferred multi-computer + relay work.

## 3. Permission-rule registry (protocol, pure)
- **Interface:** ordered rules mapping a proposed command/tool to a `RiskHint`
  (`safe | confirm | dangerous`). Pure, data-driven, unit-testable.
- **Rule:** the hint is a **UX signal only**; the actual gate is the human allow/deny on the
  phone (see `PRODUCT.md` / `layer-boundaries.md`). New patterns = add a rule, not a code branch.

## 4. STT / TTS provider registry (mobile)
- **Interface:** `SpeechToText` / `TextToSpeech`. V1 impl: on-device native (expo-speech for TTS;
  a dev-client STT module). Cloud providers can register later without touching the voice UI.

## 5. Tool-event renderer registry (mobile chat)
- **Interface:** `ToolEventRenderer` keyed by Claude tool name (`Bash`, `Read`, `LS`, …) → a chat
  card component. Unknown tools fall back to a generic renderer.
- **Rule:** supporting a new tool's display = register a renderer, don't edit the chat core.

## Smell test
If adding a feature forces an edit to the agent dispatcher, the transport core, the voice UI
core, or the chat core — the abstraction above is missing or wrong. Add/fix the registry.
