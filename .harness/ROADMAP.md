# ROADMAP

All features across all phases, with permanent ids and status. Source of truth for **scope**.
Statuses: `NOT STARTED` · `IN PROGRESS` · `BLOCKED` · `IN REVIEW` · `COMPLETE` · `DEPRECATED`.
Keep exactly one feature `IN PROGRESS`. Full acceptance criteria live in each `phases/PHASE-XX-*.md`.

**Progress**: 9 / 12 COMPLETE (75%)

## Phase 00 — De-risk
- [x] **F000** — spike: headless Claude Code on subscription (no key) + interceptable permission prompt — `COMPLETE`

## Phase 01 — Foundation (prove the pipe)
- [x] **F001** — pnpm monorepo + `@shellmind/protocol` pure core (envelope + zod + ping/pong) + `init`/`check-architecture` scripts — `COMPLETE`
- [x] **F002** — agent daemon + tailnet transport server + device-token auth handshake — `COMPLETE`
- [x] **F003** — Expo mobile skeleton + QR pairing + connect + Online/Offline status — `COMPLETE`

## Phase 02 — Terminal & telemetry
- [x] **F004** — PTY in agent (node-pty): stream output, input, resize, exit — `COMPLETE`
- [x] **F005** — mobile terminal UI (emulator + accessory keys + scrollback + history) — `COMPLETE`
- [x] **F006** — system-info tiles (CPU / memory / disk) — `COMPLETE`

## Phase 03 — AI (Claude Code bridge)
- [x] **F007** — Claude driver: spawn `claude -p` stream-json, parse → protocol, switchable project cwd — `COMPLETE`
- [x] **F008** — permission bridge + allow/deny confirm UI + allowlist + append-only audit log — `COMPLETE`
- [x] **F009** — chat UI (streaming) + session continuity (reconnect resumes) + project picker — `COMPLETE`

## Phase 04 — Voice (thin)
- [x] **F010** — push-to-talk, on-device STT → chat turn — `COMPLETE`
- [ ] **F011** — on-device TTS spoken replies (toggle) — `NOT STARTED`

## Deferred (design-for only — see `rules/scope-guard.md`)
Multi-computer · proactive notifications/push · screen capture/visual control · hosted relay or
embedded WireGuard · Windows · cloud backend / API keys. Not features yet; promote to a new phase
only after V1 ships.
