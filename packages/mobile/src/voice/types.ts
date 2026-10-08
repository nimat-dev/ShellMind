export type SpeechPermissionStatus = "granted" | "denied" | "undetermined";

export interface ISpeechToTextProvider {
  /**
   * Checks if speech recognition is available on this platform/device.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Requests permission to record audio and perform speech recognition.
   */
  requestPermission(): Promise<SpeechPermissionStatus>;

  /**
   * Starts speech recognition recording.
   * If onInterimResult is provided, it is invoked as speech is recognized in real time.
   */
  startRecording(onInterimResult?: (interimText: string) => void): Promise<void>;

  /**
   * Stops recording and returns the final recognized text.
   */
  stopRecording(): Promise<string>;

  /**
   * Cancels the recording and discards audio without producing final text.
   */
  cancelRecording(): Promise<void>;

  /**
   * Returns true if recording is currently active.
   */
  isRecording(): boolean;
}
