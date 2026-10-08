# DATA MODEL

Light by archetype — **no central/server database**. State is a small local device registry on
the agent plus ephemeral session state. Types live in `@shellmind/protocol`; persistence is an
agent adapter.

## Id prefixes (per `rules/conventions.md`)
- `dev_` — a paired device (phone)
- `ses_` — a connection session
- `msg_` — a protocol message / chat turn
Opaque, immutable once assigned, identical in logs/wire/storage.

## Entities

### Device (persisted on agent, local file, mode 0600)
- `id: dev_…`
- `name` — human label ("Nimat's iPhone")
- `platform` — ios (V1 iOS-only; field kept for the deferred Android/C-trajectory)
- `tokenHash` — hash of the pairing token (**never** store the token itself)
- `pubkeyFingerprint` — for the pairing short-auth check
- `pairedAt`, `lastSeenAt`
- **Invariants:** token stored only as a hash; a device is revocable (`shellmind devices`);
  revoked ⇒ all its sessions refused.

### Session (ephemeral, in-memory on agent)
- `id: ses_…`, `deviceId: dev_…`
- `mode` — `terminal | agent`
- `projectCwd` — for agent mode; phone-switchable; must be an existing directory the user owns
- `startedAt`
- **Invariants:** exactly one owning paired device; terminal and agent modes are isolated;
  `projectCwd` validated before use.

### Transcript (optional persistence, F009 — session continuity)
- `sessionKey` (stable per device+project), ordered `msg_…` turns (role, text, tool events)
- **Invariants:** stored locally only; truncation/size cap; reconnect resumes from it.

## Audit log (append-only, agent-local — security-critical, F008)
- One line per executed command / approved tool call: `ts`, `deviceId`, `sessionId`, `mode`,
  the command/tool, the permission decision (`auto-allow | approved | denied`), exit/result.
- **Invariants:** append-only; written **before** a dangerous command runs; never silently
  truncated. This is the record that makes remote shell access accountable.
