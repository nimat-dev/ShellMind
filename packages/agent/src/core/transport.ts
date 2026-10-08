/**
 * Transport interface contract (pure core, no I/O)
 * Defined per rules/layer-boundaries.md and architecture/MODULES.md
 */

export interface TransportConnection {
  readonly id: string;
  readonly remoteAddress?: string;
  send(message: string): Promise<void> | void;
  close(code?: number, reason?: string): Promise<void> | void;
  onMessage(handler: (data: string) => void | Promise<void>): void;
  onClose(handler: (code?: number, reason?: string) => void): void;
}

export interface TransportListener {
  close(): Promise<void> | void;
  address(): { host: string; port: number };
}

export interface TransportServer {
  listen(options: { host: string; port: number }): Promise<TransportListener>;
  onConnection(handler: (connection: TransportConnection) => void): void;
}
