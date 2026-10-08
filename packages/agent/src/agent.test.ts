import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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
  createAgentPromptMessage,
  createAgentAbortMessage,
  createProjectListMessage,
  createProjectSetMessage,
  createPermResponseMessage,
  createChatHistoryReqMessage,
  parseMessage,
  serializeMessage,
  type HelloAckMessage,
  type HelloRejectMessage,
  type PongMessage,
  type TermDataMessage,
  type TermExitMessage,
  type SysMetricsMessage,
  type AgentStreamMessage,
  type ProjectListRespMessage,
  type ProjectSetRespMessage,
  type PermRequestMessage,
  type ChatHistoryRespMessage,
  type KnownMessage,
} from "@shellmind/protocol";
import {
  AgentDaemon,
  TailnetTransportServer,
  FileDeviceRegistry,
  FileTranscriptStore,
  NodePtyManager,
  NodeSysInfoProvider,
  NodeProjectManager,
  PermissionBridge,
  FileAuditLogger,
  type IClaudeDriver,
  type ClaudeTurnOptions,
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
  let mockClaudeDriver: IClaudeDriver;
  let projectManager: NodeProjectManager;
  let auditLogger: FileAuditLogger;
  let permissionBridge: PermissionBridge;
  let transcriptStore: FileTranscriptStore;
  let transcriptsDir: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shellmind-agent-test-"));
    registryPath = path.join(tmpDir, "devices.json");
    registry = new FileDeviceRegistry(registryPath);
    transcriptsDir = path.join(tmpDir, "transcripts");
    transcriptStore = new FileTranscriptStore(transcriptsDir);
    transport = new TailnetTransportServer({ allowLocalhost: true });
    terminalManager = new NodePtyManager();
    const sysInfoProvider = new NodeSysInfoProvider();
    projectManager = new NodeProjectManager({ initialCwd: tmpDir });
    const auditPath = path.join(tmpDir, "audit.log");
    auditLogger = new FileAuditLogger({ filePath: auditPath });
    permissionBridge = new PermissionBridge({ auditLogger });

    mockClaudeDriver = {
      isBusy: vi.fn().mockReturnValue(false),
      abortTurn: vi.fn().mockResolvedValue(true),
      runTurn: vi.fn().mockImplementation(async (opts: ClaudeTurnOptions) => {
        if (opts.permissionBridge && opts.prompt.includes("dangerous")) {
          const decision = await opts.permissionBridge.requestPermission({
            requestId: "perm_turn_1",
            toolName: "Bash",
            command: "rm -rf /tmp/danger",
            input: { command: "rm -rf /tmp/danger" },
            cwd: tmpDir,
            riskHint: "high",
          });
          if (decision === "allow") {
            opts.onEvent({ type: "assistant_text", text: "Executed dangerous command" });
          } else {
            opts.onEvent({ type: "assistant_text", text: "Command denied" });
          }
          opts.onEvent({ type: "done", result: "Finished", costUsd: 0, durationMs: 20 });
          return;
        }
        opts.onEvent({ type: "assistant_text", text: `Echo: ${opts.prompt}` });
        opts.onEvent({ type: "done", result: "Done", costUsd: 0, durationMs: 50 });
      }),
    };

    daemon = new AgentDaemon(transport, registry, {
      agentVersion: "0.1.0",
      serverName: "ShellMind Test Daemon",
      terminalManager,
      sysInfoProvider,
      claudeDriver: mockClaudeDriver,
      projectManager,
      permissionBridge,
      auditLogger,
      transcriptStore,
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

  describe("Claude Code AI Bridge & Project Management (F007)", () => {
    it("handles agent.prompt and streams agent.stream events back to client", async () => {
      const pairing = registry.createPairing("Claude Client");
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

      // 2. Send agent.prompt
      ws.send(
        serializeMessage(
          createAgentPromptMessage({
            prompt: "What is in this repository?",
          })
        )
      );

      // Wait for stream messages
      const streamText = await waitForMessage(
        messages,
        (m): m is AgentStreamMessage =>
          m.type === "agent.stream" && m.payload.event.type === "assistant_text"
      );

      expect(streamText.type).toBe("agent.stream");
      if (streamText.payload.event.type === "assistant_text") {
        expect(streamText.payload.event.text).toBe("Echo: What is in this repository?");
      }

      const streamDone = await waitForMessage(
        messages,
        (m): m is AgentStreamMessage =>
          m.type === "agent.stream" && m.payload.event.type === "done"
      );

      expect(streamDone.type).toBe("agent.stream");
      expect(mockClaudeDriver.runTurn).toHaveBeenCalledTimes(1);

      ws.close();
    });

    it("routes agent.abort to driver abortTurn", async () => {
      const pairing = registry.createPairing("Abort Client");
      const ws = new WebSocket(`ws://127.0.0.1:${serverPort}`);

      await new Promise<void>((resolve) => ws.on("open", () => resolve()));

      const messages: string[] = [];
      ws.on("message", (data) => messages.push(data.toString("utf-8")));

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

      ws.send(serializeMessage(createAgentAbortMessage({ reason: "Stop turn" })));
      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(mockClaudeDriver.abortTurn).toHaveBeenCalledWith("Stop turn");
      ws.close();
    });

    it("handles project.list and project.set requests", async () => {
      const pairing = registry.createPairing("Project Client");
      const ws = new WebSocket(`ws://127.0.0.1:${serverPort}`);

      await new Promise<void>((resolve) => ws.on("open", () => resolve()));

      const messages: string[] = [];
      ws.on("message", (data) => messages.push(data.toString("utf-8")));

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

      // 1. project.list
      ws.send(serializeMessage(createProjectListMessage({})));

      const listResp = await waitForMessage(
        messages,
        (m): m is ProjectListRespMessage => m.type === "project.list.resp"
      );

      expect(listResp.type).toBe("project.list.resp");
      expect(listResp.payload.currentCwd).toBe(tmpDir);
      expect(listResp.payload.projects.length).toBeGreaterThanOrEqual(1);

      // 2. project.set
      ws.send(serializeMessage(createProjectSetMessage({ cwd: "/" })));

      const setResp = await waitForMessage(
        messages,
        (m): m is ProjectSetRespMessage => m.type === "project.set.resp"
      );

      expect(setResp.type).toBe("project.set.resp");
      expect(setResp.payload.success).toBe(true);
      expect(setResp.payload.currentCwd).toBe("/");

      ws.close();
    });

    it("aborts active turn on client disconnect (orphan protection)", async () => {
      const pairing = registry.createPairing("Disconnect Client");
      const ws = new WebSocket(`ws://127.0.0.1:${serverPort}`);

      await new Promise<void>((resolve) => ws.on("open", () => resolve()));

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

      await new Promise((resolve) => setTimeout(resolve, 80));

      // Close abruptly
      ws.close();
      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(mockClaudeDriver.abortTurn).toHaveBeenCalledWith("Client disconnected");
    });
  });

  describe("Permission Bridge & Audit Trail Integration (F008)", () => {
    it("routes perm.request to client, releases turn on perm.response allow, and audits before execution", async () => {
      const pairing = registry.createPairing("Perm Allowed Client");
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

      // 2. Prompt that requires permission
      ws.send(
        serializeMessage(
          createAgentPromptMessage({
            prompt: "Please run dangerous action",
          })
        )
      );

      // 3. Client receives perm.request
      const permReqMsg = await waitForMessage(
        messages,
        (m): m is PermRequestMessage => m.type === "perm.request"
      );

      expect(permReqMsg.type).toBe("perm.request");
      expect(permReqMsg.payload.requestId).toBe("perm_turn_1");
      expect(permReqMsg.payload.riskHint).toBe("high");
      expect(permReqMsg.payload.toolName).toBe("Bash");

      // 4. Client responds with allow
      ws.send(
        serializeMessage(
          createPermResponseMessage({
            requestId: permReqMsg.payload.requestId,
            decision: "allow",
            rememberForSession: true,
          })
        )
      );

      // 5. Wait for turn to finish
      const streamText = await waitForMessage(
        messages,
        (m): m is AgentStreamMessage =>
          m.type === "agent.stream" &&
          m.payload.event.type === "assistant_text" &&
          m.payload.event.text.includes("Executed dangerous command")
      );
      expect(streamText).toBeDefined();

      // 6. Verify audit log was recorded on disk
      const entries = await auditLogger.query();
      expect(entries.length).toBeGreaterThan(0);
      const auditEntry = entries.find((e) => e.command === "rm -rf /tmp/danger");
      expect(auditEntry).toBeDefined();
      expect(auditEntry?.decision).toBe("allow");
      expect(auditEntry?.riskHint).toBe("high");

      ws.close();
    });

    it("routes perm.request to client, denies turn on perm.response deny, and audits decision", async () => {
      const pairing = registry.createPairing("Perm Denied Client");
      const ws = new WebSocket(`ws://127.0.0.1:${serverPort}`);

      await new Promise<void>((resolve) => ws.on("open", () => resolve()));

      const messages: string[] = [];
      ws.on("message", (data) => messages.push(data.toString("utf-8")));

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

      ws.send(
        serializeMessage(
          createAgentPromptMessage({
            prompt: "Please run dangerous action",
          })
        )
      );

      const permReqMsg = await waitForMessage(
        messages,
        (m): m is PermRequestMessage => m.type === "perm.request"
      );

      // Client denies
      ws.send(
        serializeMessage(
          createPermResponseMessage({
            requestId: permReqMsg.payload.requestId,
            decision: "deny",
          })
        )
      );

      const streamText = await waitForMessage(
        messages,
        (m): m is AgentStreamMessage =>
          m.type === "agent.stream" &&
          m.payload.event.type === "assistant_text" &&
          m.payload.event.text.includes("Command denied")
      );
      expect(streamText).toBeDefined();

      const entries = await auditLogger.query();
      const auditEntry = entries.find(
        (e) => e.command === "rm -rf /tmp/danger" && e.decision === "deny"
      );
      expect(auditEntry).toBeDefined();

      ws.close();
    });

    it("denies pending permissions on disconnect mid-turn", async () => {
      const pairing = registry.createPairing("Disconnect Mid Perm Client");
      const ws = new WebSocket(`ws://127.0.0.1:${serverPort}`);

      await new Promise<void>((resolve) => ws.on("open", () => resolve()));

      const messages: string[] = [];
      ws.on("message", (data) => messages.push(data.toString("utf-8")));

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

      ws.send(
        serializeMessage(
          createAgentPromptMessage({
            prompt: "Please run dangerous action",
          })
        )
      );

      // Wait for perm.request
      await waitForMessage(
        messages,
        (m): m is PermRequestMessage => m.type === "perm.request"
      );

      expect(permissionBridge.hasPendingRequests()).toBe(true);

      // Abruptly disconnect
      ws.close();
      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(permissionBridge.hasPendingRequests()).toBe(false);
      expect(mockClaudeDriver.abortTurn).toHaveBeenCalledWith("Client disconnected");
    });

    it("revoked device mid-session denies pending prompts and rejects requests", async () => {
      const pairing = registry.createPairing("Revoke Mid Session Client");
      const ws = new WebSocket(`ws://127.0.0.1:${serverPort}`);

      await new Promise<void>((resolve) => ws.on("open", () => resolve()));

      const messages: string[] = [];
      ws.on("message", (data) => messages.push(data.toString("utf-8")));

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

      // Revoke the device while session is open
      await registry.revokeDevice(pairing.device.id);

      // Send a message after revocation
      ws.send(
        serializeMessage(
          createAgentPromptMessage({
            prompt: "Should be rejected",
          })
        )
      );

      await new Promise((resolve) => setTimeout(resolve, 80));

      // Socket should receive error REVOKED and close
      const errorMsg = messages
        .map((m) => {
          try {
            return JSON.parse(m);
          } catch {
            return null;
          }
        })
        .find((m) => m && m.type === "error" && m.payload?.code === "REVOKED");

      expect(errorMsg).toBeDefined();
    });
  });

  describe("FileTranscriptStore Unit Tests (F009)", () => {
    it("appends and retrieves turns in chronological order", async () => {
      const store = new FileTranscriptStore(transcriptsDir, 50);
      const projectKey = "/test/project/alpha";

      await store.appendTurn(projectKey, {
        id: "msg_user_1",
        role: "user",
        text: "Hello world",
        timestamp: 1000,
        status: "done",
      });

      await store.appendTurn(projectKey, {
        id: "msg_ast_1",
        role: "assistant",
        text: "Hi there!",
        timestamp: 1001,
        status: "done",
      });

      const turns = await store.getTranscript(projectKey);
      expect(turns.length).toBe(2);
      expect(turns[0]?.id).toBe("msg_user_1");
      expect(turns[0]?.text).toBe("Hello world");
      expect(turns[1]?.id).toBe("msg_ast_1");
      expect(turns[1]?.text).toBe("Hi there!");
    });

    it("updates existing turn by ID", async () => {
      const store = new FileTranscriptStore(transcriptsDir, 50);
      const projectKey = "/test/project/alpha";

      await store.appendTurn(projectKey, {
        id: "msg_ast_streaming",
        role: "assistant",
        text: "Thinking...",
        timestamp: 1000,
        status: "streaming",
      });

      await store.updateTurn(projectKey, "msg_ast_streaming", {
        text: "Thinking... Done!",
        status: "done",
      });

      const turns = await store.getTranscript(projectKey);
      expect(turns.length).toBe(1);
      expect(turns[0]?.text).toBe("Thinking... Done!");
      expect(turns[0]?.status).toBe("done");
    });

    it("respects maxTurns cap and prunes oldest turns", async () => {
      const store = new FileTranscriptStore(transcriptsDir, 3);
      const projectKey = "/test/project/capped";

      for (let i = 1; i <= 5; i++) {
        await store.appendTurn(projectKey, {
          id: `msg_${i}`,
          role: i % 2 === 1 ? "user" : "assistant",
          text: `Message ${i}`,
          timestamp: 1000 + i,
        });
      }

      const turns = await store.getTranscript(projectKey);
      expect(turns.length).toBe(3);
      expect(turns.map((t) => t.id)).toEqual(["msg_3", "msg_4", "msg_5"]);
    });

    it("isolates transcripts across different project paths", async () => {
      const store = new FileTranscriptStore(transcriptsDir, 10);
      const projA = "/Users/nimat/repoA";
      const projB = "/Users/nimat/repoB";

      await store.appendTurn(projA, {
        id: "msg_a_1",
        role: "user",
        text: "Repo A prompt",
        timestamp: 1000,
      });

      await store.appendTurn(projB, {
        id: "msg_b_1",
        role: "user",
        text: "Repo B prompt",
        timestamp: 1001,
      });

      const turnsA = await store.getTranscript(projA);
      const turnsB = await store.getTranscript(projB);

      expect(turnsA.length).toBe(1);
      expect(turnsA[0]?.id).toBe("msg_a_1");
      expect(turnsB.length).toBe(1);
      expect(turnsB[0]?.id).toBe("msg_b_1");
    });

    it("writes transcript files with mode 0600", async () => {
      const store = new FileTranscriptStore(transcriptsDir, 10);
      const proj = "/test/project/secure";

      await store.appendTurn(proj, {
        id: "msg_sec_1",
        role: "user",
        text: "Secret turn",
        timestamp: 1000,
      });

      const filePath = store.getFilePath(proj);
      expect(fs.existsSync(filePath)).toBe(true);
      const stat = fs.statSync(filePath);
      expect(stat.mode & 0o777).toBe(0o600);
    });

    it("recovers cleanly from corrupted JSON file on disk", async () => {
      const store = new FileTranscriptStore(transcriptsDir, 10);
      const proj = "/test/project/corrupt";
      const filePath = store.getFilePath(proj);

      fs.writeFileSync(filePath, "{ corrupt json ... invalid", { mode: 0o600 });

      const turns = await store.getTranscript(proj);
      expect(turns).toEqual([]);

      // Can still append new turn and restore health
      await store.appendTurn(proj, {
        id: "msg_recovered",
        role: "user",
        text: "Recovered",
        timestamp: 2000,
      });
      const updated = await store.getTranscript(proj);
      expect(updated.length).toBe(1);
      expect(updated[0]?.id).toBe("msg_recovered");
    });

    it("clears transcript file on clearTranscript", async () => {
      const store = new FileTranscriptStore(transcriptsDir, 10);
      const proj = "/test/project/clear";

      await store.appendTurn(proj, {
        id: "msg_clear_1",
        role: "user",
        text: "To clear",
        timestamp: 1000,
      });

      expect((await store.getTranscript(proj)).length).toBe(1);
      await store.clearTranscript(proj);
      expect((await store.getTranscript(proj)).length).toBe(0);
    });
  });

  describe("Daemon Chat History & Session Continuity (F009)", () => {
    it("records user prompt and completed assistant turn into transcript and serves chat.history.req", async () => {
      const pairing = registry.createPairing("Chat History Client");
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

      // 2. Prompt agent
      ws.send(
        serializeMessage(
          createAgentPromptMessage({
            prompt: "List files in repo",
          })
        )
      );

      // Wait for stream done
      await waitForMessage(
        messages,
        (m): m is AgentStreamMessage =>
          m.type === "agent.stream" && m.payload.event.type === "done"
      );

      // 3. Request chat history
      ws.send(
        serializeMessage(
          createChatHistoryReqMessage()
        )
      );

      const historyResp = await waitForMessage(
        messages,
        (m): m is ChatHistoryRespMessage => m.type === "chat.history.resp"
      );

      expect(historyResp.type).toBe("chat.history.resp");
      expect(historyResp.payload.currentCwd).toBe(tmpDir);
      expect(historyResp.payload.turns.length).toBe(2);

      const userTurn = historyResp.payload.turns[0]!;
      expect(userTurn.role).toBe("user");
      expect(userTurn.text).toBe("List files in repo");

      const assistantTurn = historyResp.payload.turns[1]!;
      expect(assistantTurn.role).toBe("assistant");
      expect(assistantTurn.text).toContain("Echo: List files in repo");
      expect(assistantTurn.status).toBe("done");

      ws.close();
    });

    it("resumes session seamlessly on client reconnect without duplicate turns", async () => {
      const pairing = registry.createPairing("Reconnect Session Client");

      // First connection
      const ws1 = new WebSocket(`ws://127.0.0.1:${serverPort}`);
      await new Promise<void>((resolve) => ws1.on("open", () => resolve()));

      const messages1: string[] = [];
      ws1.on("message", (data) => messages1.push(data.toString("utf-8")));

      ws1.send(
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
        messages1,
        (m): m is HelloAckMessage => m.type === "hello.ack"
      );

      ws1.send(
        serializeMessage(
          createAgentPromptMessage({
            prompt: "Initial query",
          })
        )
      );

      await waitForMessage(
        messages1,
        (m): m is AgentStreamMessage =>
          m.type === "agent.stream" && m.payload.event.type === "done"
      );

      ws1.close();
      await new Promise((resolve) => setTimeout(resolve, 80));

      // Reconnect with new connection (simulating app relaunch or network reconnect)
      const ws2 = new WebSocket(`ws://127.0.0.1:${serverPort}`);
      await new Promise<void>((resolve) => ws2.on("open", () => resolve()));

      const messages2: string[] = [];
      ws2.on("message", (data) => messages2.push(data.toString("utf-8")));

      ws2.send(
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
        messages2,
        (m): m is HelloAckMessage => m.type === "hello.ack"
      );

      ws2.send(
        serializeMessage(
          createChatHistoryReqMessage()
        )
      );

      const historyResp = await waitForMessage(
        messages2,
        (m): m is ChatHistoryRespMessage => m.type === "chat.history.resp"
      );

      expect(historyResp.payload.turns.length).toBe(2);
      expect(historyResp.payload.turns[0]?.text).toBe("Initial query");
      expect(historyResp.payload.turns[1]?.text).toContain("Echo: Initial query");

      ws2.close();
    });
  });
});
