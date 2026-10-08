export interface TerminalSessionOptions {
  cols?: number;
  rows?: number;
  cwd?: string;
  env?: Record<string, string>;
}

export interface ITerminalSession {
  readonly id: string;
  readonly pid: number;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(signal?: number): void;
  onData(callback: (data: string) => void): void;
  onExit(callback: (exitCode: number, signal?: number) => void): void;
}

export interface ITerminalManager {
  createSession(options?: TerminalSessionOptions): Promise<ITerminalSession>;
  getSession(id: string): ITerminalSession | null;
  closeSession(id: string): Promise<void>;
  closeAll(): Promise<void>;
}
