import { z } from "zod";
import { EnvelopeBaseSchema, createEnvelope } from "../envelope.js";

export const ERROR_MESSAGE_TYPE = "error" as const;

export const ErrorPayloadSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.record(z.unknown()).optional(),
});

export type ErrorPayload = z.infer<typeof ErrorPayloadSchema>;

export const ErrorMessageSchema = EnvelopeBaseSchema.extend({
  type: z.literal(ERROR_MESSAGE_TYPE),
  payload: ErrorPayloadSchema,
});

export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;

export function createErrorMessage(
  payload: ErrorPayload,
  options?: { sessionId?: string; id?: string; ts?: number }
): ErrorMessage {
  return createEnvelope(ERROR_MESSAGE_TYPE, payload, options) as ErrorMessage;
}
