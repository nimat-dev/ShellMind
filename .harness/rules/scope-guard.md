# Scope Guard

What is **off-limits right now**. The active phase is whatever `PROJECT_STATE.md` says. Building
ahead is a defect, not initiative. Phases are gated in ROADMAP order; a phase's features may not
start until the previous phase's completion criteria pass.

## Current phase: Phase 00 — De-risk

### In scope (current phase only)
- **F000** — spike: prove headless Claude Code runs on the subscription (no API key) and its
  permission prompt can be intercepted + answered programmatically. Throwaway code; findings →
  `DECISIONS.md` + an ADR.

### Off-limits until their phase (do NOT build now)
- **Phase 01 — Foundation:** monorepo, `protocol` core, agent transport + device-token auth,
  mobile pairing/connect/online status. (F001–F003)
- **Phase 02 — Terminal & telemetry:** PTY streaming, mobile terminal UI, system-info tiles.
  (F004–F006)
- **Phase 03 — AI (Claude bridge):** Claude driver, permission bridge + confirm UI + audit log,
  chat UI + session continuity + project switching. (F007–F009)
- **Phase 04 — Voice (thin):** push-to-talk on-device STT→chat, TTS replies. (F010–F011)

### Off-limits for all of V1 (design-for only — never build yet)
- Multiple computers / a machine home-screen list.
- Proactive notifications / push (APNs/FCM) / agent-side watchers.
- Screen capture / visual computer control.
- A hosted relay or our own embedded WireGuard (V1 rides the user's Tailscale).
- **Android** — V1 mobile is **iOS only**. (Design the RN/Expo code portably, but don't build,
  test, or ship Android; on-device speech uses iOS-native APIs in V1.)
- Windows (agent) support.
- A cloud backend, API keys, or per-token billing (the brain is the local subscription).

## Rules of the guard
1. Tempted outside the current phase? Stop. Park it in `BLOCKERS.md` / `ROADMAP.md`; stay on the
   active feature.
2. No dependency unless the active feature needs it — justify new deps in the sprint contract.
3. Design *for* later phases (stable ids, registries, the transport interface) but *build* only
   the current phase.
4. Scope wrong? Propose an edit to this file + `ROADMAP.md`; record it in `DECISIONS.md`. Don't
   silently expand.
5. Don't skip a phase's completion criteria. Phase 00 specifically gates Phase 03's design: if
   the spike disproves the thesis, re-plan before building the bridge.

## Why so strict
The whole product rests on the Phase 00 thesis and a pure `protocol` core. Get those right before
stacking terminal, AI, and voice on top.
