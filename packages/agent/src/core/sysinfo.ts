export interface CpuMetrics {
  percent: number;
  cores: number;
}

export interface MemoryMetrics {
  usedBytes: number;
  totalBytes: number;
  percent: number;
}

export interface DiskMetrics {
  usedBytes: number;
  totalBytes: number;
  percent: number;
  mount?: string;
}

export interface SystemMetrics {
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  disk: DiskMetrics | null;
  uptimeSeconds: number;
  platform: string;
  hostname: string;
  collectedAt: number;
}

export interface ISysInfoProvider {
  getMetrics(options?: { diskPath?: string }): Promise<SystemMetrics>;
}
