import { Platform, NativeModules } from "react-native";
import type { ISpeechToTextProvider, SpeechPermissionStatus } from "./types.js";

/**
 * Native Speech-to-Text provider targeting iOS SFSpeechRecognizer.
 * Falls back safely if the native speech module is not linked or unavailable.
 */
export class NativeSpeechToTextProvider implements ISpeechToTextProvider {
  private recording = false;
  private currentTranscript = "";

  private getNativeModule(): Record<string, unknown> | null {
    try {
      const native = (NativeModules as Record<string, unknown> | undefined)?.["SpeechRecognitionModule"];
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
    return false;
  }

  public async requestPermission(): Promise<SpeechPermissionStatus> {
    const module = this.getNativeModule();
    if (
      module &&
      typeof (module as { requestPermission?: () => Promise<SpeechPermissionStatus> })
        .requestPermission === "function"
    ) {
      try {
        return await (
          module as { requestPermission: () => Promise<SpeechPermissionStatus> }
        ).requestPermission();
      } catch {
        return "denied";
      }
    }
    return "undetermined";
  }

  public async startRecording(onInterimResult?: (interimText: string) => void): Promise<void> {
    const available = await this.isAvailable();
    if (!available) {
      throw new Error("Speech recognition is not available on this device");
    }

    const perm = await this.requestPermission();
    if (perm !== "granted") {
      throw new Error("Microphone permission was denied");
    }

    this.recording = true;
    this.currentTranscript = "";

    const module = this.getNativeModule();
    if (
      module &&
      typeof (module as { start?: (cb?: (t: string) => void) => Promise<void> }).start ===
        "function"
    ) {
      await (module as { start: (cb?: (t: string) => void) => Promise<void> }).start(
        (interim) => {
          this.currentTranscript = interim;
          if (onInterimResult) {
            onInterimResult(interim);
          }
        }
      );
    }
  }

  public async stopRecording(): Promise<string> {
    if (!this.recording) {
      return "";
    }
    this.recording = false;

    const module = this.getNativeModule();
    if (
      module &&
      typeof (module as { stop?: () => Promise<string> }).stop === "function"
    ) {
      try {
        const finalResult = await (module as { stop: () => Promise<string> }).stop();
        return finalResult || this.currentTranscript;
      } catch {
        return this.currentTranscript;
      }
    }

    return this.currentTranscript;
  }

  public async cancelRecording(): Promise<void> {
    this.recording = false;
    this.currentTranscript = "";

    const module = this.getNativeModule();
    if (
      module &&
      typeof (module as { cancel?: () => Promise<void> }).cancel === "function"
    ) {
      try {
        await (module as { cancel: () => Promise<void> }).cancel();
      } catch {
        // Ignored
      }
    }
  }

  public isRecording(): boolean {
    return this.recording;
  }
}
