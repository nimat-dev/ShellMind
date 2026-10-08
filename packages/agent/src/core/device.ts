/**
 * Device interfaces and types (pure core, no I/O)
 * Defined per architecture/DATA_MODEL.md
 */

export interface PairedDevice {
  id: string; // dev_...
  name: string;
  platform: "ios" | "android" | "cli";
  tokenHash: string; // SHA-256 hash, raw token never stored
  pubkeyFingerprint?: string;
  pairedAt: number;
  lastSeenAt?: number;
  revokedAt?: number;
}

export interface IDeviceRegistry {
  getDevice(id: string): Promise<PairedDevice | null>;
  getDeviceByToken(token: string): Promise<PairedDevice | null>;
  listDevices(): Promise<PairedDevice[]>;
  addDevice(device: PairedDevice): Promise<void>;
  revokeDevice(id: string): Promise<boolean>;
}
