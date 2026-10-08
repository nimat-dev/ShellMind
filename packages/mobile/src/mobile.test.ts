import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebSocketServer, WebSocket as WsClient } from "ws";
import {
  parseMessage,
  serializeMessage,
  createHelloAckMessage,
  createHelloRejectMessage,
  createPongMessage,
  createTermDataMessage,
  createTermExitMessage,
  createSysMetricsMessage,
  createAgentStreamMessage,
  createProjectListRespMessage,
  createProjectSetRespMessage,
  type HelloMessage,
  type PingMessage,
  type TermInputMessage,
  type SysMetricsPayload,
  type AgentPromptMessage,
  type AgentAbortMessage,
  type AgentStreamEvent,
  type ProjectListRespPayload,
  type ProjectSetRespPayload,
  type ProjectSetMessage,
} from "@shellmind/protocol";
import { parsePairingPayload } from "./pairing.js";
import { MemorySecureStorage, ExpoSecureStoreAdapter } from "./storage.js";
import { AgentClient } from "./client.js";
import { TerminalBuffer } from "./terminal/buffer.js";

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

  describe("Terminal Client Streaming & Interaction (F005)", () => {
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

    it("handles term.open, streams term.data to buffer, sends input, resize, and receives exit", async () => {
      const receivedMessages: string[] = [];

      wss.on("connection", (ws) => {
        ws.on("message", (data) => {
          const raw = data.toString("utf-8");
          receivedMessages.push(raw);
          const parsed = parseMessage(raw);
          if (!parsed.success) return;

          if (parsed.data.type === "hello") {
            const ack = createHelloAckMessage(
              {
                sessionId: "ses_term_123",
                agentVersion: "0.1.0",
                serverName: "MacBook Pro",
              },
              { sessionId: "ses_term_123" }
            );
            ws.send(serializeMessage(ack));
          } else if (parsed.data.type === "term.open") {
            // Emulate agent sending initial shell prompt
            const banner = createTermDataMessage(
              { data: "\x1b[32m➜  shellmind\x1b[0m \x1b[36m~\x1b[0m \n" },
              { sessionId: "ses_term_123" }
            );
            ws.send(serializeMessage(banner));
          } else if (parsed.data.type === "term.input") {
            const input = parsed.data as TermInputMessage;
            if (input.payload.data === "echo ok\n") {
              const echoResp = createTermDataMessage(
                { data: "ok\n" },
                { sessionId: "ses_term_123" }
              );
              ws.send(serializeMessage(echoResp));
            } else if (input.payload.data === "exit\n") {
              const exitMsg = createTermExitMessage(
                { exitCode: 0 },
                { sessionId: "ses_term_123" }
              );
              ws.send(serializeMessage(exitMsg));
            }
          }
        });
      });

      const client = new AgentClient({
        webSocketFactory: (url) => new WsClient(url) as unknown as WebSocket,
      });

      const buffer = new TerminalBuffer();
      const outputChunks: string[] = [];
      let exitResult: { code: number; signal?: number } | null = null;

      client.onTerminalData((chunk) => {
        outputChunks.push(chunk);
        buffer.write(chunk);
      });

      client.onTerminalExit((exitCode, signal) => {
        exitResult = { code: exitCode, signal };
      });

      // 1. Connect
      client.connect({
        deviceId: "dev_mobile",
        token: "tok_mobile",
        host: "127.0.0.1",
        port: serverPort,
      });

      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(client.getState().status).toBe("online");

      // 2. Open terminal
      client.openTerminal({ cols: 100, rows: 30 });
      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(outputChunks.length).toBeGreaterThanOrEqual(1);
      expect(buffer.getPlainText()).toContain("➜  shellmind");

      // 3. Send command input
      client.sendTerminalInput("echo ok\n");
      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(buffer.getPlainText()).toContain("ok");

      // 4. Resize terminal
      client.resizeTerminal(120, 40);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const hasResizeMsg = receivedMessages.some((m) => {
        const parsed = parseMessage(m);
        return parsed.success && parsed.data.type === "term.resize";
      });
      expect(hasResizeMsg).toBe(true);

      // 5. Send exit
      client.sendTerminalInput("exit\n");
      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(exitResult).toEqual({ code: 0, signal: undefined });
      client.disconnect();
    });
  });

  describe("System Metrics Telemetry Client Flow (F006)", () => {
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

    it("sends sys.request and dispatches sys.metrics to listeners", async () => {
      const mockMetricsPayload: SysMetricsPayload = {
        cpu: { percent: 42.5, cores: 8 },
        memory: {
          totalBytes: 16 * 1024 * 1024 * 1024,
          usedBytes: 8 * 1024 * 1024 * 1024,
          percent: 50.0,
        },
        disk: {
          totalBytes: 500 * 1024 * 1024 * 1024,
          usedBytes: 250 * 1024 * 1024 * 1024,
          percent: 50.0,
          mount: "/",
        },
        uptimeSeconds: 7200,
        platform: "darwin",
        hostname: "test-node",
        collectedAt: Date.now(),
      };

      wss.on("connection", (ws) => {
        ws.on("message", (data) => {
          const raw = data.toString("utf-8");
          const parsed = parseMessage(raw);
          if (!parsed.success) return;

          if (parsed.data.type === "hello") {
            const ack = createHelloAckMessage(
              {
                sessionId: "ses_sys_123",
                agentVersion: "0.1.0",
                serverName: "MacBook Pro",
              },
              { sessionId: "ses_sys_123" }
            );
            ws.send(serializeMessage(ack));
          } else if (parsed.data.type === "sys.request") {
            const metricsMsg = createSysMetricsMessage(mockMetricsPayload, {
              sessionId: "ses_sys_123",
            });
            ws.send(serializeMessage(metricsMsg));
          }
        });
      });

      const client = new AgentClient({
        webSocketFactory: (url) => new WsClient(url) as unknown as WebSocket,
      });

      const received: SysMetricsPayload[] = [];
      const unsub = client.onSystemMetrics((m) => {
        received.push(m);
      });

      client.connect({
        deviceId: "dev_mobile",
        token: "tok_mobile",
        host: "127.0.0.1",
        port: serverPort,
      });

      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(client.getState().status).toBe("online");

      // Request metrics
      client.requestSystemMetrics();
      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(received).toHaveLength(1);
      const first = received[0];
      expect(first).toBeDefined();
      expect(first?.cpu.percent).toBe(42.5);
      expect(first?.cpu.cores).toBe(8);
      expect(first?.memory.percent).toBe(50.0);
      expect(first?.disk?.percent).toBe(50.0);
      expect(first?.hostname).toBe("test-node");
      expect(first?.uptimeSeconds).toBe(7200);

      // Unsubscribe test
      unsub();
      client.requestSystemMetrics();
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(received).toHaveLength(1); // Still 1, didn't receive new one

      client.disconnect();
    });
  });

  describe("Claude Driver & Project Management Client Flow (F007)", () => {
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

    it("sends agent.prompt and receives streamed agent.stream events", async () => {
      wss.on("connection", (ws) => {
        ws.on("message", (data) => {
          const raw = data.toString("utf-8");
          const parsed = parseMessage(raw);
          if (!parsed.success) return;

          if (parsed.data.type === "hello") {
            const ack = createHelloAckMessage(
              {
                sessionId: "ses_agent_mobile",
                agentVersion: "0.1.0",
                serverName: "MacBook Pro",
              },
              { sessionId: "ses_agent_mobile" }
            );
            ws.send(serializeMessage(ack));
          } else if (parsed.data.type === "agent.prompt") {
            const promptMsg = parsed.data as AgentPromptMessage;
            // Send assistant text
            const textEv = createAgentStreamMessage({
              event: {
                type: "assistant_text",
                text: `Result for ${promptMsg.payload.prompt}`,
              },
            });
            ws.send(serializeMessage(textEv));

            // Send done event
            const doneEv = createAgentStreamMessage({
              event: {
                type: "done",
                result: "Success",
                costUsd: 0.02,
                durationMs: 150,
              },
            });
            ws.send(serializeMessage(doneEv));
          }
        });
      });

      const client = new AgentClient({
        webSocketFactory: (url) => new WsClient(url) as unknown as WebSocket,
      });

      const streamEvents: AgentStreamEvent[] = [];
      client.onAgentStream((event) => {
        streamEvents.push(event);
      });

      client.connect({
        deviceId: "dev_mobile",
        token: "tok_mobile",
        host: "127.0.0.1",
        port: serverPort,
      });

      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(client.getState().status).toBe("online");

      const sent = client.sendAgentPrompt("Audit security rules");
      expect(sent).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(streamEvents).toHaveLength(2);
      const firstEv = streamEvents[0];
      expect(firstEv).toBeDefined();
      if (firstEv && firstEv.type === "assistant_text") {
        expect(firstEv.text).toContain("Audit security rules");
      }
      expect(streamEvents[1]?.type).toBe("done");

      client.disconnect();
    });

    it("sends agent.abort message", async () => {
      let receivedAbortReason: string | undefined;

      wss.on("connection", (ws) => {
        ws.on("message", (data) => {
          const raw = data.toString("utf-8");
          const parsed = parseMessage(raw);
          if (!parsed.success) return;

          if (parsed.data.type === "hello") {
            ws.send(
              serializeMessage(
                createHelloAckMessage(
                  {
                    sessionId: "ses_abort_test",
                    agentVersion: "0.1.0",
                    serverName: "Host",
                  },
                  { sessionId: "ses_abort_test" }
                )
              )
            );
          } else if (parsed.data.type === "agent.abort") {
            const abortMsg = parsed.data as AgentAbortMessage;
            receivedAbortReason = abortMsg.payload.reason;
          }
        });
      });

      const client = new AgentClient({
        webSocketFactory: (url) => new WsClient(url) as unknown as WebSocket,
      });

      client.connect({
        deviceId: "dev_mobile",
        token: "tok_mobile",
        host: "127.0.0.1",
        port: serverPort,
      });

      await new Promise((resolve) => setTimeout(resolve, 80));
      const aborted = client.abortAgent("User pressed stop");
      expect(aborted).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(receivedAbortReason).toBe("User pressed stop");

      client.disconnect();
    });

    it("requests project list and sets active project", async () => {
      wss.on("connection", (ws) => {
        ws.on("message", (data) => {
          const raw = data.toString("utf-8");
          const parsed = parseMessage(raw);
          if (!parsed.success) return;

          if (parsed.data.type === "hello") {
            ws.send(
              serializeMessage(
                createHelloAckMessage(
                  {
                    sessionId: "ses_proj_test",
                    agentVersion: "0.1.0",
                    serverName: "Host",
                  },
                  { sessionId: "ses_proj_test" }
                )
              )
            );
          } else if (parsed.data.type === "project.list") {
            ws.send(
              serializeMessage(
                createProjectListRespMessage({
                  currentCwd: "/workspace/ShellMind",
                  projects: [{ name: "ShellMind", path: "/workspace/ShellMind" }],
                })
              )
            );
          } else if (parsed.data.type === "project.set") {
            const setMsg = parsed.data as ProjectSetMessage;
            ws.send(
              serializeMessage(
                createProjectSetRespMessage({
                  success: true,
                  currentCwd: setMsg.payload.cwd,
                })
              )
            );
          }
        });
      });

      const client = new AgentClient({
        webSocketFactory: (url) => new WsClient(url) as unknown as WebSocket,
      });

      let listResult: ProjectListRespPayload | null = null;
      let setResult: ProjectSetRespPayload | null = null;

      client.onProjectList((resp) => {
        listResult = resp;
      });

      client.onProjectSet((resp) => {
        setResult = resp;
      });

      client.connect({
        deviceId: "dev_mobile",
        token: "tok_mobile",
        host: "127.0.0.1",
        port: serverPort,
      });

      await new Promise((resolve) => setTimeout(resolve, 80));

      client.requestProjectList();
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(listResult).not.toBeNull();
      expect(listResult!.currentCwd).toBe("/workspace/ShellMind");
      expect(listResult!.projects).toHaveLength(1);

      client.setProject("/workspace/OtherProject");
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(setResult).not.toBeNull();
      expect(setResult!.success).toBe(true);
      expect(setResult!.currentCwd).toBe("/workspace/OtherProject");

      client.disconnect();
    });
  });
});
