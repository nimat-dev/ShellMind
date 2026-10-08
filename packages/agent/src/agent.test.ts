import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { WebSocket } from "ws";
import {
  createPingMessage,
  createHelloMessage,
  parseMessage,
  serializeMessage,
  type HelloAckMessage,
  type HelloRejectMessage,
  type PongMessage,
} from "@shellmind/protocol";
import {
  AgentDaemon,
  TailnetTransportServer,
  FileDeviceRegistry,
  isTailnetIp,
} from "./index.js";

describe("Agent Daemon & Transport Integration", () => {
  let tmpDir: string;
  let registryPath: string;
  let registry: FileDeviceRegistry;
  let transport: TailnetTransportServer;
  let daemon: AgentDaemon;
  let serverPort: number;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shellmind-agent-test-"));
    registryPath = path.join(tmpDir, "devices.json");
    registry = new FileDeviceRegistry(registryPath);
    transport = new TailnetTransportServer({ allowLocalhost: true });
    daemon = new AgentDaemon(transport, registry, {
      agentVersion: "0.1.0",
      serverName: "ShellMind Test Daemon",
    });

    const listener = await daemon.start({ host: "127.0.0.1", port: 0 });
    serverPort = listener.address().port;
  });

  afterEach(async () => {
    await daemon.stop();
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe("Tailnet IP detection and binding rules", () => {
    it("correctly identifies Tailscale CGNAT IPs", () => {
      expect(isTailnetIp("100.64.0.1")).toBe(true);
      expect(isTailnetIp("100.100.50.25")).toBe(true);
      expect(isTailnetIp("100.127.255.254")).toBe(true);
      expect(isTailnetIp("100.128.0.1")).toBe(false);
      expect(isTailnetIp("192.168.1.1")).toBe(false);
      expect(isTailnetIp("127.0.0.1")).toBe(false);
    });

    it("refuses to bind to 0.0.0.0", async () => {
      const strictTransport = new TailnetTransportServer();
      await expect(strictTransport.listen({ host: "0.0.0.0", port: 0 })).rejects.toThrow(
        /Refusing to bind to 0.0.0.0/
      );
    });
  });

  describe("Device Registry security and file permissions", () => {
    it("stores device token as SHA-256 hash and sets mode 0600", () => {
      const pairing = registry.createPairing("Nimat iPhone");
      expect(pairing.rawToken.startsWith("tok_")).toBe(true);
      expect(pairing.device.tokenHash).not.toBe(pairing.rawToken);

      // Verify file permissions
      const stat = fs.statSync(registryPath);
      // Mode 0600 mask: S_IRUSR | S_IWUSR
      const fileMode = stat.mode & 0o777;
      expect(fileMode).toBe(0o600);

      // Verify raw token is never written to disk
      const fileContent = fs.readFileSync(registryPath, "utf-8");
      expect(fileContent.includes(pairing.rawToken)).toBe(false);
      expect(fileContent.includes(pairing.device.tokenHash)).toBe(true);
    });
  });

  describe("Socket handshake & authentication flow", () => {
    it("completes happy path: valid hello -> hello.ack -> ping -> pong", async () => {
      const pairing = registry.createPairing("Phone Client");
      const ws = new WebSocket(`ws://127.0.0.1:${serverPort}`);

      await new Promise<void>((resolve) => ws.on("open", () => resolve()));

      const messages: string[] = [];
      ws.on("message", (data) => messages.push(data.toString("utf-8")));

      // 1. Send Hello handshake
      const hello = createHelloMessage({
        deviceId: pairing.device.id,
        token: pairing.rawToken,
        clientVersion: "1.0.0",
        platform: "ios",
      });
      ws.send(serializeMessage(hello));

      // Wait for hello.ack
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(messages.length).toBe(1);

      const ackResult = parseMessage<HelloAckMessage>(messages[0]!);
      expect(ackResult.success).toBe(true);
      if (ackResult.success) {
        expect(ackResult.data.type).toBe("hello.ack");
        expect(ackResult.data.payload.sessionId.startsWith("ses_")).toBe(true);
        expect(ackResult.data.payload.agentVersion).toBe("0.1.0");
      }

      // 2. Send Ping
      const ping = createPingMessage({ nonce: "rtt-check-1" });
      ws.send(serializeMessage(ping));

      // Wait for pong
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(messages.length).toBe(2);

      const pongResult = parseMessage<PongMessage>(messages[1]!);
      expect(pongResult.success).toBe(true);
      if (pongResult.success) {
        expect(pongResult.data.type).toBe("pong");
        expect(pongResult.data.payload.nonce).toBe("rtt-check-1");
        expect(pongResult.data.payload.receivedAt).toBeDefined();
      }

      ws.close();
    });

    it("rejects invalid token: sends hello.reject (FORBIDDEN) and terminates socket", async () => {
      const pairing = registry.createPairing("Phone Client");
      const ws = new WebSocket(`ws://127.0.0.1:${serverPort}`);

      await new Promise<void>((resolve) => ws.on("open", () => resolve()));

      const messages: string[] = [];
      let closed = false;
      ws.on("message", (data) => messages.push(data.toString("utf-8")));
      ws.on("close", () => {
        closed = true;
      });

      const hello = createHelloMessage({
        deviceId: pairing.device.id,
        token: "wrong_token_value",
        clientVersion: "1.0.0",
        platform: "ios",
      });
      ws.send(serializeMessage(hello));

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(messages.length).toBe(1);
      const reject = parseMessage<HelloRejectMessage>(messages[0]!);
      expect(reject.success).toBe(true);
      if (reject.success) {
        expect(reject.data.type).toBe("hello.reject");
        expect(reject.data.payload.code).toBe("FORBIDDEN");
      }
      expect(closed).toBe(true);
    });

    it("rejects revoked device: sends hello.reject (REVOKED) and closes socket", async () => {
      const pairing = registry.createPairing("Phone Client");
      await registry.revokeDevice(pairing.device.id);

      const ws = new WebSocket(`ws://127.0.0.1:${serverPort}`);
      await new Promise<void>((resolve) => ws.on("open", () => resolve()));

      const messages: string[] = [];
      let closed = false;
      ws.on("message", (data) => messages.push(data.toString("utf-8")));
      ws.on("close", () => {
        closed = true;
      });

      const hello = createHelloMessage({
        deviceId: pairing.device.id,
        token: pairing.rawToken,
        clientVersion: "1.0.0",
        platform: "ios",
      });
      ws.send(serializeMessage(hello));

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(messages.length).toBe(1);
      const reject = parseMessage<HelloRejectMessage>(messages[0]!);
      expect(reject.success).toBe(true);
      if (reject.success) {
        expect(reject.data.type).toBe("hello.reject");
        expect(reject.data.payload.code).toBe("REVOKED");
      }
      expect(closed).toBe(true);
    });

    it("rejects premature message when unauthenticated: sends hello.reject (UNAUTHORIZED) and closes", async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${serverPort}`);
      await new Promise<void>((resolve) => ws.on("open", () => resolve()));

      const messages: string[] = [];
      let closed = false;
      ws.on("message", (data) => messages.push(data.toString("utf-8")));
      ws.on("close", () => {
        closed = true;
      });

      // Send ping before hello
      const ping = createPingMessage({ nonce: "unauthenticated" });
      ws.send(serializeMessage(ping));

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(messages.length).toBe(1);
      const reject = parseMessage<HelloRejectMessage>(messages[0]!);
      expect(reject.success).toBe(true);
      if (reject.success) {
        expect(reject.data.type).toBe("hello.reject");
        expect(reject.data.payload.code).toBe("UNAUTHORIZED");
      }
      expect(closed).toBe(true);
    });

    it("rejects malformed handshake json", async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${serverPort}`);
      await new Promise<void>((resolve) => ws.on("open", () => resolve()));

      const messages: string[] = [];
      let closed = false;
      ws.on("message", (data) => messages.push(data.toString("utf-8")));
      ws.on("close", () => {
        closed = true;
      });

      ws.send("NOT_VALID_JSON");

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(messages.length).toBe(1);
      const reject = parseMessage<HelloRejectMessage>(messages[0]!);
      expect(reject.success).toBe(true);
      if (reject.success) {
        expect(reject.data.type).toBe("hello.reject");
        expect(reject.data.payload.code).toBe("MALFORMED_HANDSHAKE");
      }
      expect(closed).toBe(true);
    });
  });
});
