import type { ChatTurn } from "@shellmind/protocol";

export interface TranscriptFilter {
  limit?: number;
}

export interface ITranscriptStore {
  /**
   * Appends a chat turn to the transcript of a given project key.
   * If the transcript exceeds the maximum configured size, older turns are pruned.
   */
  appendTurn(projectKey: string, turn: ChatTurn): Promise<void>;

  /**
   * Updates an existing turn in the project transcript by ID.
   */
  updateTurn(projectKey: string, turnId: string, update: Partial<ChatTurn>): Promise<void>;

  /**
   * Retrieves the transcript for the given project key, optionally limited to the most recent turns.
   */
  getTranscript(projectKey: string, filter?: TranscriptFilter | number): Promise<ChatTurn[]>;

  /**
   * Clears the transcript for the given project key.
   */
  clearTranscript(projectKey: string): Promise<void>;
}
