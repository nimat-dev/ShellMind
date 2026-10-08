import type { AgentStreamEvent } from "@shellmind/protocol";

export class ClaudeStreamParser {
  private buffer = "";

  /**
   * Feeds an incoming text chunk (from stdout) and returns any complete parsed events.
   */
  public feedChunk(chunk: string): AgentStreamEvent[] {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    // Keep whatever is after the last newline in the buffer
    this.buffer = lines.pop() ?? "";

    const events: AgentStreamEvent[] = [];
    for (const line of lines) {
      const parsed = this.parseLine(line);
      if (parsed) {
        events.push(...parsed);
      }
    }
    return events;
  }

  /**
   * Flushes any remaining content in the buffer.
   */
  public flush(): AgentStreamEvent[] {
    if (!this.buffer.trim()) {
      this.buffer = "";
      return [];
    }
    const line = this.buffer;
    this.buffer = "";
    return this.parseLine(line) ?? [];
  }

  /**
   * Parses a single JSONL line into discrete AgentStreamEvents.
   * Tolerates and skips malformed or non-JSON lines without crashing.
   */
  public parseLine(line: string): AgentStreamEvent[] | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      // Tolerate non-JSON output (e.g. CLI greeting or warning)
      return null;
    }

    const emitted: AgentStreamEvent[] = [];

    // 1. Assistant message with content blocks (text or tool_use)
    if (
      raw["type"] === "assistant" &&
      typeof raw["message"] === "object" &&
      raw["message"] !== null
    ) {
      const message = raw["message"] as Record<string, unknown>;
      const messageId = typeof message["id"] === "string" ? message["id"] : undefined;
      const content = message["content"];

      if (Array.isArray(content)) {
        for (const block of content) {
          if (typeof block !== "object" || block === null) continue;
          const b = block as Record<string, unknown>;

          if (b["type"] === "text" && typeof b["text"] === "string" && b["text"]) {
            emitted.push({
              type: "assistant_text",
              text: b["text"],
              messageId,
            });
          } else if (b["type"] === "tool_use" && typeof b["name"] === "string" && typeof b["id"] === "string") {
            emitted.push({
              type: "tool_use",
              toolName: b["name"],
              toolUseId: b["id"],
              input: (typeof b["input"] === "object" && b["input"] !== null)
                ? (b["input"] as Record<string, unknown>)
                : {},
            });
          }
        }
      }
    }

    // 2. User tool_result message
    if (
      raw["type"] === "user" &&
      typeof raw["message"] === "object" &&
      raw["message"] !== null
    ) {
      const message = raw["message"] as Record<string, unknown>;
      const content = message["content"];

      if (Array.isArray(content)) {
        for (const block of content) {
          if (typeof block !== "object" || block === null) continue;
          const b = block as Record<string, unknown>;

          if (b["type"] === "tool_result" && typeof b["tool_use_id"] === "string") {
            const resultText = typeof b["content"] === "string"
              ? b["content"]
              : JSON.stringify(b["content"] ?? "");
            emitted.push({
              type: "tool_result",
              toolUseId: b["tool_use_id"],
              content: resultText,
              isError: Boolean(b["is_error"]),
            });
          }
        }
      }
    }

    // 3. Rate limit event
    if (raw["type"] === "rate_limit_event" && typeof raw["rate_limit_info"] === "object" && raw["rate_limit_info"] !== null) {
      const info = raw["rate_limit_info"] as Record<string, unknown>;
      const unified = typeof info["unifiedWindows"] === "object" && info["unifiedWindows"] !== null
        ? (info["unifiedWindows"] as Record<string, unknown>)
        : {};
      const fiveHour = typeof unified["five_hour"] === "object" && unified["five_hour"] !== null
        ? (unified["five_hour"] as Record<string, unknown>)
        : {};

      emitted.push({
        type: "rate_limit",
        utilization: typeof fiveHour["utilization"] === "number" ? fiveHour["utilization"] : 0,
        resetsAt: typeof fiveHour["resetsAt"] === "number"
          ? fiveHour["resetsAt"]
          : typeof info["resetsAt"] === "number"
          ? info["resetsAt"]
          : 0,
        rateLimitType: typeof info["rateLimitType"] === "string" ? info["rateLimitType"] : "five_hour",
      });
    }

    // 4. Final result event
    if (raw["type"] === "result") {
      emitted.push({
        type: "done",
        result: typeof raw["result"] === "string" ? raw["result"] : "",
        costUsd: typeof raw["total_cost_usd"] === "number" ? raw["total_cost_usd"] : 0,
        durationMs: typeof raw["duration_ms"] === "number" ? raw["duration_ms"] : 0,
      });
    }

    // 5. System error or warning
    if (raw["type"] === "error" || (raw["type"] === "system" && raw["subtype"] === "error")) {
      const errorMsg = typeof raw["message"] === "string"
        ? raw["message"]
        : typeof raw["error"] === "string"
        ? raw["error"]
        : "Claude Code encountered an error";
      emitted.push({
        type: "error",
        error: errorMsg,
      });
    }

    return emitted.length > 0 ? emitted : null;
  }
}
