# ARCHITECTURE

Archetype: full-stack app (A in `ARCHETYPES.md`), adapted to a **phone ⇄ daemon** distributed
system with a pure shared core. There is no server/DB tier and no cloud backend in V1.

## Shape
```
┌─────────────────────────┐        WireGuard (Tailscale)        ┌──────────────────────────┐
│   mobile (React Native) │  ◄── framed JSON over TCP/WS ──►    │   agent (Node daemon)     │
│                         │        + device-token auth          │                           │
│  terminal · chat ·      │                                     │  core ── adapters:        │
│  voice · allow/deny     │                                     │   transport · pty ·       │
└──────────┬──────────────┘                                     │   claude-driver · sysinfo │
           │                                                    └──────────┬────────────────┘
           └──────────────── both depend only on ──────────────────────────┘
                              @shellmind/protocol  (PURE CORE)
                                                                           │ spawns
                                                                 ┌─────────▼──────────┐
                                                                 │  claude -p (local,  │
                                                                 │  subscription)      │
                                                                 └────────────────────┘
```

## Packages (pnpm workspace monorepo)
- **`packages/protocol` — the pure core.** TypeScript + zod only. Owns: every wire message schema
  and its envelope; session + permission-prompt state types and reducers; the risk-hint classifier
  (pure function, UX hint only — see `rules/layer-boundaries.md` and `PRODUCT.md`); id helpers.
  **Depends on nothing** with I/O — no node builtins, no socket/pty/LLM, no React. This is the
  single definition both sides agree on.
- **`packages/agent` — the desktop daemon (Node).** `src/core/**` is the message-handling +
  session logic, written against adapter *interfaces*; `src/adapters/**` holds all side effects:
  - `transport/` — tailnet socket server, device-token handshake (swappable; relay/P2P later)
  - `pty/` — `node-pty` shell for terminal mode
  - `claude-driver/` — spawns `claude -p --output-format stream-json`, parses the JSONL stream,
    routes permission prompts back over transport, scoped to a switchable project cwd
  - `sysinfo/` — CPU/mem/disk
  Plus the `shellmind` CLI (`pair`/`install`/`start|stop|status`/`dev`/`devices`). Runs as the
  logged-in user, never root.
- **`packages/mobile` — the app (Expo / React Native, iOS only in V1).** Transport client, terminal view
  (xterm.js in a WebView is the likely V1 choice — decided in F005), chat/stream view, push-to-talk
  (on-device STT) + TTS, pairing (QR scan), allow/deny cards, project picker. Talks to the machine
  **only** through `@shellmind/protocol` messages.

## Runtime topology
Single user, single machine in V1. Agent is a user-level service (launchd LaunchAgent / systemd
`--user`), reachable only on the tailnet, and only to a device holding a valid paired token.
Transcripts may be persisted locally on the agent for session continuity (F009); nothing leaves
the machine except over the user's own mesh to the user's own phone.

## The one boundary that matters
`@shellmind/protocol` is pure and shared. Every leak of node/socket/pty/LLM/React into it, or any
direct mobile↔agent import, forks the contract — `check-architecture` fails the build on it.

## Deferred (design-for only)
Multi-computer (N transports + a home screen), proactive notifications (APNs/FCM + agent
watchers), screen capture, a hosted relay / embedded WireGuard, Android, Windows. Stable ids + the
transport/provider registries (`MODULES.md`) exist so these slot in without a core rewrite.
