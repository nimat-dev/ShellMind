import type { AgentStreamEvent } from "@shellmind/protocol";
import type { IPermissionBridge } from "./permission.js";

export interface ClaudeTurnOptions {
  prompt: string;
  cwd?: string;
  onEvent: (event: AgentStreamEvent) => void;
  permissionBridge?: IPermissionBridge;
}

export interface IClaudeDriver {
  /**
   * Runs a prompt turn against Claude Code, streaming parsed events via onEvent.
   * Resolves when the turn finishes (done, aborted, or error).
   */
  runTurn(options: ClaudeTurnOptions): Promise<void>;

  /**
   * Aborts the currently active turn and kills the underlying child process cleanly.
   * Returns true if an active turn was aborted.
   */
  abortTurn(reason?: string): Promise<boolean>;

  /**
   * Returns whether a prompt turn is currently running.
   */
  isBusy(): boolean;
}
