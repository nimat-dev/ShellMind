import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  createPingMessage,
  createPongMessage,
  createErrorMessage,
  createHelloMessage,
  createHelloAckMessage,
  createHelloRejectMessage,
  createTermOpenMessage,
  createTermInputMessage,
  createTermDataMessage,
  createTermResizeMessage,
  createTermExitMessage,
  generateMessageId,
  PROTOCOL_VERSION,
  parseMessage,
  serializeMessage,
  MessageRegistry,
  EnvelopeBaseSchema,
  createEnvelope,
  PingMessage,
  PongMessage,
  ErrorMessage,
  HelloMessage,
  TermOpenMessage,
  TermInputMessage,
  TermDataMessage,
  TermResizeMessage,
  TermExitMessage,
  createSysRequestMessage,
  createSysMetricsMessage,
  SysRequestMessage,
  SysMetricsMessage,
  createAgentPromptMessage,
  createAgentStreamMessage,
  createAgentAbortMessage,
  createProjectListMessage,
  createProjectListRespMessage,
  createProjectSetMessage,
  createProjectSetRespMessage,
  AgentPromptMessage,
  AgentStreamMessage,
  AgentAbortMessage,
  ProjectListMessage,
  ProjectListRespMessage,
  ProjectSetMessage,
  ProjectSetRespMessage,
  createPermRequestMessage,
  createPermResponseMessage,
  PermRequestMessage,
  PermResponseMessage,
  createChatHistoryReqMessage,
  createChatHistoryRespMessage,
  ChatHistoryReqMessage,
  ChatHistoryRespMessage,
  classifyRisk,
  isReadonlyCommand,
} from "./index.js";

describe("@shellmind/protocol", () => {
  describe("Message ID and Envelope creation", () => {
    it("generates IDs with msg_ prefix", () => {
      const id1 = generateMessageId();
      const id2 = generateMessageId();
      expect(id1.startsWith("msg_")).toBe(true);
      expect(id2.startsWith("msg_")).toBe(true);
      expect(id1).not.toBe(id2);
    });

    it("creates valid Ping message", () => {
      const msg = createPingMessage({ nonce: "test-nonce-123" });
      expect(msg.v).toBe(PROTOCOL_VERSION);
      expect(msg.type).toBe("ping");
      expect(msg.payload.nonce).toBe("test-nonce-123");
      expect(msg.ts).toBeGreaterThan(0);
      expect(msg.id.startsWith("msg_")).toBe(true);
    });

    it("creates valid Pong message", () => {
      const msg = createPongMessage({ nonce: "test-nonce-123", receivedAt: 123456789 });
      expect(msg.v).toBe(PROTOCOL_VERSION);
      expect(msg.type).toBe("pong");
      expect(msg.payload.nonce).toBe("test-nonce-123");
      expect(msg.payload.receivedAt).toBe(123456789);
    });

    it("creates valid Error message", () => {
      const msg = createErrorMessage({
        code: "UNAUTHORIZED",
        message: "Invalid device token",
        details: { attempts: 3 },
      });
      expect(msg.v).toBe(PROTOCOL_VERSION);
      expect(msg.type).toBe("error");
      expect(msg.payload.code).toBe("UNAUTHORIZED");
      expect(msg.payload.message).toBe("Invalid device token");
      expect(msg.payload.details).toEqual({ attempts: 3 });
    });

    it("creates valid Hello handshake messages", () => {
      const hello = createHelloMessage({
        deviceId: "dev_phone123",
        token: "secret_tok_abc",
        clientVersion: "1.0.0",
        platform: "ios",
      });
      expect(hello.type).toBe("hello");
      expect(hello.payload.deviceId).toBe("dev_phone123");
      expect(hello.payload.token).toBe("secret_tok_abc");

      const ack = createHelloAckMessage({
        sessionId: "ses_sess1",
        agentVersion: "0.1.0",
        serverName: "ShellMind Agent",
      });
      expect(ack.type).toBe("hello.ack");
      expect(ack.payload.sessionId).toBe("ses_sess1");

      const reject = createHelloRejectMessage({
        code: "UNAUTHORIZED",
        message: "Token is invalid",
      });
      expect(reject.type).toBe("hello.reject");
      expect(reject.payload.code).toBe("UNAUTHORIZED");
    });
  });

  describe("Round-trip serialization and parsing", () => {
    it("serializes and parses a Ping message correctly", () => {
      const original = createPingMessage({ nonce: "abc-xyz" }, { sessionId: "ses_main_1" });
      const serialized = serializeMessage(original);
      const result = parseMessage<PingMessage>(serialized);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(original);
        expect(result.data.type).toBe("ping");
        expect(result.data.payload.nonce).toBe("abc-xyz");
        expect(result.data.sessionId).toBe("ses_main_1");
      }
    });

    it("serializes and parses a Pong message correctly", () => {
      const original = createPongMessage({ nonce: "abc-xyz", receivedAt: 99999 });
      const serialized = serializeMessage(original);
      const result = parseMessage<PongMessage>(serialized);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(original);
        expect(result.data.type).toBe("pong");
        expect(result.data.payload.receivedAt).toBe(99999);
      }
    });

    it("serializes and parses an Error message correctly", () => {
      const original = createErrorMessage({
        code: "CONNECTION_REFUSED",
        message: "Host not available",
      });
      const serialized = serializeMessage(original);
      const result = parseMessage<ErrorMessage>(serialized);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(original);
        expect(result.data.type).toBe("error");
        expect(result.data.payload.code).toBe("CONNECTION_REFUSED");
      }
    });

    it("serializes and parses Hello handshake messages correctly", () => {
      const hello = createHelloMessage({
        deviceId: "dev_iphone_1",
        token: "pair_tok_999",
        clientVersion: "1.0.0",
        platform: "ios",
      });
      const serialized = serializeMessage(hello);
      const result = parseMessage<HelloMessage>(serialized);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(hello);
        expect(result.data.type).toBe("hello");
        expect(result.data.payload.deviceId).toBe("dev_iphone_1");
      }
    });
  });

  describe("Edge cases and failure paths", () => {
    it("handles malformed JSON gracefully", () => {
      const malformed = "{ this is not valid json }";
      const result = parseMessage(malformed);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("ERR_MALFORMED_JSON");
      }
    });

    it("rejects non-object payloads as invalid envelope", () => {
      const result = parseMessage('"hello string"');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("ERR_INVALID_ENVELOPE");
      }
    });

    it("rejects objects missing 'type' field", () => {
      const result = parseMessage(JSON.stringify({ v: 1, id: "msg_123", ts: 100 }));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("ERR_INVALID_ENVELOPE");
      }
    });

    it("rejects unknown/unregistered message types", () => {
      const unknownMsg = {
        v: 1,
        id: "msg_abc",
        type: "unknown.type.xyz",
        ts: Date.now(),
        payload: {},
      };
      const result = parseMessage(JSON.stringify(unknownMsg));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("ERR_UNKNOWN_MESSAGE_TYPE");
        expect(result.error.message).toContain("unknown.type.xyz");
      }
    });

    it("rejects invalid envelope version", () => {
      const invalidVersion = {
        v: 999, // unsupported version
        id: "msg_abc",
        type: "ping",
        ts: Date.now(),
        payload: {},
      };
      const result = parseMessage(JSON.stringify(invalidVersion));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("ERR_SCHEMA_VALIDATION");
      }
    });

    it("rejects payload exceeding maxBytes size limit", () => {
      const largePayload = {
        v: 1,
        id: "msg_large",
        type: "ping",
        ts: Date.now(),
        payload: { nonce: "a".repeat(1000) },
      };
      const raw = JSON.stringify(largePayload);
      const result = parseMessage(raw, { maxBytes: 100 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("ERR_PAYLOAD_TOO_LARGE");
      }
    });

    it("throws on serializeMessage when exceeding maxBytes", () => {
      const largePayload = {
        v: 1,
        id: "msg_large",
        type: "ping",
        ts: Date.now(),
        payload: { nonce: "a".repeat(500) },
      };
      expect(() => serializeMessage(largePayload, { maxBytes: 50 })).toThrow(/exceeds maximum allowed limit/);
    });

    it("supports registering custom message schemas via registry", () => {
      const customRegistry = new MessageRegistry();
      const customSchema = EnvelopeBaseSchema.extend({
        type: z.literal("custom.greeting"),
        payload: z.object({ greeting: z.string() }),
      });
      customRegistry.register("custom.greeting", customSchema);

      const msg = createEnvelope("custom.greeting", { greeting: "hello tailnet" });
      const serialized = serializeMessage(msg);

      const result = parseMessage(serialized, { registry: customRegistry });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe("custom.greeting");
      }
    });
  });

  describe("Terminal Protocol Messages", () => {
    it("round-trips term.open, term.input, term.data, term.resize, and term.exit", () => {
      const open = parseMessage<TermOpenMessage>(
        serializeMessage(createTermOpenMessage({ cols: 120, rows: 40, cwd: "/home/user" }))
      );
      expect(open.success).toBe(true);
      if (open.success) {
        expect(open.data.type).toBe("term.open");
        expect(open.data.payload.cols).toBe(120);
        expect(open.data.payload.rows).toBe(40);
        expect(open.data.payload.cwd).toBe("/home/user");
      }

      const input = parseMessage<TermInputMessage>(
        serializeMessage(createTermInputMessage({ data: "ls -la\n" }))
      );
      expect(input.success).toBe(true);
      if (input.success) {
        expect(input.data.type).toBe("term.input");
        expect(input.data.payload.data).toBe("ls -la\n");
      }

      const data = parseMessage<TermDataMessage>(
        serializeMessage(createTermDataMessage({ data: "\x1b[32mhello\x1b[0m\r\n" }))
      );
      expect(data.success).toBe(true);
      if (data.success) {
        expect(data.data.type).toBe("term.data");
        expect(data.data.payload.data).toBe("\x1b[32mhello\x1b[0m\r\n");
      }

      const resize = parseMessage<TermResizeMessage>(
        serializeMessage(createTermResizeMessage({ cols: 100, rows: 30 }))
      );
      expect(resize.success).toBe(true);
      if (resize.success) {
        expect(resize.data.type).toBe("term.resize");
        expect(resize.data.payload.cols).toBe(100);
        expect(resize.data.payload.rows).toBe(30);
      }

      const exit = parseMessage<TermExitMessage>(
        serializeMessage(createTermExitMessage({ exitCode: 0, signal: 15 }))
      );
      expect(exit.success).toBe(true);
      if (exit.success) {
        expect(exit.data.type).toBe("term.exit");
        expect(exit.data.payload.exitCode).toBe(0);
        expect(exit.data.payload.signal).toBe(15);
      }
    });
  });

  describe("System Telemetry Protocol Messages", () => {
    it("round-trips sys.request and sys.metrics", () => {
      const req = parseMessage<SysRequestMessage>(
        serializeMessage(createSysRequestMessage({ diskPath: "/System/Volumes/Data" }))
      );
      expect(req.success).toBe(true);
      if (req.success) {
        expect(req.data.type).toBe("sys.request");
        expect(req.data.payload.diskPath).toBe("/System/Volumes/Data");
      }

      const metrics = parseMessage<SysMetricsMessage>(
        serializeMessage(
          createSysMetricsMessage({
            cpu: { percent: 14.5, cores: 8 },
            memory: { usedBytes: 8589934592, totalBytes: 17179869184, percent: 50.0 },
            disk: { usedBytes: 107374182400, totalBytes: 536870912000, percent: 20.0, mount: "/" },
            uptimeSeconds: 3600,
            platform: "darwin",
            hostname: "MacBook-Pro.local",
            collectedAt: Date.now(),
          })
        )
      );
      expect(metrics.success).toBe(true);
      if (metrics.success) {
        expect(metrics.data.type).toBe("sys.metrics");
        expect(metrics.data.payload.cpu.percent).toBe(14.5);
        expect(metrics.data.payload.cpu.cores).toBe(8);
        expect(metrics.data.payload.memory.percent).toBe(50.0);
        expect(metrics.data.payload.disk?.percent).toBe(20.0);
        expect(metrics.data.payload.platform).toBe("darwin");
      }
    });

    it("serializes and parses AgentPromptMessage", () => {
      const original = createAgentPromptMessage(
        { prompt: "Run vitest tests", cwd: "/Users/dev/project" },
        { sessionId: "ses_agent_1" }
      );
      const res = parseMessage<AgentPromptMessage>(serializeMessage(original));
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.type).toBe("agent.prompt");
        expect(res.data.payload.prompt).toBe("Run vitest tests");
        expect(res.data.payload.cwd).toBe("/Users/dev/project");
      }
    });

    it("serializes and parses AgentStreamMessage for various event variants", () => {
      // 1. assistant_text
      const textMsg = createAgentStreamMessage({
        event: { type: "assistant_text", text: "I found 3 test files." },
      });
      const resText = parseMessage<AgentStreamMessage>(serializeMessage(textMsg));
      expect(resText.success).toBe(true);
      if (resText.success) {
        expect(resText.data.payload.event.type).toBe("assistant_text");
        if (resText.data.payload.event.type === "assistant_text") {
          expect(resText.data.payload.event.text).toBe("I found 3 test files.");
        }
      }

      // 2. tool_use
      const toolUseMsg = createAgentStreamMessage({
        event: {
          type: "tool_use",
          toolName: "Bash",
          toolUseId: "tool_123",
          input: { command: "ls -la" },
        },
      });
      const resToolUse = parseMessage<AgentStreamMessage>(serializeMessage(toolUseMsg));
      expect(resToolUse.success).toBe(true);
      if (resToolUse.success) {
        expect(resToolUse.data.payload.event.type).toBe("tool_use");
      }

      // 3. tool_result
      const toolResMsg = createAgentStreamMessage({
        event: {
          type: "tool_result",
          toolUseId: "tool_123",
          content: "file1.txt\nfile2.txt",
          isError: false,
        },
      });
      const resToolRes = parseMessage<AgentStreamMessage>(serializeMessage(toolResMsg));
      expect(resToolRes.success).toBe(true);
      if (resToolRes.success) {
        expect(resToolRes.data.payload.event.type).toBe("tool_result");
      }

      // 4. done
      const doneMsg = createAgentStreamMessage({
        event: {
          type: "done",
          result: "All tasks completed.",
          costUsd: 0.04,
          durationMs: 1200,
        },
      });
      const resDone = parseMessage<AgentStreamMessage>(serializeMessage(doneMsg));
      expect(resDone.success).toBe(true);
      if (resDone.success) {
        expect(resDone.data.payload.event.type).toBe("done");
      }

      // 5. aborted
      const abortMsg = createAgentStreamMessage({
        event: { type: "aborted", reason: "User cancelled" },
      });
      const resAbort = parseMessage<AgentStreamMessage>(serializeMessage(abortMsg));
      expect(resAbort.success).toBe(true);
      if (resAbort.success) {
        expect(resAbort.data.payload.event.type).toBe("aborted");
      }
    });

    it("serializes and parses AgentAbortMessage", () => {
      const original = createAgentAbortMessage({ reason: "Stop execution" });
      const res = parseMessage<AgentAbortMessage>(serializeMessage(original));
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.type).toBe("agent.abort");
        expect(res.data.payload.reason).toBe("Stop execution");
      }
    });

    it("serializes and parses ProjectList and ProjectListResp messages", () => {
      const listReq = createProjectListMessage({});
      const resReq = parseMessage<ProjectListMessage>(serializeMessage(listReq));
      expect(resReq.success).toBe(true);

      const listResp = createProjectListRespMessage({
        currentCwd: "/workspace/ShellMind",
        projects: [
          { name: "ShellMind", path: "/workspace/ShellMind" },
          { name: "MyApp", path: "/workspace/MyApp" },
        ],
      });
      const resResp = parseMessage<ProjectListRespMessage>(serializeMessage(listResp));
      expect(resResp.success).toBe(true);
      if (resResp.success) {
        expect(resResp.data.type).toBe("project.list.resp");
        expect(resResp.data.payload.projects).toHaveLength(2);
        expect(resResp.data.payload.currentCwd).toBe("/workspace/ShellMind");
      }
    });

    it("serializes and parses ProjectSet and ProjectSetResp messages", () => {
      const setReq = createProjectSetMessage({ cwd: "/workspace/ShellMind" });
      const resReq = parseMessage<ProjectSetMessage>(serializeMessage(setReq));
      expect(resReq.success).toBe(true);

      const setResp = createProjectSetRespMessage({
        success: true,
        currentCwd: "/workspace/ShellMind",
      });
      const resResp = parseMessage<ProjectSetRespMessage>(serializeMessage(setResp));
      expect(resResp.success).toBe(true);
      if (resResp.success) {
        expect(resResp.data.type).toBe("project.set.resp");
        expect(resResp.data.payload.success).toBe(true);
      }
    });

    it("serializes and parses PermRequest and PermResponse messages", () => {
      const permReq = createPermRequestMessage({
        requestId: "perm_1",
        toolName: "Bash",
        command: "rm -rf /tmp/test",
        input: { command: "rm -rf /tmp/test" },
        cwd: "/workspace/ShellMind",
        riskHint: "high",
        description: "Delete temporary directory",
      });
      const resReq = parseMessage<PermRequestMessage>(serializeMessage(permReq));
      expect(resReq.success).toBe(true);
      if (resReq.success) {
        expect(resReq.data.type).toBe("perm.request");
        expect(resReq.data.payload.requestId).toBe("perm_1");
        expect(resReq.data.payload.riskHint).toBe("high");
      }

      const permResp = createPermResponseMessage({
        requestId: "perm_1",
        decision: "allow",
        rememberForSession: true,
      });
      const resResp = parseMessage<PermResponseMessage>(serializeMessage(permResp));
      expect(resResp.success).toBe(true);
      if (resResp.success) {
        expect(resResp.data.type).toBe("perm.response");
        expect(resResp.data.payload.decision).toBe("allow");
        expect(resResp.data.payload.rememberForSession).toBe(true);
      }
    });

    it("serializes and parses ChatHistoryReq and ChatHistoryResp messages", () => {
      const historyReq = createChatHistoryReqMessage({
        projectCwd: "/workspace/ShellMind",
        limit: 50,
      });
      const resReq = parseMessage<ChatHistoryReqMessage>(serializeMessage(historyReq));
      expect(resReq.success).toBe(true);
      if (resReq.success) {
        expect(resReq.data.type).toBe("chat.history.req");
        expect(resReq.data.payload.projectCwd).toBe("/workspace/ShellMind");
        expect(resReq.data.payload.limit).toBe(50);
      }

      const historyResp = createChatHistoryRespMessage({
        currentCwd: "/workspace/ShellMind",
        turns: [
          {
            id: "msg_user_1",
            role: "user",
            text: "Hello Claude",
            timestamp: 1000,
          },
          {
            id: "msg_asst_1",
            role: "assistant",
            text: "Hello! How can I help?",
            timestamp: 1002,
            status: "done",
            toolEvents: [
              {
                type: "assistant_text",
                text: "Hello! How can I help?",
              },
            ],
          },
        ],
      });
      const resResp = parseMessage<ChatHistoryRespMessage>(serializeMessage(historyResp));
      expect(resResp.success).toBe(true);
      if (resResp.success) {
        expect(resResp.data.type).toBe("chat.history.resp");
        expect(resResp.data.payload.currentCwd).toBe("/workspace/ShellMind");
        expect(resResp.data.payload.turns).toHaveLength(2);
        expect(resResp.data.payload.turns[1]?.status).toBe("done");
      }
    });

    describe("Permission Risk Classification & Readonly Detection", () => {
      it("correctly classifies safe read-only commands as low risk", () => {
        expect(classifyRisk("Bash", { command: "ls -la" }).riskHint).toBe("low");
        expect(classifyRisk("Bash", { command: "pwd" }).riskHint).toBe("low");
        expect(classifyRisk("Bash", { command: "git status" }).riskHint).toBe("low");
        expect(classifyRisk("Bash", { command: "git diff" }).riskHint).toBe("low");
        expect(classifyRisk("Bash", { command: "git log -n 5" }).riskHint).toBe("low");
        expect(classifyRisk("Bash", { command: "cat file.txt" }).riskHint).toBe("low");
        expect(classifyRisk("Read", { file_path: "foo.ts" }).riskHint).toBe("low");
        expect(classifyRisk("GlobTool", { pattern: "*.ts" }).riskHint).toBe("low");
        expect(classifyRisk("GrepTool", { pattern: "test" }).riskHint).toBe("low");

        expect(isReadonlyCommand("Bash", { command: "git status" })).toBe(true);
        expect(isReadonlyCommand("Read", { file_path: "foo.ts" })).toBe(true);
      });

      it("classifies destructive commands as high risk", () => {
        expect(classifyRisk("Bash", { command: "rm -rf /" }).riskHint).toBe("high");
        expect(classifyRisk("Bash", { command: "sudo rm file" }).riskHint).toBe("high");
        expect(classifyRisk("Bash", { command: "git reset --hard" }).riskHint).toBe("high");
        expect(classifyRisk("Bash", { command: "git clean -fd" }).riskHint).toBe("high");
        expect(classifyRisk("Bash", { command: "git push -f origin main" }).riskHint).toBe("high");
        expect(classifyRisk("Bash", { command: "echo hello && rm -rf foo" }).riskHint).toBe("high");
        expect(classifyRisk("Bash", { command: "echo $(rm foo)" }).riskHint).toBe("high");

        expect(isReadonlyCommand("Bash", { command: "rm -rf /" })).toBe(false);
      });

      it("classifies standard mutating commands as medium risk", () => {
        expect(classifyRisk("Bash", { command: "npm test" }).riskHint).toBe("medium");
        expect(classifyRisk("Bash", { command: "touch newfile.ts" }).riskHint).toBe("medium");
        expect(classifyRisk("Write", { file_path: "foo.ts", content: "bar" }).riskHint).toBe("medium");
        expect(classifyRisk("Edit", { file_path: "foo.ts" }).riskHint).toBe("medium");
        expect(classifyRisk("SomeCustomTool", {}).riskHint).toBe("medium");

        expect(isReadonlyCommand("Write", {})).toBe(false);
      });
    });
  });
});
