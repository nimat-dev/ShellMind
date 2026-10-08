import type { ISpeechToTextProvider } from "./types.js";
import { NativeSpeechToTextProvider } from "./native.js";

let activeProvider: ISpeechToTextProvider = new NativeSpeechToTextProvider();

export function getSpeechToTextProvider(): ISpeechToTextProvider {
  return activeProvider;
}

export function setSpeechToTextProvider(provider: ISpeechToTextProvider): void {
  activeProvider = provider;
}

export function resetSpeechToTextProvider(): void {
  activeProvider = new NativeSpeechToTextProvider();
}
