import { z } from "zod";

export const PROTOCOL_VERSION = 1;

export function generateMessageId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `msg_${time}_${rand}`;
}

export const MessageIdSchema = z.string().regex(/^msg_[a-zA-Z0-9_-]+$/, {
  message: "Message ID must start with msg_ prefix followed by alphanumeric or dash/underscore characters",
});

export const SessionIdSchema = z.string().regex(/^ses_[a-zA-Z0-9_-]+$/, {
  message: "Session ID must start with ses_ prefix",
});

export const EnvelopeBaseSchema = z.object({
  v: z.literal(PROTOCOL_VERSION),
  id: MessageIdSchema,
  type: z.string().min(1),
  sessionId: SessionIdSchema.optional(),
  ts: z.number().int().nonnegative(),
});

export type EnvelopeBase = z.infer<typeof EnvelopeBaseSchema>;

export function createEnvelope<T>(
  type: string,
  payload: T,
  options?: { sessionId?: string; id?: string; ts?: number }
): {
  v: typeof PROTOCOL_VERSION;
  id: string;
  type: string;
  sessionId?: string;
  ts: number;
  payload: T;
} {
  return {
    v: PROTOCOL_VERSION,
    id: options?.id ?? generateMessageId(),
    type,
    sessionId: options?.sessionId,
    ts: options?.ts ?? Date.now(),
    payload,
  };
}
