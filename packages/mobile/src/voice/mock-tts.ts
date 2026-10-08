import type { ITextToSpeechProvider, TTSOptions } from "./tts-types.js";

export interface MockTTSOptions {
  available?: boolean;
  autoComplete?: boolean;
  delayMs?: number;
  shouldError?: boolean;
  errorMessage?: string;
}

export class MockTextToSpeechProvider implements ITextToSpeechProvider {
  private available: boolean;
  private autoComplete: boolean;
  private delayMs: number;
  private shouldError: boolean;
  private errorMessage: string;
  private speaking = false;
  private spokenHistory: string[] = [];
  private currentText: string | null = null;
  private currentTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: MockTTSOptions = {}) {
    this.available = options.available ?? true;
    this.autoComplete = options.autoComplete ?? false;
    this.delayMs = options.delayMs ?? 10;
    this.shouldError = options.shouldError ?? false;
    this.errorMessage = options.errorMessage ?? "TTS playback error";
  }

  public setAvailable(available: boolean): void {
    this.available = available;
  }

  public setShouldError(shouldError: boolean, message?: string): void {
    this.shouldError = shouldError;
    if (message) {
      this.errorMessage = message;
    }
  }

  public setAutoComplete(autoComplete: boolean): void {
    this.autoComplete = autoComplete;
  }

  public async isAvailable(): Promise<boolean> {
    return this.available;
  }

  public async speak(text: string, options?: TTSOptions): Promise<void> {
    if (!this.available) {
      const err = new Error("Text-to-speech is not available on this device");
      options?.onError?.(err);
      throw err;
    }

    if (this.shouldError) {
      const err = new Error(this.errorMessage);
      options?.onError?.(err);
      throw err;
    }

    // Always interrupt previous speech to prevent overlapping audio
    await this.stop();

    if (!text || !text.trim()) {
      return;
    }

    this.speaking = true;
    this.currentText = text;
    this.spokenHistory.push(text);

    options?.onStart?.();

    if (this.autoComplete) {
      this.currentTimer = setTimeout(() => {
        if (this.speaking && this.currentText === text) {
          this.speaking = false;
          this.currentText = null;
          options?.onDone?.();
        }
      }, this.delayMs);
    }
  }

  public async stop(): Promise<void> {
    if (this.currentTimer) {
      clearTimeout(this.currentTimer);
      this.currentTimer = null;
    }
    this.speaking = false;
    this.currentText = null;
  }

  public isSpeaking(): boolean {
    return this.speaking;
  }

  public getSpokenHistory(): string[] {
    return [...this.spokenHistory];
  }

  public getLastSpoken(): string | null {
    return this.spokenHistory[this.spokenHistory.length - 1] ?? null;
  }

  public clearHistory(): void {
    this.spokenHistory = [];
  }
}
