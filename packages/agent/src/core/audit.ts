import type { RiskHint } from "@shellmind/protocol";

export type AuditDecision = "auto-allow" | "allow" | "deny";

export interface AuditEntry {
  ts: number;
  deviceId?: string;
  sessionId?: string;
  mode?: "terminal" | "agent";
  toolName: string;
  command?: string;
  cwd?: string;
  decision: AuditDecision;
  riskHint?: RiskHint;
  reason?: string;
}

export interface IAuditLogger {
  /**
   * Appends an audit entry.
   * MUST resolve before tool execution proceeds.
   */
  log(entry: AuditEntry): Promise<void>;

  /**
   * Reads back entries from the audit log (optional for inspection/testing).
   */
  query?(filter?: { sessionId?: string; deviceId?: string; limit?: number }): Promise<AuditEntry[]>;
}
