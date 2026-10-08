import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type { IDeviceRegistry, PairedDevice } from "../../core/device.js";

export class FileDeviceRegistry implements IDeviceRegistry {
  private devices: Map<string, PairedDevice> = new Map();

  constructor(private readonly filePath: string) {
    this.ensureDirectory();
    this.load();
  }

  public static hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  public static generatePairingToken(): string {
    return `tok_${crypto.randomBytes(24).toString("hex")}`;
  }

  public static generateDeviceId(): string {
    const rand = crypto.randomBytes(4).toString("hex");
    const ts = Date.now().toString(36);
    return `dev_${ts}_${rand}`;
  }

  public async getDevice(id: string): Promise<PairedDevice | null> {
    return this.devices.get(id) ?? null;
  }

  public async getDeviceByToken(token: string): Promise<PairedDevice | null> {
    const hash = FileDeviceRegistry.hashToken(token);
    for (const dev of this.devices.values()) {
      if (dev.tokenHash === hash) {
        return dev;
      }
    }
    return null;
  }

  public async listDevices(): Promise<PairedDevice[]> {
    return Array.from(this.devices.values());
  }

  public async addDevice(device: PairedDevice): Promise<void> {
    this.devices.set(device.id, { ...device });
    this.save();
  }

  public async revokeDevice(id: string): Promise<boolean> {
    const dev = this.devices.get(id);
    if (!dev) return false;
    dev.revokedAt = Date.now();
    this.save();
    return true;
  }

  public createPairing(name: string, platform: "ios" | "android" | "cli" = "ios"): {
    device: PairedDevice;
    rawToken: string;
  } {
    const id = FileDeviceRegistry.generateDeviceId();
    const rawToken = FileDeviceRegistry.generatePairingToken();
    const tokenHash = FileDeviceRegistry.hashToken(rawToken);

    const device: PairedDevice = {
      id,
      name,
      platform,
      tokenHash,
      pairedAt: Date.now(),
    };

    this.devices.set(id, device);
    this.save();

    return { device, rawToken };
  }

  private ensureDirectory(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
  }

  private load(): void {
    if (!fs.existsSync(this.filePath)) {
      this.save();
      return;
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const list: PairedDevice[] = JSON.parse(raw);
      this.devices.clear();
      for (const dev of list) {
        this.devices.set(dev.id, dev);
      }
    } catch {
      this.devices.clear();
    }
  }

  private save(): void {
    this.ensureDirectory();
    const list = Array.from(this.devices.values());
    const json = JSON.stringify(list, null, 2);
    fs.writeFileSync(this.filePath, json, { mode: 0o600 });
    fs.chmodSync(this.filePath, 0o600);
  }
}
