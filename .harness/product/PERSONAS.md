# PERSONAS — who it's for

V1 builds for **the developer away from their desk**. The other two are the C-trajectory; they
exist here to settle scope arguments, not to be built yet.

## 1. Dev-away-from-desk — the V1 target
- **Who:** a working developer on macOS/Linux with an **iPhone**, comfortable with terminal, git,
  docker, logs; runs Tailscale; pays for a Claude subscription.
- **Context:** stepped away — commuting, couch, another room — with a long-running task or a
  flaky service at the desk.
- **Job:** "from my phone, find out what my machine is doing and fix it, without a laptop." Ask
  "why is the build failing?", approve the fix, move on. Occasionally just run one command.
- **Why they adopt:** it's *their* Claude (no new bill), the permission cards make it safe to let
  it act, and the terminal finally doesn't suck on a phone.

## 2. DevOps / sysadmin — C-trajectory (not V1)
- Monitors/operates servers from a phone; wants proactive alerts and multi-host. Needs
  notifications + multi-computer (deferred). Keep their needs in mind for stable ids + the
  transport adapter, but **do not build** for them in V1.

## 3. Power user — C-trajectory (not V1)
- "My personal computer, always in my pocket." Broad, consumer-ish; voice-first. The north star
  UX, but too wide for a focused V1. Design-for only.

## Scope rule of thumb
If a feature serves persona 2 or 3 but not persona 1's core loop (pair → terminal/AI/voice on
one machine), it's deferred — park it in `BLOCKERS.md`/`ROADMAP.md`, don't build it.
