import { Platform, NativeModules } from "react-native";
import type { ITextToSpeechProvider, TTSOptions } from "./tts-types.js";

/**
 * Native Text-to-Speech provider targeting iOS AVSpeechSynthesizer / Expo Speech.
 * Falls back safely if the platform speech module is not linked or unavailable.
 */
export class NativeTextToSpeechProvider implements ITextToSpeechProvider {
  private speaking = false;

  private getNativeModule(): Record<string, unknown> | null {
    try {
      const native = (NativeModules as Record<string, unknown> | undefined)?.["TextToSpeechModule"];
      if (native && typeof native === "object") {
        return native as Record<string, unknown>;
      }
    } catch {
      // Platform or environment without NativeModules
    }
    return null;
  }

  public async isAvailable(): Promise<boolean> {
    if (Platform.OS !== "ios") {
      // On web or non-iOS environments, check window.speechSynthesis if present
      if (typeof globalThis !== "undefined" && "speechSynthesis" in globalThis) {
        return true;
      }
      return false;
    }

    const module = this.getNativeModule();
    if (module && typeof (module as { isAvailable?: () => Promise<boolean> }).isAvailable === "function") {
      try {
        return await (module as { isAvailable: () => Promise<boolean> }).isAvailable();
      } catch {
        return false;
      }
    }

    // Default to true on iOS as AVSpeechSynthesizer is standard system capability
    return true;
  }

  public async speak(text: string, options?: TTSOptions): Promise<void> {
    if (!text || !text.trim()) {
      return;
    }

    await this.stop();

    const available = await this.isAvailable();
    if (!available) {
      const err = new Error("Text-to-speech is not available on this device");
      options?.onError?.(err);
      return;
    }

    this.speaking = true;
    options?.onStart?.();

    // 1. Try native module if linked
    const module = this.getNativeModule();
    if (module && typeof (module as { speak?: (t: string, opts?: unknown) => Promise<void> }).speak === "function") {
      try {
        await (module as { speak: (t: string, opts?: unknown) => Promise<void> }).speak(text, {
          rate: options?.rate,
          pitch: options?.pitch,
          language: options?.language ?? "en-US",
        });
        this.speaking = false;
        options?.onDone?.();
        return;
      } catch (err) {
        this.speaking = false;
        options?.onError?.(err as Error);
        return;
      }
    }

    // 2. Try browser SpeechSynthesis if running in web/Expo web environment
    if (
      typeof globalThis !== "undefined" &&
      "speechSynthesis" in globalThis &&
      typeof (globalThis as unknown as { SpeechSynthesisUtterance?: new (t: string) => unknown })
        .SpeechSynthesisUtterance !== "undefined"
    ) {
      try {
        const synth = (globalThis as unknown as { speechSynthesis: { speak: (u: unknown) => void; cancel: () => void } }).speechSynthesis;
        const Utterance = (globalThis as unknown as { SpeechSynthesisUtterance: new (t: string) => { onend?: () => void; onerror?: (e: unknown) => void; rate?: number; pitch?: number; lang?: string } }).SpeechSynthesisUtterance;
        const utterance = new Utterance(text);
        if (options?.rate) utterance.rate = options.rate;
        if (options?.pitch) utterance.pitch = options.pitch;
        utterance.lang = options?.language ?? "en-US";

        utterance.onend = () => {
          this.speaking = false;
          options?.onDone?.();
        };
        utterance.onerror = (e) => {
          this.speaking = false;
          options?.onError?.(new Error(String(e)));
        };

        synth.speak(utterance);
        return;
      } catch {
        // Fall through to safe mock fallback
      }
    }

    // 3. Fallback: complete gracefully without hanging
    this.speaking = false;
    options?.onDone?.();
  }

  public async stop(): Promise<void> {
    this.speaking = false;

    const module = this.getNativeModule();
    if (module && typeof (module as { stop?: () => Promise<void> }).stop === "function") {
      try {
        await (module as { stop: () => Promise<void> }).stop();
      } catch {
        // Ignored
      }
    }

    if (typeof globalThis !== "undefined" && "speechSynthesis" in globalThis) {
      try {
        (globalThis as unknown as { speechSynthesis: { cancel: () => void } }).speechSynthesis.cancel();
      } catch {
        // Ignored
      }
    }
  }

  public isSpeaking(): boolean {
    return this.speaking;
  }
}
