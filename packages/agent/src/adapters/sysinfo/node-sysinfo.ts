import * as os from "node:os";
import * as fs from "node:fs";
import type {
  ISysInfoProvider,
  SystemMetrics,
  CpuMetrics,
  MemoryMetrics,
  DiskMetrics,
} from "../../core/sysinfo.js";

export class NodeSysInfoProvider implements ISysInfoProvider {
  private prevCpuTimes: Array<{ idle: number; total: number }> | null = null;

  public async getMetrics(options?: { diskPath?: string }): Promise<SystemMetrics> {
    const cpu = this.getCpuMetrics();
    const memory = this.getMemoryMetrics();
    const disk = await this.getDiskMetrics(options?.diskPath);
    const uptimeSeconds = Math.floor(os.uptime());
    const platform = os.platform();
    const hostname = os.hostname();
    const collectedAt = Date.now();

    return {
      cpu,
      memory,
      disk,
      uptimeSeconds,
      platform,
      hostname,
      collectedAt,
    };
  }

  private getCpuMetrics(): CpuMetrics {
    const cpus = os.cpus();
    const cores = cpus.length || 1;

    const currentTimes = cpus.map((cpu) => {
      const times = cpu.times;
      const total = times.user + times.nice + times.sys + times.idle + times.irq;
      return { idle: times.idle, total };
    });

    let percent = 0;

    if (this.prevCpuTimes && this.prevCpuTimes.length === currentTimes.length) {
      let totalDelta = 0;
      let idleDelta = 0;

      for (let i = 0; i < currentTimes.length; i++) {
        const cur = currentTimes[i]!;
        const prev = this.prevCpuTimes[i]!;
        totalDelta += cur.total - prev.total;
        idleDelta += cur.idle - prev.idle;
      }

      if (totalDelta > 0) {
        const usage = 1 - idleDelta / totalDelta;
        percent = Math.max(0, Math.min(100, Math.round(usage * 1000) / 10));
      }
    } else {
      // First call fallback using load average (scaled by core count)
      const load = os.loadavg()[0] || 0;
      percent = Math.max(0, Math.min(100, Math.round((load / cores) * 1000) / 10));
    }

    this.prevCpuTimes = currentTimes;

    return {
      percent,
      cores,
    };
  }

  private getMemoryMetrics(): MemoryMetrics {
    const totalBytes = os.totalmem();
    const freeBytes = os.freemem();
    const usedBytes = Math.max(0, totalBytes - freeBytes);
    const percent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0;

    return {
      usedBytes,
      totalBytes,
      percent,
    };
  }

  private async getDiskMetrics(targetPath?: string): Promise<DiskMetrics | null> {
    const diskPath = targetPath || (process.platform === "win32" ? "C:\\" : "/");

    try {
      if (typeof fs.promises.statfs === "function") {
        const stats = await fs.promises.statfs(diskPath);
        const bsize = stats.bsize;
        const totalBytes = stats.blocks * bsize;
        const freeBytes = stats.bavail * bsize;
        const usedBytes = Math.max(0, totalBytes - freeBytes);
        const percent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0;

        return {
          usedBytes,
          totalBytes,
          percent,
          mount: diskPath,
        };
      }
    } catch {
      // In case path is inaccessible or statfs fails on custom environments
    }

    return null;
  }
}
