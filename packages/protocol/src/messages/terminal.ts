import { z } from "zod";
import { EnvelopeBaseSchema, createEnvelope } from "../envelope.js";

// 1. term.open
export const TERM_OPEN_MESSAGE_TYPE = "term.open" as const;

export const TermOpenPayloadSchema = z.object({
  cols: z.number().int().positive().default(80),
  rows: z.number().int().positive().default(24),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
});

export type TermOpenPayload = z.infer<typeof TermOpenPayloadSchema>;

export const TermOpenMessageSchema = EnvelopeBaseSchema.extend({
  type: z.literal(TERM_OPEN_MESSAGE_TYPE),
  payload: TermOpenPayloadSchema,
});

export type TermOpenMessage = z.infer<typeof TermOpenMessageSchema>;

export function createTermOpenMessage(
  payload: Partial<TermOpenPayload> = {},
  options?: { sessionId?: string; id?: string; ts?: number }
): TermOpenMessage {
  return createEnvelope(
    TERM_OPEN_MESSAGE_TYPE,
    {
      cols: payload.cols ?? 80,
      rows: payload.rows ?? 24,
      cwd: payload.cwd,
      env: payload.env,
    },
    options
  ) as TermOpenMessage;
}

// 2. term.input
export const TERM_INPUT_MESSAGE_TYPE = "term.input" as const;

export const TermInputPayloadSchema = z.object({
  data: z.string(),
});

export type TermInputPayload = z.infer<typeof TermInputPayloadSchema>;

export const TermInputMessageSchema = EnvelopeBaseSchema.extend({
  type: z.literal(TERM_INPUT_MESSAGE_TYPE),
  payload: TermInputPayloadSchema,
});

export type TermInputMessage = z.infer<typeof TermInputMessageSchema>;

export function createTermInputMessage(
  payload: TermInputPayload,
  options?: { sessionId?: string; id?: string; ts?: number }
): TermInputMessage {
  return createEnvelope(TERM_INPUT_MESSAGE_TYPE, payload, options) as TermInputMessage;
}

// 3. term.data
export const TERM_DATA_MESSAGE_TYPE = "term.data" as const;

export const TermDataPayloadSchema = z.object({
  data: z.string(),
});

export type TermDataPayload = z.infer<typeof TermDataPayloadSchema>;

export const TermDataMessageSchema = EnvelopeBaseSchema.extend({
  type: z.literal(TERM_DATA_MESSAGE_TYPE),
  payload: TermDataPayloadSchema,
});

export type TermDataMessage = z.infer<typeof TermDataMessageSchema>;

export function createTermDataMessage(
  payload: TermDataPayload,
  options?: { sessionId?: string; id?: string; ts?: number }
): TermDataMessage {
  return createEnvelope(TERM_DATA_MESSAGE_TYPE, payload, options) as TermDataMessage;
}

// 4. term.resize
export const TERM_RESIZE_MESSAGE_TYPE = "term.resize" as const;

export const TermResizePayloadSchema = z.object({
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
});

export type TermResizePayload = z.infer<typeof TermResizePayloadSchema>;

export const TermResizeMessageSchema = EnvelopeBaseSchema.extend({
  type: z.literal(TERM_RESIZE_MESSAGE_TYPE),
  payload: TermResizePayloadSchema,
});

export type TermResizeMessage = z.infer<typeof TermResizeMessageSchema>;

export function createTermResizeMessage(
  payload: TermResizePayload,
  options?: { sessionId?: string; id?: string; ts?: number }
): TermResizeMessage {
  return createEnvelope(TERM_RESIZE_MESSAGE_TYPE, payload, options) as TermResizeMessage;
}

// 5. term.exit
export const TERM_EXIT_MESSAGE_TYPE = "term.exit" as const;

export const TermExitPayloadSchema = z.object({
  exitCode: z.number().int(),
  signal: z.number().int().optional(),
});

export type TermExitPayload = z.infer<typeof TermExitPayloadSchema>;

export const TermExitMessageSchema = EnvelopeBaseSchema.extend({
  type: z.literal(TERM_EXIT_MESSAGE_TYPE),
  payload: TermExitPayloadSchema,
});

export type TermExitMessage = z.infer<typeof TermExitMessageSchema>;

export function createTermExitMessage(
  payload: TermExitPayload,
  options?: { sessionId?: string; id?: string; ts?: number }
): TermExitMessage {
  return createEnvelope(TERM_EXIT_MESSAGE_TYPE, payload, options) as TermExitMessage;
}
