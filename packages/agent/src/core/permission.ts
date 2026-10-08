import type { RiskHint, PermissionDecision } from "@shellmind/protocol";

export interface PermissionRequest {
  requestId: string;
  toolName: string;
  command?: string;
  input: Record<string, unknown>;
  cwd: string;
  riskHint: RiskHint;
  description?: string;
}

export interface IPermissionBridge {
  /**
   * Evaluates or awaits permission for a tool invocation.
   * Resolves with 'allow' or 'deny'.
   */
  requestPermission(request: PermissionRequest): Promise<PermissionDecision>;

  /**
   * Resolves a pending permission request by requestId.
   * Returns true if a pending request was found and resolved, false otherwise.
   */
  resolveRequest(
    requestId: string,
    decision: PermissionDecision,
    rememberForSession?: boolean
  ): boolean;

  /**
   * Rejects all currently pending permission requests (e.g. on client disconnect or abort).
   */
  denyAllPending(reason?: string): void;

  /**
   * Clears any session-remembered allowlist.
   */
  clearSessionAllowlist(): void;

  /**
   * Returns true if there are pending requests awaiting decision.
   */
  hasPendingRequests(): boolean;

  /**
   * Returns the count of pending requests awaiting decision.
   */
  getPendingCount(): number;
}
