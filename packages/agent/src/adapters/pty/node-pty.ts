import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createRequire } from "node:module";
import * as pty from "node-pty";
import type {
  ITerminalSession,
  ITerminalManager,
  TerminalSessionOptions,
} from "../../core/terminal.js";

export class NodePtySession implements ITerminalSession {
  public readonly id: string;
  public readonly pid: number;
  private ptyProcess: pty.IPty;
  private isClosed = false;

  constructor(id: string, ptyProcess: pty.IPty) {
    this.id = id;
    this.ptyProcess = ptyProcess;
    this.pid = ptyProcess.pid;
  }

  public write(data: string): void {
    if (this.isClosed) return;
    try {
      this.ptyProcess.write(data);
    } catch {
      // Ignored if process terminated
    }
  }

  public resize(cols: number, rows: number): void {
    if (this.isClosed) return;
    try {
      const validCols = Math.max(1, Math.floor(cols));
      const validRows = Math.max(1, Math.floor(rows));
      this.ptyProcess.resize(validCols, validRows);
    } catch {
      // Ignored if process exited
    }
  }

  public kill(signal?: number): void {
    if (this.isClosed) return;
    this.isClosed = true;
    try {
      // node-pty kill accepts string or signal
      if (signal !== undefined) {
        this.ptyProcess.kill(`SIG${signal}`);
      } else {
        this.ptyProcess.kill();
      }
    } catch {
      // Ignored
    }
  }

  public onData(callback: (data: string) => void): void {
    this.ptyProcess.onData((data) => {
      callback(data);
    });
  }

  public onExit(callback: (exitCode: number, signal?: number) => void): void {
    this.ptyProcess.onExit((e) => {
      this.isClosed = true;
      callback(e.exitCode, e.signal);
    });
  }
}


function ensureSpawnHelperExecutable(): void {
  if (process.platform === "win32") return;
  try {
    const require = createRequire(import.meta.url);
    const ptyPkgPath = require.resolve("node-pty/package.json");
    const ptyDir = path.dirname(ptyPkgPath);
    const prebuildHelper = path.join(
      ptyDir,
      "prebuilds",
      `${process.platform}-${process.arch}`,
      "spawn-helper"
    );
    if (fs.existsSync(prebuildHelper)) {
      const stat = fs.statSync(prebuildHelper);
      if ((stat.mode & 0o111) === 0) {
        fs.chmodSync(prebuildHelper, 0o755);
      }
    }
  } catch {
    // Ignore error if resolution or chmod fails
  }
}

export class NodePtyManager implements ITerminalManager {
  private sessions = new Map<string, NodePtySession>();

  public async createSession(options?: TerminalSessionOptions): Promise<ITerminalSession> {
    ensureSpawnHelperExecutable();

    const id = `term_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const shell =
      process.env.SHELL ||
      (process.platform === "win32" ? "cmd.exe" : "/bin/bash");

    const cwd = options?.cwd || process.env.HOME || os.homedir() || process.cwd();
    const cols = options?.cols ?? 80;
    const rows = options?.rows ?? 24;

    const env = {
      ...process.env,
      ...options?.env,
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
    };

    const ptyProcess = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols,
      rows,
      cwd,
      env: env as Record<string, string>,
    });

    const session = new NodePtySession(id, ptyProcess);
    this.sessions.set(id, session);

    session.onExit(() => {
      this.sessions.delete(id);
    });

    return session;
  }

  public getSession(id: string): ITerminalSession | null {
    return this.sessions.get(id) ?? null;
  }

  public async closeSession(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      session.kill();
      this.sessions.delete(id);
    }
  }

  public async closeAll(): Promise<void> {
    for (const session of this.sessions.values()) {
      session.kill();
    }
    this.sessions.clear();
  }
}
