import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebSocketServer, WebSocket as WsClient } from "ws";
import {
  parseMessage,
  serializeMessage,
  createHelloAckMessage,
  createHelloRejectMessage,
  createPongMessage,
  type HelloMessage,
  type PingMessage,
} from "@shellmind/protocol";
import { parsePairingPayload } from "./pairing.js";
import { MemorySecureStorage, ExpoSecureStoreAdapter } from "./storage.js";
import { AgentClient } from "./client.js";

describe("Mobile Package Unit & Integration Tests", () => {
  describe("Pairing Payload Parser & Validator", () => {
    it("parses valid pairing json payload", () => {
      const raw = JSON.stringify({
        deviceId: "dev_test123",
        token: "tok_secret456",
        host: "100.80.90.100",
        port: 4242,
      });

      const res = parsePairingPayload(raw);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.deviceId).toBe("dev_test123");
        expect(res.data.token).toBe("tok_secret456");
        expect(res.data.host).toBe("100.80.90.100");
        expect(res.data.port).toBe(4242);
      }
    });

    it("rejects empty or whitespace string", () => {
      const res = parsePairingPayload("   ");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toMatch(/empty/);
      }
    });

    it("rejects invalid json syntax", () => {
      const res = parsePairingPayload("not-json-at-all");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toMatch(/Invalid JSON/);
      }
    });

    it("rejects missing dev_ prefix in deviceId", () => {
      const res = parsePairingPayload(
        JSON.stringify({
          deviceId: "invalid_id",
          token: "tok_secret456",
          host: "100.80.90.100",
          port: 4242,
        })
      );
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toMatch(/dev_/);
      }
    });

    it("rejects missing tok_ prefix in token", () => {
      const res = parsePairingPayload(
        JSON.stringify({
          deviceId: "dev_test123",
          token: "raw_bad_token",
          host: "100.80.90.100",
          port: 4242,
        })
      );
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toMatch(/tok_/);
      }
    });

    it("rejects invalid or out of range port", () => {
      const res = parsePairingPayload(
        JSON.stringify({
          deviceId: "dev_test123",
          token: "tok_secret456",
          host: "100.80.90.100",
          port: 70000,
        })
      );
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toMatch(/port number/);
      }
    });
  });

  describe("Secure Storage Abstraction", () => {
    it("stores, retrieves, and deletes values in MemorySecureStorage", async () => {
      const storage = new MemorySecureStorage();
      expect(await storage.getItem("tok")).toBeNull();

      await storage.setItem("tok", "tok_xyz");
      expect(await storage.getItem("tok")).toBe("tok_xyz");

      await storage.deleteItem("tok");
      expect(await storage.getItem("tok")).toBeNull();
    });

    it("falls back gracefully in ExpoSecureStoreAdapter", async () => {
      const adapter = new ExpoSecureStoreAdapter();
      expect(await adapter.getItem("key")).toBeNull();

      await adapter.setItem("key", "val123");
      expect(await adapter.getItem("key")).toBe("val123");

      await adapter.deleteItem("key");
      expect(await adapter.getItem("key")).toBeNull();
    });
  });

  describe("AgentClient Socket Lifecycle & Handshake Flow", () => {
    let wss: WebSocketServer;
    let serverPort: number;

    beforeEach(async () => {
      wss = new WebSocketServer({ port: 0, host: "127.0.0.1" });
      await new Promise<void>((resolve) => wss.on("listening", () => resolve()));
      const addr = wss.address();
      serverPort = typeof addr === "object" && addr !== null ? addr.port : 0;
    });

    afterEach(async () => {
      await new Promise<void>((resolve) => {
        wss.close(() => resolve());
      });
    });

    it("connects, sends hello handshake, transitions to Online, and measures RTT", async () => {
      wss.on("connection", (ws) => {
        ws.on("message", (data) => {
          const parsed = parseMessage(data.toString("utf-8"));
          if (!parsed.success) return;

          if (parsed.data.type === "hello") {
            const hello = parsed.data as HelloMessage;
            expect(hello.payload.deviceId).toBe("dev_valid");
            expect(hello.payload.token).toBe("tok_valid");

            const ack = createHelloAckMessage(
              {
                sessionId: "ses_unit_test",
                agentVersion: "0.1.0",
                serverName: "Test Desktop Host",
              },
              { sessionId: "ses_unit_test" }
            );
            ws.send(serializeMessage(ack));
          } else if (parsed.data.type === "ping") {
            const ping = parsed.data as PingMessage;
            const pong = createPongMessage(
              {
                nonce: ping.payload.nonce,
                receivedAt: Date.now(),
              },
              { sessionId: "ses_unit_test" }
            );
            ws.send(serializeMessage(pong));
          }
        });
      });

      const client = new AgentClient({
        webSocketFactory: (url) => new WsClient(url) as unknown as WebSocket,
        pingIntervalMs: 50,
      });

      client.connect({
        deviceId: "dev_valid",
        token: "tok_valid",
        host: "127.0.0.1",
        port: serverPort,
      });

      // Wait for handshake
      await new Promise((resolve) => setTimeout(resolve, 80));

      const onlineState = client.getState();
      expect(onlineState.status).toBe("online");
      expect(onlineState.sessionId).toBe("ses_unit_test");
      expect(onlineState.serverName).toBe("Test Desktop Host");
      expect(onlineState.agentVersion).toBe("0.1.0");

      // Wait for ping-pong
      client.sendPing();
      await new Promise((resolve) => setTimeout(resolve, 80));

      const pingState = client.getState();
      expect(pingState.lastRttMs).toBeTypeOf("number");
      expect(pingState.lastRttMs).toBeGreaterThanOrEqual(0);

      client.disconnect();
      expect(client.getState().status).toBe("disconnected");
    });

    it("transitions to Error state when handshake is rejected with FORBIDDEN", async () => {
      wss.on("connection", (ws) => {
        ws.on("message", (data) => {
          const parsed = parseMessage(data.toString("utf-8"));
          if (!parsed.success) return;

          if (parsed.data.type === "hello") {
            const reject = createHelloRejectMessage({
              code: "FORBIDDEN",
              message: "Invalid device token",
            });
            ws.send(serializeMessage(reject));
            ws.close();
          }
        });
      });

      const client = new AgentClient({
        webSocketFactory: (url) => new WsClient(url) as unknown as WebSocket,
      });

      client.connect({
        deviceId: "dev_unknown",
        token: "tok_bad",
        host: "127.0.0.1",
        port: serverPort,
      });

      await new Promise((resolve) => setTimeout(resolve, 80));

      const state = client.getState();
      expect(state.status).toBe("error");
      expect(state.errorMessage).toMatch(/Invalid device credentials/);
    });

    it("transitions to Error state when handshake is rejected with REVOKED", async () => {
      wss.on("connection", (ws) => {
        ws.on("message", (data) => {
          const parsed = parseMessage(data.toString("utf-8"));
          if (!parsed.success) return;

          if (parsed.data.type === "hello") {
            const reject = createHelloRejectMessage({
              code: "REVOKED",
              message: "Device pairing has been revoked",
            });
            ws.send(serializeMessage(reject));
            ws.close();
          }
        });
      });

      const client = new AgentClient({
        webSocketFactory: (url) => new WsClient(url) as unknown as WebSocket,
      });

      client.connect({
        deviceId: "dev_revoked",
        token: "tok_revoked",
        host: "127.0.0.1",
        port: serverPort,
      });

      await new Promise((resolve) => setTimeout(resolve, 80));

      const state = client.getState();
      expect(state.status).toBe("error");
      expect(state.errorMessage).toMatch(/revoked/);
    });

    it("handles connection refused and transitions to error", async () => {
      const client = new AgentClient({
        webSocketFactory: (url) => new WsClient(url) as unknown as WebSocket,
      });

      // Port 1 is not listening
      client.connect({
        deviceId: "dev_x",
        token: "tok_x",
        host: "127.0.0.1",
        port: 1,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const state = client.getState();
      expect(state.status).toBe("error");
      expect(state.errorMessage).toMatch(/failed/i);
    });
  });
});
