import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { WebSocket } from "ws";
import {
  createPingMessage,
  createHelloMessage,
  createTermOpenMessage,
  createTermInputMessage,
  createTermResizeMessage,
  createSysRequestMessage,
  parseMessage,
  serializeMessage,
  type HelloAckMessage,
  type HelloRejectMessage,
  type PongMessage,
  type TermDataMessage,
  type TermExitMessage,
  type SysMetricsMessage,
  type KnownMessage,
} from "@shellmind/protocol";
import {
  AgentDaemon,
  TailnetTransportServer,
  FileDeviceRegistry,
  NodePtyManager,
  NodeSysInfoProvider,
  isTailnetIp,
} from "./index.js";

describe("Agent Daemon & Transport Integration", () => {
  let tmpDir: string;
  let registryPath: string;
  let registry: FileDeviceRegistry;
  let transport: TailnetTransportServer;
  let terminalManager: NodePtyManager;
  let daemon: AgentDaemon;
  let serverPort: number;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shellmind-agent-test-"));
    registryPath = path.join(tmpDir, "devices.json");
    registry = new FileDeviceRegistry(registryPath);
    transport = new TailnetTransportServer({ allowLocalhost: true });
    terminalManager = new NodePtyManager();
    const sysInfoProvider = new NodeSysInfoProvider();
    daemon = new AgentDaemon(transport, registry, {
      agentVersion: "0.1.0",
      serverName: "ShellMind Test Daemon",
      terminalManager,
      sysInfoProvider,
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

  async function waitForMessage<T extends KnownMessage>(
    messages: string[],
    predicate: (msg: KnownMessage) => msg is T,
    timeoutMs = 3000
  ): Promise<T> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      for (const raw of messages) {
        const parsed = parseMessage(raw);
        if (parsed.success && predicate(parsed.data)) {
          return parsed.data;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`Timeout waiting for message matching predicate after ${timeoutMs}ms`);
  }

  describe("PTY Terminal Streaming & Process Lifecycle", () => {
    it("spawns PTY on term.open, streams stdout via term.data, handles stdin and exit", async () => {
      const pairing = registry.createPairing("Terminal Test Client");
      const ws = new WebSocket(`ws://127.0.0.1:${serverPort}`);

      await new Promise<void>((resolve) => ws.on("open", () => resolve()));

      const messages: string[] = [];
      ws.on("message", (data) => messages.push(data.toString("utf-8")));

      // 1. Authenticate with hello
      const hello = createHelloMessage({
        deviceId: pairing.device.id,
        token: pairing.rawToken,
        clientVersion: "1.0.0",
        platform: "cli",
      });
      ws.send(serializeMessage(hello));

      const ack = await waitForMessage(
        messages,
        (m): m is HelloAckMessage => m.type === "hello.ack"
      );
      expect(ack.type).toBe("hello.ack");

      // 2. Open PTY terminal session
      const open = createTermOpenMessage({ cols: 80, rows: 24 });
      ws.send(serializeMessage(open));

      // Wait for shell to emit initial prompt/banner
      const firstData = await waitForMessage(
        messages,
        (m): m is TermDataMessage => m.type === "term.data"
      );
      expect(firstData.type).toBe("term.data");

      // 3. Send command to execute: printf '__MAGIC_ECHO__\n'
      const input = createTermInputMessage({ data: "printf '__MAGIC_ECHO__\\n'\n" });
      ws.send(serializeMessage(input));

      // Wait until output contains our magic string
      const startEchoWait = Date.now();
      let foundEcho = false;
      while (Date.now() - startEchoWait < 3000) {
        const combined = messages
          .map((m) => parseMessage(m))
          .filter((r): r is { success: true; data: KnownMessage } => r.success && r.data.type === "term.data")
          .map((r) => (r.data as TermDataMessage).payload.data)
          .join("");
        if (combined.includes("__MAGIC_ECHO__")) {
          foundEcho = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(foundEcho).toBe(true);

      // 4. Send resize message
      const resize = createTermResizeMessage({ cols: 120, rows: 40 });
      ws.send(serializeMessage(resize));

      // 5. Send exit command
      const exitCmd = createTermInputMessage({ data: "exit 0\n" });
      ws.send(serializeMessage(exitCmd));

      // Wait for term.exit message
      const exitMsg = await waitForMessage(
        messages,
        (m): m is TermExitMessage => m.type === "term.exit"
      );
      expect(exitMsg.payload.exitCode).toBe(0);

      ws.close();
    });

    it("terminates child PTY process when connection drops (no orphan processes)", async () => {
      const pairing = registry.createPairing("Orphan Cleanup Client");
      const ws = new WebSocket(`ws://127.0.0.1:${serverPort}`);

      await new Promise<void>((resolve) => ws.on("open", () => resolve()));

      // Authenticate
      ws.send(
        serializeMessage(
          createHelloMessage({
            deviceId: pairing.device.id,
            token: pairing.rawToken,
            clientVersion: "1.0.0",
            platform: "cli",
          })
        )
      );
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Open PTY
      ws.send(serializeMessage(createTermOpenMessage({ cols: 80, rows: 24 })));
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Get active session PID
      const sessions = daemon.getActiveSessions();
      expect(sessions.length).toBe(1);

      // Close the socket to simulate disconnect
      ws.close();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Confirm session is cleared
      expect(daemon.getActiveSessions().length).toBe(0);
    });
  });

  describe("System Telemetry (F006)", () => {
    it("NodeSysInfoProvider gathers valid CPU, memory, and disk metrics", async () => {
      const provider = new NodeSysInfoProvider();
      const metrics = await provider.getMetrics();

      expect(metrics.cpu.cores).toBeGreaterThanOrEqual(1);
      expect(metrics.cpu.percent).toBeGreaterThanOrEqual(0);
      expect(metrics.cpu.percent).toBeLessThanOrEqual(100);

      expect(metrics.memory.totalBytes).toBeGreaterThan(0);
      expect(metrics.memory.usedBytes).toBeGreaterThan(0);
      expect(metrics.memory.percent).toBeGreaterThanOrEqual(0);
      expect(metrics.memory.percent).toBeLessThanOrEqual(100);

      expect(metrics.uptimeSeconds).toBeGreaterThan(0);
      expect(metrics.hostname.length).toBeGreaterThan(0);
      expect(metrics.platform.length).toBeGreaterThan(0);

      if (metrics.disk) {
        expect(metrics.disk.totalBytes).toBeGreaterThan(0);
        expect(metrics.disk.percent).toBeGreaterThanOrEqual(0);
      }
    });

    it("daemon responds to sys.request with sys.metrics envelope", async () => {
      const pairing = registry.createPairing("Telemetry Client");
      const ws = new WebSocket(`ws://127.0.0.1:${serverPort}`);

      await new Promise<void>((resolve) => ws.on("open", () => resolve()));

      const messages: string[] = [];
      ws.on("message", (data) => messages.push(data.toString("utf-8")));

      // 1. Authenticate
      ws.send(
        serializeMessage(
          createHelloMessage({
            deviceId: pairing.device.id,
            token: pairing.rawToken,
            clientVersion: "1.0.0",
            platform: "ios",
          })
        )
      );

      await waitForMessage(
        messages,
        (m): m is HelloAckMessage => m.type === "hello.ack"
      );

      // 2. Send sys.request
      ws.send(serializeMessage(createSysRequestMessage()));

      const metricsMsg = await waitForMessage(
        messages,
        (m): m is SysMetricsMessage => m.type === "sys.metrics"
      );

      expect(metricsMsg.type).toBe("sys.metrics");
      expect(metricsMsg.payload.cpu.cores).toBeGreaterThanOrEqual(1);
      expect(metricsMsg.payload.memory.totalBytes).toBeGreaterThan(0);
      expect(metricsMsg.payload.uptimeSeconds).toBeGreaterThan(0);

      ws.close();
    });
  });
});
