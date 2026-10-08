import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { ClaudeStreamParser } from "./adapters/claude-driver/parser.js";
import { LocalClaudeDriver } from "./adapters/claude-driver/driver.js";
import { NodeProjectManager } from "./adapters/project/node-project.js";
import type { AgentStreamEvent } from "@shellmind/protocol";

describe("Claude Code Driver & Project Manager Unit Tests (F007)", () => {
  describe("ClaudeStreamParser", () => {
    it("parses single lines of assistant text and tool use", () => {
      const parser = new ClaudeStreamParser();
      const line1 = JSON.stringify({
        type: "assistant",
        message: {
          id: "msg_123",
          content: [
            { type: "text", text: "Looking into the codebase." },
            { type: "tool_use", id: "tu_456", name: "GlobTool", input: { pattern: "*.ts" } },
          ],
        },
      });

      const events = parser.parseLine(line1);
      expect(events).toHaveLength(2);
      expect(events?.[0]).toEqual({
        type: "assistant_text",
        text: "Looking into the codebase.",
        messageId: "msg_123",
      });
      expect(events?.[1]).toEqual({
        type: "tool_use",
        toolName: "GlobTool",
        toolUseId: "tu_456",
        input: { pattern: "*.ts" },
      });
    });

    it("parses tool_result user messages", () => {
      const parser = new ClaudeStreamParser();
      const line = JSON.stringify({
        type: "user",
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "tu_456",
              content: "index.ts\napp.ts",
              is_error: false,
            },
          ],
        },
      });

      const events = parser.parseLine(line);
      expect(events).toHaveLength(1);
      expect(events?.[0]).toEqual({
        type: "tool_result",
        toolUseId: "tu_456",
        content: "index.ts\napp.ts",
        isError: false,
      });
    });

    it("parses rate_limit and done events", () => {
      const parser = new ClaudeStreamParser();
      const rateLine = JSON.stringify({
        type: "rate_limit_event",
        rate_limit_info: {
          unifiedWindows: {
            five_hour: { utilization: 0.35, resetsAt: 1728390000 },
          },
          rateLimitType: "five_hour",
        },
      });
      const doneLine = JSON.stringify({
        type: "result",
        result: "Task finished.",
        total_cost_usd: 0.05,
        duration_ms: 2400,
      });

      const evRate = parser.parseLine(rateLine);
      expect(evRate?.[0]).toEqual({
        type: "rate_limit",
        utilization: 0.35,
        resetsAt: 1728390000,
        rateLimitType: "five_hour",
      });

      const evDone = parser.parseLine(doneLine);
      expect(evDone?.[0]).toEqual({
        type: "done",
        result: "Task finished.",
        costUsd: 0.05,
        durationMs: 2400,
      });
    });

    it("handles incremental chunk streaming and flush", () => {
      const parser = new ClaudeStreamParser();
      const chunk1 = '{"type":"assistant","message":{"content":[{"type":"text","text":"Part 1';
      const chunk2 = ' and Part 2"}]}}\n{"type":"result","result":"Done';
      const chunk3 = '!"}\n';

      const ev1 = parser.feedChunk(chunk1);
      expect(ev1).toHaveLength(0); // Incomplete line

      const ev2 = parser.feedChunk(chunk2);
      expect(ev2).toHaveLength(1);
      expect(ev2[0]).toEqual({
        type: "assistant_text",
        text: "Part 1 and Part 2",
        messageId: undefined,
      });

      const ev3 = parser.feedChunk(chunk3);
      expect(ev3).toHaveLength(1);
      expect(ev3[0]).toEqual({
        type: "done",
        result: "Done!",
        costUsd: 0,
        durationMs: 0,
      });
    });

    it("ignores malformed JSON or empty lines without throwing", () => {
      const parser = new ClaudeStreamParser();
      expect(parser.parseLine("")).toBeNull();
      expect(parser.parseLine("   \n  ")).toBeNull();
      expect(parser.parseLine("Welcome to Claude Code!")).toBeNull();
      expect(parser.parseLine("{ invalid json")).toBeNull();
    });
  });

  describe("LocalClaudeDriver Lifecycle & Controls", () => {
    function createMockProcess() {
      const stdout = Object.assign(new EventEmitter(), { setEncoding: vi.fn() });
      const stderr = Object.assign(new EventEmitter(), { setEncoding: vi.fn() });
      const proc = new EventEmitter() as unknown as ChildProcess & {
        stdout: typeof stdout;
        stderr: typeof stderr;
        killed: boolean;
        kill: ReturnType<typeof vi.fn>;
      };

      (proc as unknown as Record<string, unknown>)["stdout"] = stdout;
      (proc as unknown as Record<string, unknown>)["stderr"] = stderr;
      (proc as unknown as Record<string, unknown>)["killed"] = false;
      (proc as unknown as Record<string, unknown>)["kill"] = vi.fn().mockImplementation((signal?: string) => {
        (proc as unknown as Record<string, unknown>)["killed"] = true;
        setImmediate(() => proc.emit("close", signal === "SIGINT" || signal === "SIGKILL" ? 130 : 0));
        return true;
      });

      return proc;
    }

    it("rejects empty prompt with error event", async () => {
      const driver = new LocalClaudeDriver();
      const events: AgentStreamEvent[] = [];

      await driver.runTurn({
        prompt: "   ",
        onEvent: (e) => events.push(e),
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: "error",
        error: "Prompt cannot be empty.",
        code: "EMPTY_PROMPT",
      });
    });

    it("spawns process, streams parsed events, and cleans up state", async () => {
      const mockProc = createMockProcess();
      const mockSpawn = vi.fn().mockReturnValue(mockProc);

      const driver = new LocalClaudeDriver({
        claudeBinary: "claude",
        defaultCwd: "/test/dir",
        spawnFn: mockSpawn as unknown as typeof import("node:child_process").spawn,
      });

      const events: AgentStreamEvent[] = [];
      const turnPromise = driver.runTurn({
        prompt: "test prompt",
        onEvent: (e) => events.push(e),
      });

      expect(driver.isBusy()).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith(
        "claude",
        ["-p", "test prompt", "--output-format", "stream-json", "--verbose"],
        expect.objectContaining({ cwd: "/test/dir" })
      );

      // Emulate stdout JSONL chunks
      mockProc.stdout.emit(
        "data",
        JSON.stringify({
          type: "assistant",
          message: { content: [{ type: "text", text: "Hello!" }] },
        }) + "\n"
      );

      mockProc.stdout.emit(
        "data",
        JSON.stringify({
          type: "result",
          result: "Done",
          total_cost_usd: 0.01,
          duration_ms: 100,
        }) + "\n"
      );

      mockProc.emit("close", 0);
      await turnPromise;

      expect(driver.isBusy()).toBe(false);
      expect(events).toHaveLength(2);
      expect(events[0]?.type).toBe("assistant_text");
      expect(events[1]?.type).toBe("done");
    });

    it("rejects second concurrent prompt when busy", async () => {
      const mockProc = createMockProcess();
      const mockSpawn = vi.fn().mockReturnValue(mockProc);

      const driver = new LocalClaudeDriver({
        spawnFn: mockSpawn as unknown as typeof import("node:child_process").spawn,
      });

      const events1: AgentStreamEvent[] = [];
      const events2: AgentStreamEvent[] = [];

      const p1 = driver.runTurn({
        prompt: "first prompt",
        onEvent: (e) => events1.push(e),
      });

      await driver.runTurn({
        prompt: "second concurrent prompt",
        onEvent: (e) => events2.push(e),
      });

      expect(events2).toHaveLength(1);
      expect(events2[0]).toEqual({
        type: "error",
        error: "A turn is already in progress. Please wait or abort the active turn.",
        code: "BUSY",
      });

      mockProc.emit("close", 0);
      await p1;
    });

    it("aborts active turn and emits aborted event", async () => {
      const mockProc = createMockProcess();
      const mockSpawn = vi.fn().mockReturnValue(mockProc);

      const driver = new LocalClaudeDriver({
        spawnFn: mockSpawn as unknown as typeof import("node:child_process").spawn,
      });

      const events: AgentStreamEvent[] = [];
      const turnPromise = driver.runTurn({
        prompt: "long running prompt",
        onEvent: (e) => events.push(e),
      });

      expect(driver.isBusy()).toBe(true);

      const aborted = await driver.abortTurn("User clicked stop");
      expect(aborted).toBe(true);
      expect(mockProc.kill).toHaveBeenCalledWith("SIGINT");

      await turnPromise;
      expect(driver.isBusy()).toBe(false);

      const hasAbortedEvent = events.some((e) => e.type === "aborted");
      expect(hasAbortedEvent).toBe(true);
    });

    it("handles ENOENT spawn error when claude binary is missing", async () => {
      const mockProc = createMockProcess();
      const mockSpawn = vi.fn().mockReturnValue(mockProc);

      const driver = new LocalClaudeDriver({
        spawnFn: mockSpawn as unknown as typeof import("node:child_process").spawn,
      });

      const events: AgentStreamEvent[] = [];
      const turnPromise = driver.runTurn({
        prompt: "check missing CLI",
        onEvent: (e) => events.push(e),
      });

      const enoentErr = new Error("spawn claude ENOENT") as NodeJS.ErrnoException;
      enoentErr.code = "ENOENT";
      mockProc.emit("error", enoentErr);

      await turnPromise;
      expect(events).toHaveLength(1);
      const ev = events[0];
      expect(ev).toBeDefined();
      if (ev && ev.type === "error") {
        expect(ev.code).toBe("CLI_NOT_FOUND");
      }
    });
  });

  describe("NodeProjectManager", () => {
    it("returns current working directory and lists available projects", async () => {
      const mgr = new NodeProjectManager({ initialCwd: process.cwd() });
      expect(mgr.getCurrentCwd()).toBe(process.cwd());

      const list = await mgr.listProjects();
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list[0]?.path).toBe(process.cwd());
    });

    it("switches directory if valid and rejects invalid paths", async () => {
      const mgr = new NodeProjectManager();
      const success = await mgr.setCurrentCwd("/");
      expect(success).toBe(true);
      expect(mgr.getCurrentCwd()).toBe("/");

      const failed = await mgr.setCurrentCwd("/nonexistent_directory_xyz_12345");
      expect(failed).toBe(false);
      expect(mgr.getCurrentCwd()).toBe("/"); // Preserves last valid cwd
    });
  });
});
