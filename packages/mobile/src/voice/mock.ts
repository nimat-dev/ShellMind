import type { ISpeechToTextProvider, SpeechPermissionStatus } from "./types.js";

export interface MockSTTOptions {
  available?: boolean;
  permission?: SpeechPermissionStatus;
  fixtureText?: string;
  delayMs?: number;
}

export class MockSpeechToTextProvider implements ISpeechToTextProvider {
  private available: boolean;
  private permission: SpeechPermissionStatus;
  private fixtureText: string;
  private delayMs: number;
  private recording = false;
  private interimTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: MockSTTOptions = {}) {
    this.available = options.available ?? true;
    this.permission = options.permission ?? "granted";
    this.fixtureText = options.fixtureText ?? "Check git status and run tests";
    this.delayMs = options.delayMs ?? 10;
  }

  public setFixtureText(text: string): void {
    this.fixtureText = text;
  }

  public setPermission(permission: SpeechPermissionStatus): void {
    this.permission = permission;
  }

  public setAvailable(available: boolean): void {
    this.available = available;
  }

  public async isAvailable(): Promise<boolean> {
    return this.available;
  }

  public async requestPermission(): Promise<SpeechPermissionStatus> {
    return this.permission;
  }

  public async startRecording(onInterimResult?: (interimText: string) => void): Promise<void> {
    if (!this.available) {
      throw new Error("Speech recognition is not available on this device");
    }
    if (this.permission !== "granted") {
      throw new Error("Microphone permission was denied");
    }
    this.recording = true;

    if (onInterimResult && this.fixtureText) {
      const words = this.fixtureText.split(" ");
      if (words.length > 1) {
        this.interimTimer = setTimeout(() => {
          if (this.recording) {
            onInterimResult(words.slice(0, Math.ceil(words.length / 2)).join(" "));
          }
        }, this.delayMs);
      }
    }
  }

  public async stopRecording(): Promise<string> {
    if (this.interimTimer) {
      clearTimeout(this.interimTimer);
      this.interimTimer = null;
    }
    if (!this.recording) {
      return "";
    }
    this.recording = false;
    return this.fixtureText;
  }

  public async cancelRecording(): Promise<void> {
    if (this.interimTimer) {
      clearTimeout(this.interimTimer);
      this.interimTimer = null;
    }
    this.recording = false;
  }

  public isRecording(): boolean {
    return this.recording;
  }
}
