import * as os from "node:os";
import { WebSocketServer, WebSocket } from "ws";
import type {
  TransportServer,
  TransportConnection,
  TransportListener,
} from "../../core/transport.js";

export interface TailnetInterfaceInfo {
  name: string;
  address: string;
}

export function isTailnetIp(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }
  // Tailscale IPv4 CGNAT space is 100.64.0.0/10 (100.64.0.0 to 100.127.255.255)
  return parts[0] === 100 && parts[1]! >= 64 && parts[1]! <= 127;
}

export function findTailnetInterface(options?: { allowLocalhost?: boolean }): TailnetInterfaceInfo | null {
  const interfaces = os.networkInterfaces();

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const info of addrs) {
      if (info.family === "IPv4" && !info.internal) {
        if (isTailnetIp(info.address) || name.toLowerCase().startsWith("tailscale")) {
          return { name, address: info.address };
        }
      }
    }
  }

  if (options?.allowLocalhost) {
    return { name: "lo0", address: "127.0.0.1" };
  }

  return null;
}

class WsTransportConnection implements TransportConnection {
  public readonly id: string;
  public readonly remoteAddress?: string;

  constructor(private readonly socket: WebSocket) {
    this.id = `conn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    // @ts-expect-error remoteAddress on underlying socket
    this.remoteAddress = socket._socket?.remoteAddress;
  }

  public send(message: string): void {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(message);
    }
  }

  public close(code?: number, reason?: string): void {
    this.socket.close(code, reason);
  }

  public onMessage(handler: (data: string) => void | Promise<void>): void {
    this.socket.on("message", async (data) => {
      const text = typeof data === "string" ? data : data.toString("utf-8");
      await handler(text);
    });
  }

  public onClose(handler: (code?: number, reason?: string) => void): void {
    this.socket.on("close", (code, reason) => {
      handler(code, reason.toString("utf-8"));
    });
  }
}

export class TailnetTransportServer implements TransportServer {
  private connectionHandler: ((conn: TransportConnection) => void) | null = null;

  constructor(private readonly options?: { allowLocalhost?: boolean }) {}

  public onConnection(handler: (conn: TransportConnection) => void): void {
    this.connectionHandler = handler;
  }

  public async listen(options: { host?: string; port: number }): Promise<TransportListener> {
    let host = options.host;

    if (host === "0.0.0.0") {
      throw new Error(
        "Refusing to bind to 0.0.0.0: ShellMind transport must bind to the Tailscale interface only."
      );
    }

    if (!host) {
      const iface = findTailnetInterface({ allowLocalhost: this.options?.allowLocalhost });
      if (!iface) {
        throw new Error(
          "No Tailscale interface found. ShellMind requires Tailscale to be connected."
        );
      }
      host = iface.address;
    }

    const wss = new WebSocketServer({ host, port: options.port });

    wss.on("connection", (socket) => {
      if (this.connectionHandler) {
        const conn = new WsTransportConnection(socket);
        this.connectionHandler(conn);
      }
    });

    await new Promise<void>((resolve, reject) => {
      wss.on("listening", () => resolve());
      wss.on("error", (err) => reject(err));
    });

    const addr = wss.address();
    const actualHost = typeof addr === "object" && addr !== null ? addr.address : host;
    const actualPort = typeof addr === "object" && addr !== null ? addr.port : options.port;

    return {
      address: () => ({ host: actualHost, port: actualPort }),
      close: async () => {
        await new Promise<void>((resolve, reject) => {
          wss.close((err) => (err ? reject(err) : resolve()));
        });
      },
    };
  }
}
