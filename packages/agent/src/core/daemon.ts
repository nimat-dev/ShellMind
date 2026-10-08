import {
  parseMessage,
  serializeMessage,
  createHelloAckMessage,
  createHelloRejectMessage,
  createPongMessage,
  createErrorMessage,
  createTermDataMessage,
  createTermExitMessage,
  type HelloMessage,
  type PingMessage,
  type TermOpenMessage,
  type TermInputMessage,
  type TermResizeMessage,
  type KnownMessage,
} from "@shellmind/protocol";
import type { TransportServer, TransportConnection, TransportListener } from "./transport.js";
import type { IDeviceRegistry, PairedDevice } from "./device.js";
import type { ITerminalManager, ITerminalSession } from "./terminal.js";

export interface AgentDaemonConfig {
  agentVersion: string;
  serverName: string;
  terminalManager?: ITerminalManager;
}

export interface AuthenticatedSession {
  sessionId: string;
  device: PairedDevice;
  connection: TransportConnection;
  connectedAt: number;
}

export interface HandlerContext {
  session: AuthenticatedSession;
  send: (msg: KnownMessage) => Promise<void>;
}

export type MessageHandler<T extends KnownMessage = KnownMessage> = (
  message: T,
  ctx: HandlerContext
) => void | Promise<void>;

export class AgentDaemon {
  private listener: TransportListener | null = null;
  private activeSessions = new Map<string, AuthenticatedSession>();
  private connectionStates = new Map<
    string,
    { isAuthenticated: boolean; session?: AuthenticatedSession }
  >();
  private handlers = new Map<string, MessageHandler>();
  private sessionTerminals = new Map<string, ITerminalSession>();

  constructor(
    private readonly transport: TransportServer,
    private readonly registry: IDeviceRegistry,
    private readonly config: AgentDaemonConfig
  ) {
    this.transport.onConnection((conn) => this.handleNewConnection(conn));
    this.registerDefaultHandlers();
  }

  public registerHandler<T extends KnownMessage = KnownMessage>(
    type: string,
    handler: MessageHandler<T>
  ): void {
    this.handlers.set(type, handler as MessageHandler);
  }

  private registerDefaultHandlers(): void {
    this.registerHandler("ping", async (message, ctx) => {
      const ping = message as PingMessage;
      const pong = createPongMessage(
        {
          nonce: ping.payload.nonce,
          receivedAt: Date.now(),
        },
        { sessionId: ctx.session.sessionId }
      );
      await ctx.send(pong);
    });

    this.registerHandler("term.open", async (message, ctx) => {
      if (!this.config.terminalManager) {
        await ctx.send(
          createErrorMessage({
            code: "TERMINAL_NOT_SUPPORTED",
            message: "PTY terminal manager is not configured on this agent",
          })
        );
        return;
      }

      // One PTY per session: clean up any existing session
      const existing = this.sessionTerminals.get(ctx.session.sessionId);
      if (existing) {
        existing.kill();
        this.sessionTerminals.delete(ctx.session.sessionId);
      }

      const openMsg = message as TermOpenMessage;
      try {
        const ptySession = await this.config.terminalManager.createSession({
          cols: openMsg.payload.cols,
          rows: openMsg.payload.rows,
          cwd: openMsg.payload.cwd,
          env: openMsg.payload.env,
        });

        this.sessionTerminals.set(ctx.session.sessionId, ptySession);

        ptySession.onData(async (data) => {
          const dataMsg = createTermDataMessage(
            { data },
            { sessionId: ctx.session.sessionId }
          );
          await ctx.send(dataMsg);
        });

        ptySession.onExit(async (exitCode, signal) => {
          this.sessionTerminals.delete(ctx.session.sessionId);
          const exitMsg = createTermExitMessage(
            { exitCode, signal },
            { sessionId: ctx.session.sessionId }
          );
          await ctx.send(exitMsg);
        });
      } catch (err) {
        await ctx.send(
          createErrorMessage({
            code: "TERMINAL_SPAWN_FAILED",
            message: (err as Error).message || "Failed to spawn shell session",
          })
        );
      }
    });

    this.registerHandler("term.input", async (message, ctx) => {
      const term = this.sessionTerminals.get(ctx.session.sessionId);
      if (term) {
        const inputMsg = message as TermInputMessage;
        term.write(inputMsg.payload.data);
      }
    });

    this.registerHandler("term.resize", async (message, ctx) => {
      const term = this.sessionTerminals.get(ctx.session.sessionId);
      if (term) {
        const resizeMsg = message as TermResizeMessage;
        term.resize(resizeMsg.payload.cols, resizeMsg.payload.rows);
      }
    });
  }

  public async start(options: { host: string; port: number }): Promise<TransportListener> {
    this.listener = await this.transport.listen(options);
    return this.listener;
  }

  public async stop(): Promise<void> {
    for (const term of this.sessionTerminals.values()) {
      term.kill();
    }
    this.sessionTerminals.clear();

    if (this.config.terminalManager) {
      await this.config.terminalManager.closeAll();
    }

    for (const session of this.activeSessions.values()) {
      await session.connection.close(1000, "Server shutting down");
    }
    this.activeSessions.clear();
    this.connectionStates.clear();
    if (this.listener) {
      await this.listener.close();
      this.listener = null;
    }
  }

  public getActiveSessions(): AuthenticatedSession[] {
    return Array.from(this.activeSessions.values());
  }

  private handleNewConnection(conn: TransportConnection): void {
    const connState = { isAuthenticated: false };
    this.connectionStates.set(conn.id, connState);

    conn.onClose(() => {
      const state = this.connectionStates.get(conn.id);
      if (state?.session) {
        const term = this.sessionTerminals.get(state.session.sessionId);
        if (term) {
          term.kill();
          this.sessionTerminals.delete(state.session.sessionId);
        }
        this.activeSessions.delete(state.session.sessionId);
      }
      this.connectionStates.delete(conn.id);
    });

    conn.onMessage(async (rawText) => {
      await this.handleMessage(conn, rawText);
    });
  }

  private async handleMessage(conn: TransportConnection, rawText: string): Promise<void> {
    const connState = this.connectionStates.get(conn.id);
    if (!connState) return;

    const parseResult = parseMessage(rawText);
    if (!parseResult.success) {
      if (!connState.isAuthenticated) {
        const rejectMsg = createHelloRejectMessage({
          code: "MALFORMED_HANDSHAKE",
          message: parseResult.error.message,
        });
        await conn.send(serializeMessage(rejectMsg));
        await conn.close(4001, "Malformed handshake");
      } else {
        const errorMsg = createErrorMessage({
          code: parseResult.error.code,
          message: parseResult.error.message,
        });
        await conn.send(serializeMessage(errorMsg));
      }
      return;
    }

    const message = parseResult.data as KnownMessage;

    // 1. Handshake Phase
    if (!connState.isAuthenticated) {
      if (message.type !== "hello") {
        const reject = createHelloRejectMessage({
          code: "UNAUTHORIZED",
          message: "First message must be hello handshake",
        });
        await conn.send(serializeMessage(reject));
        await conn.close(4002, "Unauthorized: Hello required");
        return;
      }

      await this.processHelloHandshake(conn, message as HelloMessage);
      return;
    }

    // 2. Authenticated Session Phase
    await this.processAuthenticatedMessage(conn, connState.session!, message);
  }

  private async processHelloHandshake(
    conn: TransportConnection,
    hello: HelloMessage
  ): Promise<void> {
    const device = await this.registry.getDeviceByToken(hello.payload.token);

    if (!device || device.id !== hello.payload.deviceId) {
      const reject = createHelloRejectMessage({
        code: "FORBIDDEN",
        message: "Invalid device ID or token",
      });
      await conn.send(serializeMessage(reject));
      await conn.close(4003, "Forbidden: Invalid credentials");
      return;
    }

    if (device.revokedAt) {
      const reject = createHelloRejectMessage({
        code: "REVOKED",
        message: "Device pairing has been revoked",
      });
      await conn.send(serializeMessage(reject));
      await conn.close(4004, "Revoked device");
      return;
    }

    // Handshake successful
    const sessionId = `ses_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const session: AuthenticatedSession = {
      sessionId,
      device,
      connection: conn,
      connectedAt: Date.now(),
    };

    const connState = this.connectionStates.get(conn.id);
    if (connState) {
      connState.isAuthenticated = true;
      connState.session = session;
    }
    this.activeSessions.set(sessionId, session);

    const ack = createHelloAckMessage(
      {
        sessionId,
        agentVersion: this.config.agentVersion,
        serverName: this.config.serverName,
      },
      { sessionId }
    );
    await conn.send(serializeMessage(ack));
  }

  private async processAuthenticatedMessage(
    conn: TransportConnection,
    session: AuthenticatedSession,
    message: KnownMessage
  ): Promise<void> {
    const handler = this.handlers.get(message.type);
    if (handler) {
      await handler(message, {
        session,
        send: async (out) => conn.send(serializeMessage(out)),
      });
    } else {
      const err = createErrorMessage({
        code: "UNSUPPORTED_MESSAGE_TYPE",
        message: `No handler registered for message type: ${message.type}`,
      });
      await conn.send(serializeMessage(err));
    }
  }
}
