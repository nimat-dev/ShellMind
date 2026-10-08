import { z } from "zod";
import { EnvelopeBaseSchema, createEnvelope } from "../envelope.js";

export const PONG_MESSAGE_TYPE = "pong" as const;

export const PongPayloadSchema = z.object({
  nonce: z.string().min(1).optional(),
  receivedAt: z.number().int().nonnegative().optional(),
});

export type PongPayload = z.infer<typeof PongPayloadSchema>;

export const PongMessageSchema = EnvelopeBaseSchema.extend({
  type: z.literal(PONG_MESSAGE_TYPE),
  payload: PongPayloadSchema,
});

export type PongMessage = z.infer<typeof PongMessageSchema>;

export function createPongMessage(
  payload: PongPayload = {},
  options?: { sessionId?: string; id?: string; ts?: number }
): PongMessage {
  return createEnvelope(PONG_MESSAGE_TYPE, payload, options) as PongMessage;
}
