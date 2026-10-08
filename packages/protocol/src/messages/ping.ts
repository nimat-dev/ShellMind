import { z } from "zod";
import { EnvelopeBaseSchema, createEnvelope } from "../envelope.js";

export const PING_MESSAGE_TYPE = "ping" as const;

export const PingPayloadSchema = z.object({
  nonce: z.string().min(1).optional(),
});

export type PingPayload = z.infer<typeof PingPayloadSchema>;

export const PingMessageSchema = EnvelopeBaseSchema.extend({
  type: z.literal(PING_MESSAGE_TYPE),
  payload: PingPayloadSchema,
});

export type PingMessage = z.infer<typeof PingMessageSchema>;

export function createPingMessage(
  payload: PingPayload = {},
  options?: { sessionId?: string; id?: string; ts?: number }
): PingMessage {
  return createEnvelope(PING_MESSAGE_TYPE, payload, options) as PingMessage;
}
