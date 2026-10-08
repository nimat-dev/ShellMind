import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import type { ChatTurn } from "@shellmind/protocol";
import type { ITranscriptStore, TranscriptFilter } from "../../core/transcript.js";

export class FileTranscriptStore implements ITranscriptStore {
  private readonly storageDir: string;
  private readonly maxTurns: number;

  constructor(storageDir?: string, maxTurns = 100) {
    this.storageDir = storageDir ?? path.join(os.homedir(), ".shellmind", "transcripts");
    this.maxTurns = Math.max(1, maxTurns);
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true, mode: 0o700 });
    }
  }

  public getFilePath(projectKey: string): string {
    const rawKey = projectKey.trim() || "default";
    const baseSlug = path.basename(rawKey).replace(/[^a-zA-Z0-9_-]/g, "_") || "project";
    const hash = crypto.createHash("sha256").update(rawKey).digest("hex").slice(0, 16);
    return path.join(this.storageDir, `${baseSlug}_${hash}.json`);
  }

  private readTurnsSync(filePath: string): ChatTurn[] {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed as ChatTurn[];
      }
      return [];
    } catch {
      // File corrupted or invalid JSON; recover gracefully with empty list
      return [];
    }
  }

  private writeTurnsSync(filePath: string, turns: ChatTurn[]): void {
    this.ensureDirectory();
    const capped = turns.slice(-this.maxTurns);
    const json = JSON.stringify(capped, null, 2);
    fs.writeFileSync(filePath, json, { mode: 0o600 });
    fs.chmodSync(filePath, 0o600);
  }

  public async appendTurn(projectKey: string, turn: ChatTurn): Promise<void> {
    const filePath = this.getFilePath(projectKey);
    const turns = this.readTurnsSync(filePath);

    const existingIdx = turns.findIndex((t) => t.id === turn.id);
    if (existingIdx >= 0) {
      turns[existingIdx] = { ...turns[existingIdx], ...turn };
    } else {
      turns.push(turn);
    }

    this.writeTurnsSync(filePath, turns);
  }

  public async updateTurn(
    projectKey: string,
    turnId: string,
    update: Partial<ChatTurn>
  ): Promise<void> {
    const filePath = this.getFilePath(projectKey);
    const turns = this.readTurnsSync(filePath);

    const existingIdx = turns.findIndex((t) => t.id === turnId);
    if (existingIdx >= 0) {
      const existing = turns[existingIdx]!;
      turns[existingIdx] = {
        ...existing,
        ...update,
        id: existing.id,
        role: update.role ?? existing.role,
        timestamp: update.timestamp ?? existing.timestamp,
      };
      this.writeTurnsSync(filePath, turns);
    }
  }

  public async getTranscript(
    projectKey: string,
    filter?: TranscriptFilter | number
  ): Promise<ChatTurn[]> {
    const filePath = this.getFilePath(projectKey);
    const turns = this.readTurnsSync(filePath);

    let limit: number | undefined;
    if (typeof filter === "number") {
      limit = filter;
    } else if (filter && typeof filter.limit === "number") {
      limit = filter.limit;
    }

    if (limit && limit > 0 && turns.length > limit) {
      return turns.slice(-limit);
    }

    return turns;
  }

  public async clearTranscript(projectKey: string): Promise<void> {
    const filePath = this.getFilePath(projectKey);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // Fallback: write empty array if unlink fails
        this.writeTurnsSync(filePath, []);
      }
    }
  }
}
