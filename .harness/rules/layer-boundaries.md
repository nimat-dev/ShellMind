# Layer Boundaries

Enforceable import rules behind `ARCHITECTURE.md`. Implemented with **dependency-cruiser**
(`scripts/check-architecture.sh`); a violation exits non-zero and blocks "done". These rules are
real as of Phase 00 — check-architecture is **no longer a no-op**.

## Allowed dependency direction
```
packages/mobile  ─┐
                  ├─►  packages/protocol   (PURE CORE — depends on nothing with I/O)
packages/agent   ─┘

within packages/agent:
  src/core  ─►  (adapter interfaces)  ◄─  src/adapters/{transport,pty,claude-driver,sysinfo}
  side effects live ONLY in src/adapters/**
```
`mobile` and `agent` never import each other. Their only shared code is `@shellmind/protocol`.

## The rules (each mechanically checkable)
1. **Pure core.** Nothing under `packages/protocol/**` may import: any node builtin
   (`fs`, `net`, `child_process`, `os`, `path`, …), `node-pty`, `ws`/socket libs, `react`/
   `react-native`/`expo*`, or any Anthropic/LLM SDK. Allowed deps: `zod` (and other pure,
   framework-free libs). Any such import is a violation.
2. **No sideways package imports.** `packages/mobile/**` must not import `packages/agent/**`,
   and `packages/agent/**` must not import `packages/mobile/**`. Cross-package goes through
   `@shellmind/protocol` only.
3. **Agent core is side-effect-free.** `packages/agent/src/core/**` must not import node builtins,
   `node-pty`, socket libs, or spawn processes directly. It depends on adapter *interfaces*; the
   concrete adapters under `packages/agent/src/adapters/**` hold the I/O.
4. **Transport is an interface.** Agent/mobile core import the `Transport` interface, never a
   concrete transport module directly (the `tailnet` impl lives under `adapters/transport/**` and
   registers itself — `MODULES.md`). Keeps relay/P2P swap-in a registration, not a rewrite.
5. **Registries, not switches.** Once a registry exists (message handlers, transports, permission
   rules, STT/TTS, tool renderers — `MODULES.md`), core code dispatches through it; a growing
   `switch` over the registry's key space is a violation.
6. **Mobile talks to the machine only via protocol.** No RN component issues shell/LLM calls or
   reaches a machine resource except by sending a `@shellmind/protocol` message.

## Not an import rule, but enforced in `init` (clean-state)
- **No hard-coded secrets/tokens.** A pairing token, key, or `.env` value literal in source is a
  clean-state red flag (secret scan in `init`), separate from dependency-cruiser.

## How to check
`scripts/check-architecture.sh` runs dependency-cruiser against `.dependency-cruiser.cjs`
encoding rules 1–6, exits non-zero with the offending `file → forbidden import → rule`. Runs in
`init`, in the verify node, and before any feature is marked passed.
