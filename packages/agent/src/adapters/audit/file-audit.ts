import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { IAuditLogger, AuditEntry } from "../../core/audit.js";

export interface FileAuditLoggerOptions {
  filePath: string;
}

export class FileAuditLogger implements IAuditLogger {
  private readonly filePath: string;
  private isDirEnsured = false;

  constructor(options: FileAuditLoggerOptions) {
    this.filePath = options.filePath;
  }

  private async ensureDir(): Promise<void> {
    if (!this.isDirEnsured) {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true, mode: 0o700 });
      this.isDirEnsured = true;
    }
  }

  /**
   * Appends an audit entry as a single JSON line.
   * Atomic append-only guarantees; throws if write fails so callers can halt execution.
   */
  public async log(entry: AuditEntry): Promise<void> {
    await this.ensureDir();
    const line = JSON.stringify(entry) + "\n";
    await fs.appendFile(this.filePath, line, { encoding: "utf-8", mode: 0o600 });
  }

  /**
   * Queries audit entries from disk.
   */
  public async query(filter?: {
    sessionId?: string;
    deviceId?: string;
    limit?: number;
  }): Promise<AuditEntry[]> {
    try {
      const raw = await fs.readFile(this.filePath, "utf-8");
      const lines = raw.split("\n").filter((l) => l.trim().length > 0);
      const entries: AuditEntry[] = [];

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as AuditEntry;
          if (filter?.sessionId && entry.sessionId !== filter.sessionId) {
            continue;
          }
          if (filter?.deviceId && entry.deviceId !== filter.deviceId) {
            continue;
          }
          entries.push(entry);
        } catch {
          // Skip any corrupted line
        }
      }

      if (filter?.limit && filter.limit > 0) {
        return entries.slice(-filter.limit);
      }
      return entries;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw err;
    }
  }
}
