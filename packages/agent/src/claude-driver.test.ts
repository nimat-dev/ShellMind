import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import type { ChildProcess } from "node:child_process";
import { ClaudeStreamParser } from "./adapters/claude-driver/parser.js";
import { LocalClaudeDriver } from "./adapters/claude-driver/driver.js";
import { NodeProjectManager } from "./adapters/project/node-project.js";
import { PermissionBridge } from "./adapters/permission/bridge.js";
import { FileAuditLogger } from "./adapters/audit/file-audit.js";
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
      const stdin = Object.assign(new EventEmitter(), { write: vi.fn(), writable: true });
      const proc = new EventEmitter() as unknown as ChildProcess & {
        stdout: typeof stdout;
        stderr: typeof stderr;
        stdin: typeof stdin;
        killed: boolean;
        kill: ReturnType<typeof vi.fn>;
      };

      (proc as unknown as Record<string, unknown>)["stdout"] = stdout;
      (proc as unknown as Record<string, unknown>)["stderr"] = stderr;
      (proc as unknown as Record<string, unknown>)["stdin"] = stdin;
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
        [
          "-p",
          "test prompt",
          "--output-format",
          "stream-json",
          "--input-format",
          "stream-json",
          "--verbose",
          "--permission-prompt-tool",
          "stdio",
        ],
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

  describe("Permission Interception & Bridge (F008)", () => {
    it("ClaudeStreamParser calls onControlRequest and does not emit stream events", () => {
      const onControlRequest = vi.fn();
      const parser = new ClaudeStreamParser({ onControlRequest });

      const ctrlLine = JSON.stringify({
        type: "control_request",
        request_id: "req_xyz",
        request: {
          subtype: "can_use_tool",
          tool_name: "Bash",
          input: { command: "rm -rf /tmp/foo" },
          description: "Removing temp folder",
        },
      });

      const events = parser.feedChunk(ctrlLine + "\n");
      expect(events).toHaveLength(0);
      expect(onControlRequest).toHaveBeenCalledWith({
        requestId: "req_xyz",
        toolName: "Bash",
        input: { command: "rm -rf /tmp/foo" },
        description: "Removing temp folder",
      });
    });

    it("LocalClaudeDriver intercepts control_request, prompts bridge, and responds allow", async () => {
      function createMockProcess() {
        const stdout = Object.assign(new EventEmitter(), { setEncoding: vi.fn() });
        const stderr = Object.assign(new EventEmitter(), { setEncoding: vi.fn() });
        const stdin = Object.assign(new EventEmitter(), { write: vi.fn(), writable: true });
        const proc = new EventEmitter() as unknown as ChildProcess & {
          stdout: typeof stdout;
          stderr: typeof stderr;
          stdin: typeof stdin;
          killed: boolean;
          kill: ReturnType<typeof vi.fn>;
        };

        (proc as unknown as Record<string, unknown>)["stdout"] = stdout;
        (proc as unknown as Record<string, unknown>)["stderr"] = stderr;
        (proc as unknown as Record<string, unknown>)["stdin"] = stdin;
        (proc as unknown as Record<string, unknown>)["killed"] = false;
        (proc as unknown as Record<string, unknown>)["kill"] = vi.fn().mockImplementation(() => {
          (proc as unknown as Record<string, unknown>)["killed"] = true;
          return true;
        });

        return proc;
      }

      const mockProc = createMockProcess();
      const mockSpawn = vi.fn().mockReturnValue(mockProc);

      let capturedReqId = "";
      const bridge = new PermissionBridge({
        sendPermRequest: (req) => {
          capturedReqId = req.requestId;
          // Asynchronously approve
          setTimeout(() => {
            bridge.resolveRequest(req.requestId, "allow");
          }, 10);
        },
      });

      const driver = new LocalClaudeDriver({
        spawnFn: mockSpawn as unknown as typeof import("node:child_process").spawn,
        permissionBridge: bridge,
      });

      const events: AgentStreamEvent[] = [];
      const turnPromise = driver.runTurn({
        prompt: "delete tmp",
        onEvent: (e) => events.push(e),
      });

      // Emit control request from Claude
      mockProc.stdout.emit(
        "data",
        JSON.stringify({
          type: "control_request",
          request_id: "req_perm_1",
          request: {
            subtype: "can_use_tool",
            tool_name: "Bash",
            input: { command: "rm -rf /tmp/test" },
          },
        }) + "\n"
      );

      // Wait a moment for resolution
      await new Promise((r) => setTimeout(r, 30));

      expect(capturedReqId).toBe("req_perm_1");
      expect(mockProc.stdin.write).toHaveBeenCalledWith(
        expect.stringContaining('"behavior":"allow"')
      );

      // Finish turn
      mockProc.stdout.emit(
        "data",
        JSON.stringify({
          type: "result",
          result: "Done",
          total_cost_usd: 0,
          duration_ms: 50,
        }) + "\n"
      );
      mockProc.emit("close", 0);
      await turnPromise;
    });

    it("LocalClaudeDriver responds deny when bridge resolves with deny", async () => {
      function createMockProcess() {
        const stdout = Object.assign(new EventEmitter(), { setEncoding: vi.fn() });
        const stderr = Object.assign(new EventEmitter(), { setEncoding: vi.fn() });
        const stdin = Object.assign(new EventEmitter(), { write: vi.fn(), writable: true });
        const proc = new EventEmitter() as unknown as ChildProcess & {
          stdout: typeof stdout;
          stderr: typeof stderr;
          stdin: typeof stdin;
          killed: boolean;
          kill: ReturnType<typeof vi.fn>;
        };

        (proc as unknown as Record<string, unknown>)["stdout"] = stdout;
        (proc as unknown as Record<string, unknown>)["stderr"] = stderr;
        (proc as unknown as Record<string, unknown>)["stdin"] = stdin;
        (proc as unknown as Record<string, unknown>)["killed"] = false;
        (proc as unknown as Record<string, unknown>)["kill"] = vi.fn().mockImplementation(() => {
          (proc as unknown as Record<string, unknown>)["killed"] = true;
          return true;
        });

        return proc;
      }

      const mockProc = createMockProcess();
      const mockSpawn = vi.fn().mockReturnValue(mockProc);

      const bridge = new PermissionBridge({
        sendPermRequest: (req) => {
          // Immediately deny
          bridge.resolveRequest(req.requestId, "deny");
        },
      });

      const driver = new LocalClaudeDriver({
        spawnFn: mockSpawn as unknown as typeof import("node:child_process").spawn,
        permissionBridge: bridge,
      });

      const events: AgentStreamEvent[] = [];
      const turnPromise = driver.runTurn({
        prompt: "dangerous",
        onEvent: (e) => events.push(e),
      });

      mockProc.stdout.emit(
        "data",
        JSON.stringify({
          type: "control_request",
          request_id: "req_perm_2",
          request: {
            subtype: "can_use_tool",
            tool_name: "Bash",
            input: { command: "rm -rf /" },
          },
        }) + "\n"
      );

      await new Promise((r) => setTimeout(r, 20));

      expect(mockProc.stdin.write).toHaveBeenCalledWith(
        expect.stringContaining('"behavior":"deny"')
      );

      mockProc.emit("close", 0);
      await turnPromise;
    });

    describe("PermissionBridge Unit Tests", () => {
      it("auto-allows read-only commands without prompting send handler", async () => {
        const sendFn = vi.fn();
        const bridge = new PermissionBridge({
          sendPermRequest: sendFn,
          autoAllowReadonly: true,
        });

        const decision = await bridge.requestPermission({
          requestId: "p1",
          toolName: "Bash",
          command: "ls -la",
          input: { command: "ls -la" },
          cwd: "/workspace",
          riskHint: "low",
        });

        expect(decision).toBe("allow");
        expect(sendFn).not.toHaveBeenCalled();
      });

      it("prompts user and resolves allow/deny idempotently", async () => {
        let pendingId = "";
        const bridge = new PermissionBridge({
          sendPermRequest: (req) => {
            pendingId = req.requestId;
          },
        });

        const reqPromise = bridge.requestPermission({
          requestId: "p2",
          toolName: "Bash",
          command: "touch newfile",
          input: { command: "touch newfile" },
          cwd: "/workspace",
          riskHint: "medium",
        });

        expect(pendingId).toBe("p2");
        expect(bridge.hasPendingRequests()).toBe(true);
        expect(bridge.getPendingCount()).toBe(1);

        const firstResolve = bridge.resolveRequest("p2", "allow");
        expect(firstResolve).toBe(true);

        const decision = await reqPromise;
        expect(decision).toBe("allow");
        expect(bridge.hasPendingRequests()).toBe(false);

        // Double tap is idempotent
        const secondResolve = bridge.resolveRequest("p2", "allow");
        expect(secondResolve).toBe(false);
      });

      it("remembers decision for session when requested", async () => {
        const sendFn = vi.fn();
        const bridge = new PermissionBridge({
          sendPermRequest: sendFn,
        });

        const firstPromise = bridge.requestPermission({
          requestId: "p3",
          toolName: "Bash",
          command: "npm test",
          input: { command: "npm test" },
          cwd: "/workspace",
          riskHint: "medium",
        });

        bridge.resolveRequest("p3", "allow", true); // Remember for session
        await firstPromise;

        // Second time: should auto-allow without prompting
        const secondDecision = await bridge.requestPermission({
          requestId: "p4",
          toolName: "Bash",
          command: "npm test",
          input: { command: "npm test" },
          cwd: "/workspace",
          riskHint: "medium",
        });

        expect(secondDecision).toBe("allow");
        expect(sendFn).toHaveBeenCalledTimes(1); // Only called for p3, not p4

        // Clear session allowlist
        bridge.clearSessionAllowlist();

        // Third time: prompts again
        const thirdPromise = bridge.requestPermission({
          requestId: "p5",
          toolName: "Bash",
          command: "npm test",
          input: { command: "npm test" },
          cwd: "/workspace",
          riskHint: "medium",
        });
        bridge.resolveRequest("p5", "deny");
        const thirdDecision = await thirdPromise;
        expect(thirdDecision).toBe("deny");
        expect(sendFn).toHaveBeenCalledTimes(2);
      });

      it("times out pending requests to deny", async () => {
        const bridge = new PermissionBridge({
          sendPermRequest: () => {},
          timeoutMs: 30, // 30ms short timeout
        });

        const decision = await bridge.requestPermission({
          requestId: "timeout_req",
          toolName: "Bash",
          command: "npm run build",
          input: { command: "npm run build" },
          cwd: "/workspace",
          riskHint: "medium",
        });

        expect(decision).toBe("deny");
        expect(bridge.hasPendingRequests()).toBe(false);
      });

      it("denies all pending requests when denyAllPending is called", async () => {
        const bridge = new PermissionBridge({
          sendPermRequest: () => {},
          timeoutMs: 10000,
        });

        const p1 = bridge.requestPermission({
          requestId: "abort_1",
          toolName: "Bash",
          command: "npm start",
          input: { command: "npm start" },
          cwd: "/workspace",
          riskHint: "medium",
        });

        const p2 = bridge.requestPermission({
          requestId: "abort_2",
          toolName: "Bash",
          command: "rm -rf /tmp/foo",
          input: { command: "rm -rf /tmp/foo" },
          cwd: "/workspace",
          riskHint: "high",
        });

        expect(bridge.getPendingCount()).toBe(2);

        bridge.denyAllPending("Client disconnected");

        const [d1, d2] = await Promise.all([p1, p2]);
        expect(d1).toBe("deny");
        expect(d2).toBe("deny");
        expect(bridge.hasPendingRequests()).toBe(false);
      });
    });

    describe("FileAuditLogger Unit Tests", () => {
      let tempDir: string;
      let auditFile: string;

      beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "shellmind-audit-test-"));
        auditFile = path.join(tempDir, "audit.log");
      });

      afterEach(async () => {
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch {
          // ignore
        }
      });

      it("appends audit entries and queries them back", async () => {
        const logger = new FileAuditLogger({ filePath: auditFile });

        await logger.log({
          ts: Date.now(),
          deviceId: "dev_1",
          sessionId: "ses_1",
          mode: "agent",
          toolName: "Bash",
          command: "ls -la",
          cwd: "/tmp",
          decision: "auto-allow",
          riskHint: "low",
        });

        await logger.log({
          ts: Date.now(),
          deviceId: "dev_1",
          sessionId: "ses_1",
          mode: "agent",
          toolName: "Bash",
          command: "rm -rf /tmp/foo",
          cwd: "/tmp",
          decision: "allow",
          riskHint: "high",
        });

        const entries = await logger.query({ sessionId: "ses_1" });
        expect(entries).toHaveLength(2);
        expect(entries[0]?.decision).toBe("auto-allow");
        expect(entries[1]?.decision).toBe("allow");
        expect(entries[1]?.command).toBe("rm -rf /tmp/foo");

        // Verify file permissions
        const stat = await fs.stat(auditFile);
        // Mode 0600 (read/write by owner only)
        expect(stat.mode & 0o777).toBe(0o600);
      });

      it("records audit entry before releasing permission in PermissionBridge", async () => {
        const logger = new FileAuditLogger({ filePath: auditFile });

        const bridge = new PermissionBridge({
          auditLogger: logger,
          sendPermRequest: (req) => {
            bridge.resolveRequest(req.requestId, "allow");
          },
        });

        await bridge.requestPermission({
          requestId: "audit_test",
          toolName: "Bash",
          command: "git status",
          input: { command: "git status" },
          cwd: "/workspace",
          riskHint: "low",
        });

        const entries = await logger.query();
        expect(entries.length).toBeGreaterThan(0);
        expect(entries[0]?.toolName).toBe("Bash");
      });

      it("denies execution if audit log write fails", async () => {
        const brokenLogger = {
          log: vi.fn().mockRejectedValue(new Error("Disk full / permission denied")),
        };

        const bridge = new PermissionBridge({
          auditLogger: brokenLogger,
          sendPermRequest: (req) => {
            bridge.resolveRequest(req.requestId, "allow");
          },
        });

        const decision = await bridge.requestPermission({
          requestId: "audit_fail_req",
          toolName: "Bash",
          command: "rm -rf /tmp",
          input: { command: "rm -rf /tmp" },
          cwd: "/workspace",
          riskHint: "high",
        });

        // When audit write fails, tool MUST NOT be allowed
        expect(decision).toBe("deny");
      });
    });
  });
});
