export interface TTSOptions {
  /**
   * Speech rate multiplier (e.g. 1.0 for normal speed).
   */
  rate?: number;

  /**
   * Speech pitch multiplier (e.g. 1.0 for standard pitch).
   */
  pitch?: number;

  /**
   * BCP 47 language tag (e.g. "en-US").
   */
  language?: string;

  /**
   * Callback fired when speech synthesis starts.
   */
  onStart?: () => void;

  /**
   * Callback fired when speech synthesis finishes normally.
   */
  onDone?: () => void;

  /**
   * Callback fired if an error occurs during speech playback.
   */
  onError?: (error: Error) => void;
}

export interface ITextToSpeechProvider {
  /**
   * Checks if text-to-speech synthesis is available on this platform/device.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Speaks the provided text aloud.
   * If speech is already in progress, any ongoing speech is stopped first.
   */
  speak(text: string, options?: TTSOptions): Promise<void>;

  /**
   * Immediately stops any ongoing speech output.
   */
  stop(): Promise<void>;

  /**
   * Returns true if speech synthesis is currently active.
   */
  isSpeaking(): boolean;
}
