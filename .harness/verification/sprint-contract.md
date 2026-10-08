# Sprint Contract — F008: Permission bridge + confirm UI + allowlist + audit log

Feature: F008 — Permission bridge + confirm UI + allowlist + audit log
Phase: Phase 03 — AI (Claude Code bridge)
Date: 2026-10-08

## 1. Scope & Acceptance Criteria
- [x] Wire protocol messages in `@shellmind/protocol`:
  - `RiskHint` enum: `"low" | "medium" | "high"`.
  - `classifyRisk()` pure function: detects read-only operations ("low"), modifications ("medium"), and destructive/dangerous patterns ("high").
  - `isReadonlyCommand()` pure allowlist checker.
  - `perm.request`: Agent permission query (`requestId`, `toolName`, `command`, `input`, `cwd`, `riskHint`, `description`).
  - `perm.response`: Phone permission decision (`requestId`, `decision: "allow" | "deny"`, `rememberForSession?: boolean`).
- [x] Pure core interfaces in `@shellmind/agent`:
  - `IPermissionBridge`, `PermissionRequest`, `PermissionDecision` in `src/core/permission.ts`.
  - `IAuditLogger`, `AuditEntry` in `src/core/audit.ts`.
  - Pure core contains 0 Node builtins or I/O imports (`check-architecture.sh` enforced).
- [x] Concrete adapters in `@shellmind/agent`:
  - `PermissionBridge` in `src/adapters/permission/bridge.ts`:
    - Handles pending permission request promises.
    - Applies auto-allowlist for pure read-only commands without interrupting the human.
    - Manages session-scoped allowlist for "remember for session".
    - Enforces timeout (e.g. 60s -> default deny).
    - Idempotent resolution (double-tap safe).
    - `denyAllPending()` on disconnect, abort, or device revocation.
  - `FileAuditLogger` in `src/adapters/audit/file-audit.ts`:
    - Append-only file logger written **before** execution of any approved tool/command.
    - Stores `ts`, `deviceId`, `sessionId`, `toolName`, `command`, `decision`, `riskHint`.
    - Never truncated.
  - Integration with `LocalClaudeDriver` and `AgentDaemon`:
    - Hooks into Claude Code's control requests (`can_use_tool`).
    - Dispatches `perm.request` over the wire.
- [x] Mobile client & UI in `@shellmind/mobile`:
  - `AgentClient` methods: `onPermissionRequest()`, `respondPermission()`.
  - `PermissionCard.tsx` React Native component:
    - Displays tool name, command / input, cwd, and risk hint pill (Green for LOW, Amber for MEDIUM, Red for HIGH).
    - Allow / Deny buttons and "Remember for session" checkbox.
- [x] Edge cases covered (from `verification/edge-cases.md`):
  - Chained / obfuscated commands (`a && rm -rf`, `$(...)`, aliases) -> flagged HIGH risk.
  - Timeout -> treated as deny.
  - Client disconnects mid-prompt -> all pending prompts denied + turn aborted.
  - Double-tap allow -> idempotent.
  - "Remember for session" -> scoped to session only, resets on next connection.
  - Revoked device mid-session -> all pending prompts denied immediately.
  - Audit log -> append-only, never truncated, written before execution.
- [x] Architecture boundaries: pure core contains 0 I/O; `check-architecture.sh` reports 0 violations.
- [x] Full verification suite passing (`pnpm verify`).

## 2. Edge cases & failure paths (from `verification/edge-cases.md`)
- Command chaining with dangerous operations (`echo hi && rm -rf /`) -> classifier marks HIGH risk.
- Permission request timeout -> automatically resolved to "deny".
- Disconnect during pending permission -> all pending requests rejected, child process killed.
- Duplicate `perm.response` -> second response ignored gracefully (idempotent).
- Audit log write failure -> surfaces error, does not run tool without audit record.
- Device revocation while permission pending -> denies pending immediately.

## 3. E2E scenario(s)
1. Claude Code turn triggers tool use requiring permission.
2. Agent evaluates allowlist:
   - If read-only command in allowlist -> auto-approved and audited.
   - If write/destructive -> routes `perm.request` to mobile.
3. Mobile renders `PermissionCard` with tool, command, and RiskHint badge.
4. User taps "Allow" (or "Deny") -> `perm.response` sent to agent.
5. Agent records to append-only audit log before releasing tool to execute.
6. Mobile receives stream output.

## 4. Plan (thinnest vertical slice)
1. Protocol schemas in `packages/protocol/src/messages/permission.ts` & risk classifier.
2. Core interfaces in `packages/agent/src/core/permission.ts` and `src/core/audit.ts`.
3. Adapters in `packages/agent/src/adapters/permission/bridge.ts` and `src/adapters/audit/file-audit.ts`.
4. Integration with `LocalClaudeDriver` and `AgentDaemon`.
5. Mobile client methods in `packages/mobile/src/client.ts` and `PermissionCard.tsx` UI.
6. Comprehensive test battery (protocol, driver, daemon, mobile).
7. Maestro flow in `.maestro/permission_flow.yaml`.
8. Full verification (`pnpm verify`) and PR review/merge.
