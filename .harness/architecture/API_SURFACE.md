# API SURFACE

Not HTTP. Two contracts: the **wire protocol** (phone ⇄ agent) and the **agent CLI**. The wire
protocol is defined once in `@shellmind/protocol` with a zod schema per message; both sides
validate on receive. Keep this file in sync in the same change that adds/changes a message
(`rules/conventions.md`).

## Transport framing
Framed JSON messages over a TCP/WebSocket stream on the tailnet interface, E2E-encrypted by
WireGuard. Every message shares an envelope: `{ v, type, id: msg_…, sessionId?, ts }`.

## Wire messages (V1 catalog)

### Connection / auth
- `hello` (phone→agent): device id + token proof + protocol version
- `hello.ack` / `hello.reject` (agent→phone): accepted (+ server info) or reason
- `ping` / `pong`: liveness + RTT

### Terminal mode
- `term.open` (phone→agent): request a PTY (shell, cols, rows)
- `term.data` (agent→phone): PTY output chunk
- `term.input` (phone→agent): keystrokes
- `term.resize` (phone→agent): cols/rows
- `term.exit` (agent→phone): shell exited (code)

### System info
- `sys.request` (phone→agent) / `sys.info` (agent→phone): cpu %, mem used/total, disk used/total

### AI (Claude Code bridge)
- `project.list` / `project.set` (phone↔agent): list allowed project dirs, switch `projectCwd`
- `agent.prompt` (phone→agent): a natural-language turn (text)
- `agent.stream` (agent→phone): streamed events — `assistant_text`, `tool_use`, `tool_result`,
  `done`, `aborted` (mirrors the parsed `claude -p` stream-json)
- `agent.abort` (phone→agent): cancel the current turn

### Permission bridge (security-critical)
- `perm.request` (agent→phone): a paused tool/command — command text, cwd, `RiskHint`
- `perm.response` (phone→agent): `allow | deny` (+ optional "remember for session")

### Errors
- `error` (either way): typed `{ code, message, sessionId? }` — never a silent failure

## Agent CLI (`shellmind`)
- `pair` — print a QR encoding { tailnet host/addr, one-time pairing token, pubkey fingerprint }
- `install` / `uninstall` — set up/remove the user service (launchd LaunchAgent / systemd --user)
- `start` / `stop` / `status` — control the running daemon
- `dev` — run in the foreground with verbose logs
- `devices` — list / revoke paired devices

## Deferred (not in V1 surface)
Multi-host routing, push-notification registration, screen-frame messages. Add as new message
families behind the registries in `MODULES.md`.
