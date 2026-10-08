import {
  isReadonlyCommand,
  type PermissionDecision,
} from "@shellmind/protocol";
import type {
  IPermissionBridge,
  PermissionRequest,
} from "../../core/permission.js";
import type { IAuditLogger } from "../../core/audit.js";

export interface PermissionBridgeOptions {
  sendPermRequest?: (req: PermissionRequest) => void;
  auditLogger?: IAuditLogger;
  timeoutMs?: number;
  autoAllowReadonly?: boolean;
  deviceId?: string;
  sessionId?: string;
}

interface PendingEntry {
  req: PermissionRequest;
  timer: NodeJS.Timeout;
  resolve: (decision: PermissionDecision) => void;
  reject: (err: unknown) => void;
}

export function getAllowlistKey(req: PermissionRequest): string {
  if (req.command) {
    return `${req.toolName}:${req.command}`;
  }
  if (typeof req.input["file_path"] === "string") {
    return `${req.toolName}:${req.input["file_path"]}`;
  }
  return req.toolName;
}

export class PermissionBridge implements IPermissionBridge {
  private readonly pending = new Map<string, PendingEntry>();
  private readonly sessionAllowlist = new Set<string>();
  private sendPermRequestFn?: (req: PermissionRequest) => void;
  private readonly auditLogger?: IAuditLogger;
  private readonly timeoutMs: number;
  private readonly autoAllowReadonly: boolean;
  private deviceId?: string;
  private sessionId?: string;

  constructor(options: PermissionBridgeOptions = {}) {
    this.sendPermRequestFn = options.sendPermRequest;
    this.auditLogger = options.auditLogger;
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.autoAllowReadonly = options.autoAllowReadonly ?? true;
    this.deviceId = options.deviceId;
    this.sessionId = options.sessionId;
  }

  public setSendHandler(handler: (req: PermissionRequest) => void): void {
    this.sendPermRequestFn = handler;
  }

  public setContext(deviceId?: string, sessionId?: string): void {
    this.deviceId = deviceId;
    this.sessionId = sessionId;
  }

  public hasPendingRequests(): boolean {
    return this.pending.size > 0;
  }

  public getPendingCount(): number {
    return this.pending.size;
  }

  public clearSessionAllowlist(): void {
    this.sessionAllowlist.clear();
  }

  public async requestPermission(req: PermissionRequest): Promise<PermissionDecision> {
    // 1. Check auto-allow for safe read-only commands
    if (this.autoAllowReadonly && isReadonlyCommand(req.toolName, req.input)) {
      if (this.auditLogger) {
        await this.auditLogger.log({
          ts: Date.now(),
          deviceId: this.deviceId,
          sessionId: this.sessionId,
          mode: "agent",
          toolName: req.toolName,
          command: req.command,
          cwd: req.cwd,
          decision: "auto-allow",
          riskHint: req.riskHint,
          reason: "Auto-allowed by read-only allowlist",
        });
      }
      return "allow";
    }

    // 2. Check session-scoped allowlist
    const allowKey = getAllowlistKey(req);
    if (this.sessionAllowlist.has(allowKey)) {
      if (this.auditLogger) {
        await this.auditLogger.log({
          ts: Date.now(),
          deviceId: this.deviceId,
          sessionId: this.sessionId,
          mode: "agent",
          toolName: req.toolName,
          command: req.command,
          cwd: req.cwd,
          decision: "allow",
          riskHint: req.riskHint,
          reason: "Auto-allowed by session allowlist",
        });
      }
      return "allow";
    }

    // 3. Check if we have a handler to prompt the mobile client
    if (!this.sendPermRequestFn) {
      if (this.auditLogger) {
        await this.auditLogger.log({
          ts: Date.now(),
          deviceId: this.deviceId,
          sessionId: this.sessionId,
          mode: "agent",
          toolName: req.toolName,
          command: req.command,
          cwd: req.cwd,
          decision: "deny",
          riskHint: req.riskHint,
          reason: "No permission handler available to prompt user",
        });
      }
      return "deny";
    }

    // 4. Register pending request and prompt user
    return new Promise<PermissionDecision>((resolve, reject) => {
      const timer = setTimeout(async () => {
        const entry = this.pending.get(req.requestId);
        if (!entry) return;
        this.pending.delete(req.requestId);

        try {
          if (this.auditLogger) {
            await this.auditLogger.log({
              ts: Date.now(),
              deviceId: this.deviceId,
              sessionId: this.sessionId,
              mode: "agent",
              toolName: req.toolName,
              command: req.command,
              cwd: req.cwd,
              decision: "deny",
              riskHint: req.riskHint,
              reason: "Permission request timed out",
            });
          }
        } catch {
          // Ignore audit write failure on timeout
        }

        resolve("deny");
      }, this.timeoutMs);

      // Unref timer so node process is not held open in tests/cli
      if (typeof timer.unref === "function") {
        timer.unref();
      }

      this.pending.set(req.requestId, {
        req,
        timer,
        resolve,
        reject,
      });

      this.sendPermRequestFn?.(req);
    });
  }

  public resolveRequest(
    requestId: string,
    decision: PermissionDecision,
    rememberForSession?: boolean
  ): boolean {
    const entry = this.pending.get(requestId);
    if (!entry) {
      // Already resolved, timed out, or non-existent (idempotent)
      return false;
    }

    clearTimeout(entry.timer);
    this.pending.delete(requestId);

    const finish = async () => {
      if (decision === "allow" && rememberForSession) {
        this.sessionAllowlist.add(getAllowlistKey(entry.req));
      }

      // Audit log MUST be written before releasing execution for allowed commands
      if (this.auditLogger) {
        try {
          await this.auditLogger.log({
            ts: Date.now(),
            deviceId: this.deviceId,
            sessionId: this.sessionId,
            mode: "agent",
            toolName: entry.req.toolName,
            command: entry.req.command,
            cwd: entry.req.cwd,
            decision,
            riskHint: entry.req.riskHint,
            reason: decision === "allow" ? "Approved by user" : "Denied by user",
          });
        } catch {
          // If audit log fails to record, do NOT allow execution!
          entry.resolve("deny");
          return;
        }
      }

      entry.resolve(decision);
    };

    void finish();
    return true;
  }

  public denyAllPending(reason = "Cancelled"): void {
    const entries = Array.from(this.pending.values());
    this.pending.clear();

    for (const entry of entries) {
      clearTimeout(entry.timer);
      if (this.auditLogger) {
        void this.auditLogger.log({
          ts: Date.now(),
          deviceId: this.deviceId,
          sessionId: this.sessionId,
          mode: "agent",
          toolName: entry.req.toolName,
          command: entry.req.command,
          cwd: entry.req.cwd,
          decision: "deny",
          riskHint: entry.req.riskHint,
          reason,
        }).catch(() => {});
      }
      entry.resolve("deny");
    }
  }
}
