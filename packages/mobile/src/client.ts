import {
  createHelloMessage,
  createPingMessage,
  parseMessage,
  serializeMessage,
  type HelloAckMessage,
  type HelloRejectMessage,
  type PongMessage,
} from "@shellmind/protocol";
import type { PairingConfig } from "./pairing.js";

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "handshaking"
  | "online"
  | "error";

export interface ClientState {
  status: ConnectionStatus;
  serverName: string | null;
  sessionId: string | null;
  agentVersion: string | null;
  lastRttMs: number | null;
  errorMessage: string | null;
}

export type StateChangeListener = (state: ClientState) => void;

export interface AgentClientOptions {
  webSocketFactory?: (url: string) => WebSocket;
  pingIntervalMs?: number;
  clientVersion?: string;
}

export class AgentClient {
  private socket: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pendingPingTimestamp: number | null = null;
  private listeners: Set<StateChangeListener> = new Set();

  private state: ClientState = {
    status: "disconnected",
    serverName: null,
    sessionId: null,
    agentVersion: null,
    lastRttMs: null,
    errorMessage: null,
  };

  constructor(private readonly options: AgentClientOptions = {}) {}

  public getState(): ClientState {
    return { ...this.state };
  }

  public onStateChange(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateState(partial: Partial<ClientState>): void {
    this.state = { ...this.state, ...partial };
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  public connect(config: PairingConfig): void {
    this.disconnect();

    const url = `ws://${config.host}:${config.port}`;
    this.updateState({
      status: "connecting",
      errorMessage: null,
    });

    try {
      const createWs =
        this.options.webSocketFactory ??
        ((targetUrl: string) => {
          if (typeof WebSocket === "undefined") {
            throw new Error("No global WebSocket found. Pass a webSocketFactory in options.");
          }
          return new WebSocket(targetUrl);
        });

      const ws = createWs(url);
      this.socket = ws;

      ws.onopen = () => {
        this.updateState({ status: "handshaking" });
        const hello = createHelloMessage({
          deviceId: config.deviceId,
          token: config.token,
          clientVersion: this.options.clientVersion || "0.1.0",
          platform: "ios",
        });
        ws.send(serializeMessage(hello));
      };

      ws.onmessage = (event) => {
        const text =
          typeof event.data === "string"
            ? event.data
            : (event.data as Buffer)?.toString?.("utf-8") || "";
        this.handleMessage(text);
      };

      ws.onerror = () => {
        if (this.state.status === "connecting" || this.state.status === "handshaking") {
          this.updateState({
            status: "error",
            errorMessage: "Connection failed: Unreachable host or network down.",
          });
        }
      };

      ws.onclose = () => {
        this.stopPingTimer();
        if (this.state.status !== "error") {
          this.updateState({
            status: "disconnected",
            sessionId: null,
          });
        }
      };
    } catch (err) {
      this.updateState({
        status: "error",
        errorMessage: (err as Error).message || "Failed to initialize connection",
      });
    }
  }

  public disconnect(preserveError = false): void {
    this.stopPingTimer();
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        // Ignore close errors
      }
      this.socket = null;
    }
    if (!preserveError || this.state.status !== "error") {
      this.updateState({
        status: "disconnected",
        sessionId: null,
      });
    }
  }

  public sendPing(): void {
    if (!this.socket || this.state.status !== "online") return;
    const nonce = `ping_${Date.now().toString(36)}`;
    const ping = createPingMessage({ nonce });
    this.pendingPingTimestamp = Date.now();
    try {
      this.socket.send(serializeMessage(ping));
    } catch {
      // Ignored
    }
  }

  private handleMessage(text: string): void {
    const result = parseMessage(text);
    if (!result.success) return;

    const message = result.data;

    if (message.type === "hello.ack") {
      const ack = message as HelloAckMessage;
      this.updateState({
        status: "online",
        sessionId: ack.payload.sessionId,
        serverName: ack.payload.serverName,
        agentVersion: ack.payload.agentVersion,
        errorMessage: null,
      });
      this.startPingTimer();
      return;
    }

    if (message.type === "hello.reject") {
      const reject = message as HelloRejectMessage;
      const desc =
        reject.payload.code === "FORBIDDEN"
          ? "Pairing rejected: Invalid device credentials."
          : reject.payload.code === "REVOKED"
          ? "Pairing revoked: This device has been revoked on the agent."
          : reject.payload.code === "UNAUTHORIZED"
          ? "Unauthorized: Handshake required."
          : `Handshake rejected: ${reject.payload.message}`;

      this.updateState({
        status: "error",
        errorMessage: desc,
      });
      this.disconnect(true);
      return;
    }

    if (message.type === "pong") {
      const pong = message as PongMessage;
      if (this.pendingPingTimestamp !== null) {
        const rtt = Date.now() - this.pendingPingTimestamp;
        this.pendingPingTimestamp = null;
        this.updateState({ lastRttMs: rtt });
      } else if (pong.payload.receivedAt !== undefined) {
        // Fallback compute from payload
        const rtt = Math.max(0, Date.now() - pong.payload.receivedAt);
        this.updateState({ lastRttMs: rtt });
      }
      return;
    }
  }

  private startPingTimer(): void {
    this.stopPingTimer();
    const interval = this.options.pingIntervalMs ?? 5000;
    this.sendPing();
    this.pingTimer = setInterval(() => {
      this.sendPing();
    }, interval);
  }

  private stopPingTimer(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    this.pendingPingTimestamp = null;
  }
}
