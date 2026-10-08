import { spawn, type ChildProcess } from "node:child_process";
import type { IClaudeDriver, ClaudeTurnOptions } from "../../core/claude.js";
import { ClaudeStreamParser } from "./parser.js";

export interface LocalClaudeDriverOptions {
  claudeBinary?: string;
  defaultCwd?: string;
  spawnFn?: typeof spawn;
}

export class LocalClaudeDriver implements IClaudeDriver {
  private readonly claudeBinary: string;
  private readonly defaultCwd: string;
  private readonly spawnFn: typeof spawn;

  private currentChild: ChildProcess | null = null;
  private isAborting = false;
  private abortReason: string | undefined = undefined;

  constructor(options: LocalClaudeDriverOptions = {}) {
    this.claudeBinary = options.claudeBinary ?? "claude";
    this.defaultCwd = options.defaultCwd ?? process.cwd();
    this.spawnFn = options.spawnFn ?? spawn;
  }

  public isBusy(): boolean {
    return this.currentChild !== null;
  }

  public async abortTurn(reason?: string): Promise<boolean> {
    if (!this.currentChild) {
      return false;
    }

    this.isAborting = true;
    this.abortReason = reason || "User cancelled";

    const child = this.currentChild;
    try {
      // First try gentle SIGINT so Claude Code can finish writing state if needed
      child.kill("SIGINT");

      // Give 500ms to exit cleanly, then force SIGKILL
      const killTimer = setTimeout(() => {
        try {
          if (!child.killed) {
            child.kill("SIGKILL");
          }
        } catch {
          // Process already terminated
        }
      }, 500);

      // Avoid keeping Node process alive just for the kill timer
      if (typeof killTimer.unref === "function") {
        killTimer.unref();
      }
    } catch {
      // Ignore kill error
    }

    return true;
  }

  public async runTurn(options: ClaudeTurnOptions): Promise<void> {
    if (this.isBusy()) {
      options.onEvent({
        type: "error",
        error: "A turn is already in progress. Please wait or abort the active turn.",
        code: "BUSY",
      });
      return;
    }

    const trimmedPrompt = options.prompt.trim();
    if (!trimmedPrompt) {
      options.onEvent({
        type: "error",
        error: "Prompt cannot be empty.",
        code: "EMPTY_PROMPT",
      });
      return;
    }

    const targetCwd = options.cwd || this.defaultCwd;
    const parser = new ClaudeStreamParser();
    let hasEmittedTerminalEvent = false;
    let stderrOutput = "";

    const args = ["-p", trimmedPrompt, "--output-format", "stream-json", "--verbose"];

    return new Promise<void>((resolve) => {
      let child: ChildProcess;
      try {
        child = this.spawnFn(this.claudeBinary, args, {
          cwd: targetCwd,
          env: { ...process.env },
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (err: unknown) {
        options.onEvent({
          type: "error",
          error: `Failed to spawn Claude process: ${err instanceof Error ? err.message : String(err)}`,
          code: "SPAWN_ERROR",
        });
        resolve();
        return;
      }

      this.currentChild = child;
      this.isAborting = false;
      this.abortReason = undefined;

      child.stdout?.setEncoding("utf-8");
      child.stdout?.on("data", (data: string) => {
        const events = parser.feedChunk(data);
        for (const ev of events) {
          if (ev.type === "done" || ev.type === "error" || ev.type === "aborted") {
            hasEmittedTerminalEvent = true;
          }
          options.onEvent(ev);
        }
      });

      child.stderr?.setEncoding("utf-8");
      child.stderr?.on("data", (data: string) => {
        stderrOutput += data;
      });

      child.on("error", (err: NodeJS.ErrnoException) => {
        this.currentChild = null;
        if (err.code === "ENOENT") {
          options.onEvent({
            type: "error",
            error: "Claude Code CLI is not installed or not found in PATH. Install with: npm install -g @anthropic-ai/claude-code",
            code: "CLI_NOT_FOUND",
          });
        } else {
          options.onEvent({
            type: "error",
            error: `Claude process error: ${err.message}`,
            code: "PROCESS_ERROR",
          });
        }
        hasEmittedTerminalEvent = true;
        resolve();
      });

      child.on("close", (exitCode: number | null) => {
        // Flush any remaining line
        const remaining = parser.flush();
        for (const ev of remaining) {
          if (ev.type === "done" || ev.type === "error" || ev.type === "aborted") {
            hasEmittedTerminalEvent = true;
          }
          options.onEvent(ev);
        }

        const wasAborted = this.isAborting;
        const reason = this.abortReason;

        this.currentChild = null;
        this.isAborting = false;
        this.abortReason = undefined;

        if (wasAborted) {
          options.onEvent({
            type: "aborted",
            reason,
          });
        } else if (!hasEmittedTerminalEvent) {
          if (exitCode !== 0) {
            const errDetail = stderrOutput.trim() || `Process exited with code ${exitCode}`;
            options.onEvent({
              type: "error",
              error: errDetail,
              code: "NON_ZERO_EXIT",
            });
          } else {
            // Emits done fallback if result frame wasn't received
            options.onEvent({
              type: "done",
              result: "",
              costUsd: 0,
              durationMs: 0,
            });
          }
        }

        resolve();
      });
    });
  }
}
