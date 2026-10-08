# PRODUCT — the vision

## One line
**ShellMind** — Claude Code on your machine, with a mobile head + voice, reachable from your
phone over your private mesh. *"Talk to your computer from anywhere."*

## The problem
Developers leave their desk but the work doesn't stop: a build is running, tests are flaky, a
server is misbehaving, "did it deploy?" SSH apps on a phone are a cramped desktop terminal
squeezed onto glass — fine for one command, miserable for real work, and they give you a raw
shell, not help.

## The core idea
Your machine already has the smartest shell there is: **Claude Code**, logged in on your
subscription. ShellMind does **not** reimplement an AI agent, a tool runtime, or a permission
system — it **bridges your phone to the Claude Code already on your machine**, and adds the two
things a phone is actually good at: a **mobile-native terminal** and **voice**. The desktop
agent is a thin, auditable executor; the brain is the subscription you already pay for; the
transport is your own Tailscale mesh.

## What V1 is
One paired computer, an **iOS** phone, three capabilities:
- **Terminal** — a real PTY, but a mobile-native UI (accessory keys, scrollback, history), not a
  shrunk desktop terminal.
- **AI** — ask in natural language; the local Claude Code investigates with its own tools
  (`Bash`/`Read`/`LS`/…); its permission prompts surface on your phone as **allow/deny cards**;
  every command is audit-logged.
- **Voice (thin)** — push-to-talk, on-device speech-to-text → a chat turn; spoken replies.

## Why it's different
- Not an SSH client (Product A) and not "yet another API-key AI wrapper." It's **your
  subscription's Claude, in your pocket**, with a permission model you can trust because the
  human is in the loop on every write.
- No API key, no per-token billing, no cloud backend holding your secrets. The brain runs
  locally under your login; the mesh is yours; the agent runs as you, never root.

## The north star (design for, don't build in V1)
Product C — a personal computer agent that's *always available*: multiple machines, proactive
notifications ("build failed", "CPU > 90%"), "continue what I was doing", eventually screen
understanding. V1 earns the right to build these by proving the core loop first.

## The thesis that must hold (de-risked in Phase 00)
Headless Claude Code (`claude -p --output-format stream-json`) runs under subscription auth
(no API key) and its permission prompts can be intercepted and answered programmatically. If
this fails, the product pivots — so we prove it before anything else.
