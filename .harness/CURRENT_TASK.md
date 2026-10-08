# CURRENT TASK

**Feature**: F008 — Permission bridge + confirm UI + allowlist + audit log
**Phase**: Phase 03 — AI (Claude Code bridge)
**Status**: COMPLETE (PR #9 ready)

## Exact next steps
1. **Protocol definitions (`packages/protocol`)**:
   - `RiskHint` enum: `"low" | "medium" | "high"`
   - `classifyRisk(toolName: string, input: Record<string, unknown>)`: pure risk classifier
   - `isReadonlyCommand(toolName: string, input: Record<string, unknown>)`: pure allowlist check
   - `perm.request` message (requestId, toolName, command, input, cwd, riskHint, description)
   - `perm.response` message (requestId, decision: "allow" | "deny", rememberForSession?: boolean)
2. **Pure core interfaces (`packages/agent/src/core`)**:
   - `IPermissionBridge`, `PermissionRequest`, `PermissionDecision` in `src/core/permission.ts`
   - `IAuditLogger`, `AuditEntry` in `src/core/audit.ts`
   - Zero Node builtins or I/O imports
3. **Permission & Audit Adapters (`packages/agent/src/adapters`)**:
   - `PermissionBridge` in `src/adapters/permission/bridge.ts` (manages pending requests, timeouts, session allowlist, auto-allow for safe reads)
   - `FileAuditLogger` in `src/adapters/audit/file-audit.ts` (append-only JSONL log, written before execution)
   - Wire permission interception into `LocalClaudeDriver` and `AgentDaemon`
4. **Mobile Client & UI (`packages/mobile`)**:
   - `onPermissionRequest`, `respondPermission` in `AgentClient`
   - `PermissionCard.tsx` React Native component with allow/deny actions and risk badge
   - Embedded into Terminal/Chat view
5. **Testing and Verification**:
   - Protocol tests for risk classification, allowlist, and message schemas
   - Bridge & AuditLogger unit tests (timeout, session remember, append-only file, idempotency)
   - AgentDaemon live socket integration tests
   - Mobile client integration tests
   - Maestro flow specification (`.maestro/permission_flow.yaml`)
   - Monorepo build, typecheck, lint, test, `check-architecture.sh`, `pnpm verify`
