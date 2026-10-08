# PROJECT STATE — MASTER FILE

> Read this first, every session. Rewrite it for a cold reader before you stop.

## Where we are
- **Phase**: Phase 00 — De-risk
- **Active feature**: F000 — Claude Code headless spike (IN PROGRESS)
- **Overall progress**: 0 / 12 features COMPLETE (0%)

## Last verified
- **Date**: 2026-10-07
- **init**: N/A — no monorepo yet (F001 creates `init`); nothing to build in Phase 00
- **Full suite + check-architecture**: N/A until F001
- **E2E**: N/A
- **Git**: harness filled on branch `chore/harness-scaffold`; no app code yet

## Next step
Start F000: in a throwaway `spike/` dir, run `claude -p "<prompt>" --output-format stream-json`
with **no `ANTHROPIC_API_KEY`** and confirm it uses the subscription; capture the JSONL. Then
prove a permission prompt can be intercepted + answered programmatically (via
`--permission-prompt-tool` / hooks). Write findings to an ADR + `DECISIONS.md`. See
`phases/PHASE-00-DERISK.md` acceptance.

## Open blockers
See `BLOCKERS.md`. None open. (F000 itself de-risks the product's core assumption — if it fails,
open a blocker and re-plan Phase 03 before building.)

## Notes for the next agent
- Product: ShellMind = local Claude Code + mobile head + voice over Tailscale. See `product/`.
- Decisions locked in `DECISIONS.md`: Tailscale transport, TS monorepo, drive local Claude Code
  CLI on subscription, iOS-only mobile, macOS+Linux agent, `npm i -g` + user service.
- V1 is iOS only; agent is macOS + Linux. Android/Windows deferred (`rules/scope-guard.md`).
- Phase 00 is a spike — throwaway code, do NOT wire it into a package. F001 builds the real monorepo.
