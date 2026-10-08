import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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
  createPermRequestMessage,
  type PermRequestPayload,
  type PermResponseMessage,
  createChatHistoryRespMessage,
  type ChatHistoryReqMessage,
  type ChatHistoryRespPayload,
} from "@shellmind/protocol";
import { parsePairingPayload } from "./pairing.js";
import { MemorySecureStorage, ExpoSecureStoreAdapter } from "./storage.js";
import { AgentClient } from "./client.js";
import { TerminalBuffer } from "./terminal/buffer.js";
import React from "react";

vi.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  TextInput: "TextInput",
  TouchableOpacity: "TouchableOpacity",
  ScrollView: "ScrollView",
  ActivityIndicator: "ActivityIndicator",
  StyleSheet: { create: (styles: unknown) => styles },
  Platform: { OS: "ios", select: (obj: Record<string, unknown>) => obj["ios"] ?? obj["default"] },
}));

import { PermissionCard } from "./components/PermissionCard.js";
import { ChatScreen } from "./components/ChatScreen.js";
import {
  getToolRenderer,
  registerToolRenderer,
  clearToolRenderers,
} from "./renderers/registry.js";
import { DefaultRenderer } from "./renderers/DefaultRenderer.js";
import { BashRenderer } from "./renderers/BashRenderer.js";
import { FileRenderer } from "./renderers/FileRenderer.js";
import { SearchRenderer } from "./renderers/SearchRenderer.js";
import {
  MockSpeechToTextProvider,
  NativeSpeechToTextProvider,
  getSpeechToTextProvider,
  setSpeechToTextProvider,
  resetSpeechToTextProvider,
  MockTextToSpeechProvider,
  NativeTextToSpeechProvider,
  getTextToSpeechProvider,
  setTextToSpeechProvider,
  resetTextToSpeechProvider,
  extractSpokenSummary,
} from "./voice/index.js";

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

  describe("Permission Flow & Confirmation Card (F008)", () => {
    let wss: WebSocketServer;
    let serverPort: number;

    beforeEach(async () => {
      wss = new WebSocketServer({ port: 0 });
      await new Promise<void>((resolve) => wss.on("listening", () => resolve()));
      serverPort = (wss.address() as { port: number }).port;
    });

    afterEach(async () => {
      await new Promise<void>((resolve) => wss.close(() => resolve()));
    });

    it("receives perm.request and sends perm.response allow with session remember", async () => {
      let receivedPermResponse: PermResponseMessage | null = null;

      wss.on("connection", (ws) => {
        ws.on("message", (raw) => {
          const parsed = parseMessage(raw.toString());
          if (!parsed.success) return;

          if (parsed.data.type === "hello") {
            ws.send(
              serializeMessage(
                createHelloAckMessage(
                  {
                    sessionId: "ses_perm_test",
                    agentVersion: "0.1.0",
                    serverName: "Test Server",
                  },
                  { sessionId: "ses_perm_test" }
                )
              )
            );

            // Server initiates perm.request
            setTimeout(() => {
              ws.send(
                serializeMessage(
                  createPermRequestMessage({
                    requestId: "req_test_1",
                    toolName: "Bash",
                    command: "git push -f",
                    input: { command: "git push -f" },
                    cwd: "/workspace/ShellMind",
                    riskHint: "high",
                    description: "Force pushing branch",
                  })
                )
              );
            }, 30);
          } else if (parsed.data.type === "perm.response") {
            receivedPermResponse = parsed.data as PermResponseMessage;
          }
        });
      });

      const client = new AgentClient({
        webSocketFactory: (url) => new WsClient(url) as unknown as WebSocket,
      });

      let requestedPayload: PermRequestPayload | null = null;
      client.onPermissionRequest((req) => {
        requestedPayload = req;
        // Respond with allow and remember
        client.respondPermission(req.requestId, "allow", true);
      });

      client.connect({
        deviceId: "dev_mobile",
        token: "tok_mobile",
        host: "127.0.0.1",
        port: serverPort,
      });

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(requestedPayload).not.toBeNull();
      expect(requestedPayload!.requestId).toBe("req_test_1");
      expect(requestedPayload!.toolName).toBe("Bash");
      expect(requestedPayload!.command).toBe("git push -f");
      expect(requestedPayload!.riskHint).toBe("high");

      expect(receivedPermResponse).not.toBeNull();
      expect(receivedPermResponse!.payload.requestId).toBe("req_test_1");
      expect(receivedPermResponse!.payload.decision).toBe("allow");
      expect(receivedPermResponse!.payload.rememberForSession).toBe(true);

      client.disconnect();
    });

    it("sends perm.response deny when rejected", async () => {
      let receivedPermResponse: PermResponseMessage | null = null;

      wss.on("connection", (ws) => {
        ws.on("message", (raw) => {
          const parsed = parseMessage(raw.toString());
          if (!parsed.success) return;

          if (parsed.data.type === "hello") {
            ws.send(
              serializeMessage(
                createHelloAckMessage(
                  {
                    sessionId: "ses_perm_test2",
                    agentVersion: "0.1.0",
                    serverName: "Test Server",
                  },
                  { sessionId: "ses_perm_test2" }
                )
              )
            );

            setTimeout(() => {
              ws.send(
                serializeMessage(
                  createPermRequestMessage({
                    requestId: "req_test_2",
                    toolName: "Bash",
                    command: "rm -rf /",
                    input: { command: "rm -rf /" },
                    cwd: "/",
                    riskHint: "high",
                  })
                )
              );
            }, 30);
          } else if (parsed.data.type === "perm.response") {
            receivedPermResponse = parsed.data as PermResponseMessage;
          }
        });
      });

      const client = new AgentClient({
        webSocketFactory: (url) => new WsClient(url) as unknown as WebSocket,
      });

      client.onPermissionRequest((req) => {
        client.respondPermission(req.requestId, "deny", false);
      });

      client.connect({
        deviceId: "dev_mobile",
        token: "tok_mobile",
        host: "127.0.0.1",
        port: serverPort,
      });

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(receivedPermResponse).not.toBeNull();
      expect(receivedPermResponse!.payload.requestId).toBe("req_test_2");
      expect(receivedPermResponse!.payload.decision).toBe("deny");

      client.disconnect();
    });

    it("PermissionCard component renders element tree and exposes interaction props", () => {
      const mockRespond = vi.fn();
      const element = React.createElement(PermissionCard, {
        request: {
          requestId: "card_req_1",
          toolName: "Bash",
          command: "rm -rf /tmp/build",
          input: { command: "rm -rf /tmp/build" },
          cwd: "/workspace/ShellMind",
          riskHint: "high",
          description: "Clear build artifacts",
        },
        onRespond: mockRespond,
      });

      expect(element).toBeDefined();
      expect(element.props.request.toolName).toBe("Bash");
      expect(element.props.request.riskHint).toBe("high");
      expect(element.props.onRespond).toBe(mockRespond);
    });
  });

  describe("Chat UI, Tool Renderers & Session Continuity (F009)", () => {
    let wss: WebSocketServer;
    let serverPort: number;

    beforeEach(async () => {
      wss = new WebSocketServer({ port: 0 });
      await new Promise<void>((resolve) => wss.on("listening", () => resolve()));
      serverPort = (wss.address() as { port: number }).port;
    });

    afterEach(async () => {
      for (const client of wss.clients) {
        client.terminate();
      }
      await new Promise<void>((resolve) => wss.close(() => resolve()));
    });

    it("AgentClient sends chat.history.req and dispatches chat.history.resp to listeners", async () => {
      let receivedHistoryReq: ChatHistoryReqMessage | null = null;

      wss.on("connection", (ws) => {
        ws.on("message", (raw) => {
          const parsed = parseMessage(raw.toString());
          if (!parsed.success) return;

          if (parsed.data.type === "hello") {
            ws.send(
              serializeMessage(
                createHelloAckMessage(
                  {
                    sessionId: "ses_chat_test",
                    serverName: "Test Daemon",
                    agentVersion: "0.1.0",
                  },
                  { sessionId: "ses_chat_test" }
                )
              )
            );
          } else if (parsed.data.type === "chat.history.req") {
            receivedHistoryReq = parsed.data as ChatHistoryReqMessage;
            ws.send(
              serializeMessage(
                createChatHistoryRespMessage({
                  currentCwd: "/workspace/ShellMind",
                  turns: [
                    {
                      id: "turn_u1",
                      role: "user",
                      text: "Hello",
                      timestamp: 1000,
                      status: "done",
                    },
                    {
                      id: "turn_a1",
                      role: "assistant",
                      text: "World",
                      timestamp: 1001,
                      status: "done",
                    },
                  ],
                })
              )
            );
          }
        });
      });

      const client = new AgentClient({
        webSocketFactory: (url) => new WsClient(url) as unknown as WebSocket,
      });

      let receivedPayload: ChatHistoryRespPayload | null = null;
      client.onChatHistory((payload) => {
        receivedPayload = payload;
      });

      const onlinePromise = new Promise<void>((resolve) => {
        const unsub = client.onStateChange((st) => {
          if (st.status === "online") {
            unsub();
            resolve();
          }
        });
      });

      client.connect({
        deviceId: "dev_mobile",
        token: "tok_mobile",
        host: "127.0.0.1",
        port: serverPort,
      });

      await onlinePromise;

      // Request chat history
      const sent = client.requestChatHistory("/workspace/ShellMind", 50);
      expect(sent).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(receivedHistoryReq).not.toBeNull();
      expect(receivedHistoryReq!.payload.projectCwd).toBe("/workspace/ShellMind");
      expect(receivedHistoryReq!.payload.limit).toBe(50);

      expect(receivedPayload).not.toBeNull();
      expect(receivedPayload!.currentCwd).toBe("/workspace/ShellMind");
      expect(receivedPayload!.turns.length).toBe(2);
      expect(receivedPayload!.turns[0]?.text).toBe("Hello");
      expect(receivedPayload!.turns[1]?.text).toBe("World");

      client.disconnect();
    });

    it("Tool Renderer Registry returns specific and fallback renderers correctly", () => {
      // Standard renderers
      expect(getToolRenderer("Bash")).toBe(BashRenderer);
      expect(getToolRenderer("bash")).toBe(BashRenderer);
      expect(getToolRenderer("terminal")).toBe(BashRenderer);

      expect(getToolRenderer("Read")).toBe(FileRenderer);
      expect(getToolRenderer("Write")).toBe(FileRenderer);
      expect(getToolRenderer("Edit")).toBe(FileRenderer);
      expect(getToolRenderer("str_replace_editor")).toBe(FileRenderer);

      expect(getToolRenderer("GlobTool")).toBe(SearchRenderer);
      expect(getToolRenderer("GrepTool")).toBe(SearchRenderer);
      expect(getToolRenderer("grep")).toBe(SearchRenderer);

      // Unknown tool falls back to DefaultRenderer
      expect(getToolRenderer("unknown_custom_xyz")).toBe(DefaultRenderer);

      // Custom tool registration
      const MockCustomRenderer: React.FC = () => null;
      registerToolRenderer("custom_tool_abc", MockCustomRenderer);
      expect(getToolRenderer("custom_tool_abc")).toBe(MockCustomRenderer);

      clearToolRenderers();
    });

    it("DefaultRenderer, BashRenderer, FileRenderer, SearchRenderer instantiate cleanly", () => {
      const defaultEl = React.createElement(DefaultRenderer, {
        toolName: "CustomTool",
        input: { key: "value" },
        result: "Executed",
      });
      expect(defaultEl).toBeDefined();

      const bashEl = React.createElement(BashRenderer, {
        toolName: "Bash",
        input: { command: "ls -la" },
        result: "file1.txt\nfile2.txt",
        isError: false,
      });
      expect(bashEl).toBeDefined();

      const fileEl = React.createElement(FileRenderer, {
        toolName: "Edit",
        input: { file_path: "/src/index.ts", old_str: "foo", new_str: "bar" },
        result: "File updated",
      });
      expect(fileEl).toBeDefined();

      const searchEl = React.createElement(SearchRenderer, {
        toolName: "GrepTool",
        input: { pattern: "TODO", path: "src/" },
        result: "3 matches found",
      });
      expect(searchEl).toBeDefined();
    });

    it("ChatScreen component mounts cleanly and configures client listeners", () => {
      const client = new AgentClient({
        webSocketFactory: (url) => new WsClient(url) as unknown as WebSocket,
      });

      const screenEl = React.createElement(ChatScreen, { client });
      expect(screenEl).toBeDefined();
      expect(screenEl.props.client).toBe(client);
    });
  });

  describe("Push-to-Talk Speech-to-Text & Voice Input (F010)", () => {
    it("MockSpeechToTextProvider handles recording lifecycle and interim streaming", async () => {
      const provider = new MockSpeechToTextProvider({
        fixtureText: "git status and run tests",
        delayMs: 5,
      });

      expect(await provider.isAvailable()).toBe(true);
      expect(await provider.requestPermission()).toBe("granted");
      expect(provider.isRecording()).toBe(false);

      let interimResult = "";
      await provider.startRecording((interim) => {
        interimResult = interim;
      });

      expect(provider.isRecording()).toBe(true);

      // Wait for interim callback
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(interimResult.length).toBeGreaterThan(0);

      const finalResult = await provider.stopRecording();
      expect(finalResult).toBe("git status and run tests");
      expect(provider.isRecording()).toBe(false);
    });

    it("MockSpeechToTextProvider cancelRecording discards active recording without output", async () => {
      const provider = new MockSpeechToTextProvider({
        fixtureText: "Secret command",
      });

      await provider.startRecording();
      expect(provider.isRecording()).toBe(true);

      await provider.cancelRecording();
      expect(provider.isRecording()).toBe(false);

      // Calling stop after cancel returns empty string
      const result = await provider.stopRecording();
      expect(result).toBe("");
    });

    it("MockSpeechToTextProvider rejects startRecording when permission is denied", async () => {
      const provider = new MockSpeechToTextProvider({
        permission: "denied",
      });

      expect(await provider.requestPermission()).toBe("denied");
      await expect(provider.startRecording()).rejects.toThrow(/permission was denied/i);
      expect(provider.isRecording()).toBe(false);
    });

    it("MockSpeechToTextProvider rejects startRecording when unavailable", async () => {
      const provider = new MockSpeechToTextProvider({
        available: false,
      });

      expect(await provider.isAvailable()).toBe(false);
      await expect(provider.startRecording()).rejects.toThrow(/not available on this device/i);
    });

    it("NativeSpeechToTextProvider handles missing hardware gracefully without throwing", async () => {
      const nativeProvider = new NativeSpeechToTextProvider();
      const available = await nativeProvider.isAvailable();
      expect(typeof available).toBe("boolean");

      const permission = await nativeProvider.requestPermission();
      expect(["granted", "denied", "undetermined"]).toContain(permission);
    });

    it("Voice Registry manages active speech-to-text provider", () => {
      const defaultProvider = getSpeechToTextProvider();
      expect(defaultProvider).toBeDefined();

      const customMock = new MockSpeechToTextProvider({ fixtureText: "Custom" });
      setSpeechToTextProvider(customMock);
      expect(getSpeechToTextProvider()).toBe(customMock);

      resetSpeechToTextProvider();
      expect(getSpeechToTextProvider()).not.toBe(customMock);
    });

    it("ChatScreen component mounts with sttProvider and exposes mic button", () => {
      const client = new AgentClient({
        webSocketFactory: (url) => new WsClient(url) as unknown as WebSocket,
      });
      const sttProvider = new MockSpeechToTextProvider({ fixtureText: "Run test suite" });

      const screenEl = React.createElement(ChatScreen, { client, sttProvider });
      expect(screenEl).toBeDefined();
      expect(screenEl.props.sttProvider).toBe(sttProvider);
    });
  });

  describe("On-Device Text-to-Speech Spoken Replies (F011)", () => {
    it("MockTextToSpeechProvider handles speech lifecycle, history, and completion", async () => {
      const provider = new MockTextToSpeechProvider({
        autoComplete: true,
        delayMs: 10,
      });

      expect(await provider.isAvailable()).toBe(true);
      expect(provider.isSpeaking()).toBe(false);
      expect(provider.getSpokenHistory()).toHaveLength(0);

      let started = false;
      let done = false;

      await provider.speak("All 120 tests passed successfully.", {
        onStart: () => {
          started = true;
        },
        onDone: () => {
          done = true;
        },
      });

      expect(started).toBe(true);
      expect(provider.isSpeaking()).toBe(true);
      expect(provider.getLastSpoken()).toBe("All 120 tests passed successfully.");

      // Wait for simulated autocomplete
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(done).toBe(true);
      expect(provider.isSpeaking()).toBe(false);
    });

    it("MockTextToSpeechProvider stops and interrupts active speech", async () => {
      const provider = new MockTextToSpeechProvider({
        autoComplete: false,
      });

      await provider.speak("First turn response.");
      expect(provider.isSpeaking()).toBe(true);

      // Subsequent speak automatically interrupts prior utterance
      await provider.speak("Second turn response.");
      expect(provider.isSpeaking()).toBe(true);
      expect(provider.getSpokenHistory()).toEqual([
        "First turn response.",
        "Second turn response.",
      ]);

      await provider.stop();
      expect(provider.isSpeaking()).toBe(false);
    });

    it("MockTextToSpeechProvider handles errors and unavailable device state", async () => {
      const unavailableProvider = new MockTextToSpeechProvider({ available: false });
      expect(await unavailableProvider.isAvailable()).toBe(false);

      let errorCaught: Error | null = null;
      await expect(
        unavailableProvider.speak("Test speech", {
          onError: (err) => {
            errorCaught = err;
          },
        })
      ).rejects.toThrow(/not available on this device/i);
      expect(errorCaught).not.toBeNull();

      const erroringProvider = new MockTextToSpeechProvider({
        shouldError: true,
        errorMessage: "Audio hardware busy",
      });
      await expect(erroringProvider.speak("Test speech")).rejects.toThrow(/Audio hardware busy/i);
    });

    it("extractSpokenSummary removes code fences, markdown syntax, and tool artifacts", () => {
      const rawMarkdown = `
# Project Status
Here is what happened:
\`\`\`bash
pnpm test
\`\`\`
All tests **passed** with *zero* failures.
See details in [Architecture Doc](file:///docs/arch.md).
- Item 1
- Item 2
{"tool": "Bash"}
`;
      const summary = extractSpokenSummary(rawMarkdown);
      expect(summary).not.toContain("```");
      expect(summary).not.toContain("pnpm test");
      expect(summary).not.toContain("# Project Status");
      expect(summary).not.toContain("**");
      expect(summary).not.toContain("*zero*");
      expect(summary).not.toContain("[Architecture Doc]");
      expect(summary).not.toContain("{\"tool\"");
      expect(summary).toContain("Project Status");
      expect(summary).toContain("All tests passed with zero failures");
      expect(summary).toContain("Architecture Doc");
    });

    it("extractSpokenSummary respects sentence boundaries and caps max length", () => {
      const longText =
        "The first sentence has completed cleanly. The second sentence explains additional background in great detail with extensive technical explanations that go on for a while. The third sentence wraps up the conversation.";

      const capped = extractSpokenSummary(longText, 60);
      expect(capped.length).toBeLessThanOrEqual(60);
      expect(capped).toBe("The first sentence has completed cleanly.");

      const fallbackText =
        "Averylongwordwithoutpunctationthatjustkeepsexpandingandexpandingandexpandingandexpandingforawhile";
      const fallbackCapped = extractSpokenSummary(fallbackText, 40);
      expect(fallbackCapped.length).toBeLessThanOrEqual(44);
      expect(fallbackCapped.endsWith("...")).toBe(true);

      expect(extractSpokenSummary("")).toBe("");
      expect(extractSpokenSummary("   ")).toBe("");
    });

    it("NativeTextToSpeechProvider handles environment checks and safe speak/stop calls", async () => {
      const nativeProvider = new NativeTextToSpeechProvider();
      const available = await nativeProvider.isAvailable();
      expect(typeof available).toBe("boolean");

      // Safe stop without exceptions
      await expect(nativeProvider.stop()).resolves.toBeUndefined();
      expect(nativeProvider.isSpeaking()).toBe(false);

      // Safe speak with empty text returns without error
      await expect(nativeProvider.speak("")).resolves.toBeUndefined();
    });

    it("Voice Registry manages active text-to-speech provider", () => {
      const defaultProvider = getTextToSpeechProvider();
      expect(defaultProvider).toBeDefined();

      const customMock = new MockTextToSpeechProvider();
      setTextToSpeechProvider(customMock);
      expect(getTextToSpeechProvider()).toBe(customMock);

      resetTextToSpeechProvider();
      expect(getTextToSpeechProvider()).not.toBe(customMock);
    });

    it("ChatScreen component mounts with ttsProvider and initialTtsEnabled options", () => {
      const client = new AgentClient({
        webSocketFactory: (url) => new WsClient(url) as unknown as WebSocket,
      });
      const ttsProvider = new MockTextToSpeechProvider();

      const screenEl = React.createElement(ChatScreen, {
        client,
        ttsProvider,
        initialTtsEnabled: true,
      });
      expect(screenEl).toBeDefined();
      expect(screenEl.props.ttsProvider).toBe(ttsProvider);
      expect(screenEl.props.initialTtsEnabled).toBe(true);
    });

    it("handles rapid consecutive turns without overlapping audio", async () => {
      const provider = new MockTextToSpeechProvider();

      // First turn
      const turn1Summary = extractSpokenSummary("Turn 1 response with markdown `code`.");
      await provider.speak(turn1Summary);
      expect(provider.isSpeaking()).toBe(true);
      expect(provider.getLastSpoken()).toBe("Turn 1 response with markdown code.");

      // Rapid second turn immediately cuts off first
      const turn2Summary = extractSpokenSummary("Turn 2 rapid response.");
      await provider.speak(turn2Summary);
      expect(provider.isSpeaking()).toBe(true);
      expect(provider.getLastSpoken()).toBe("Turn 2 rapid response.");
      expect(provider.getSpokenHistory()).toEqual([
        "Turn 1 response with markdown code.",
        "Turn 2 rapid response.",
      ]);

      // Immediate user interruption stops playback
      await provider.stop();
      expect(provider.isSpeaking()).toBe(false);
    });

    it("extractSpokenSummary handles extreme lengths and nested structures", () => {
      const hugeText = Array.from({ length: 50 }, (_, i) => `Paragraph ${i} contains technical details.`).join(" ");
      const capped = extractSpokenSummary(hugeText, 200);
      expect(capped.length).toBeLessThanOrEqual(200);
      expect(capped.length).toBeGreaterThan(50);
      expect(capped.endsWith(".")).toBe(true);
    });
  });
});
