import type { ISpeechToTextProvider } from "./types.js";
import { NativeSpeechToTextProvider } from "./native.js";
import type { ITextToSpeechProvider } from "./tts-types.js";
import { NativeTextToSpeechProvider } from "./native-tts.js";

let activeSTTProvider: ISpeechToTextProvider = new NativeSpeechToTextProvider();
let activeTTSProvider: ITextToSpeechProvider = new NativeTextToSpeechProvider();

// Speech-To-Text (STT) Registry Accessors
export function getSpeechToTextProvider(): ISpeechToTextProvider {
  return activeSTTProvider;
}

export function setSpeechToTextProvider(provider: ISpeechToTextProvider): void {
  activeSTTProvider = provider;
}

export function resetSpeechToTextProvider(): void {
  activeSTTProvider = new NativeSpeechToTextProvider();
}

// Text-To-Speech (TTS) Registry Accessors
export function getTextToSpeechProvider(): ITextToSpeechProvider {
  return activeTTSProvider;
}

export function setTextToSpeechProvider(provider: ITextToSpeechProvider): void {
  activeTTSProvider = provider;
}

export function resetTextToSpeechProvider(): void {
  activeTTSProvider = new NativeTextToSpeechProvider();
}
