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
  });
});
