import { z } from "zod";
import { EnvelopeBaseSchema, createEnvelope } from "../envelope.js";

export const HELLO_MESSAGE_TYPE = "hello" as const;
export const HELLO_ACK_MESSAGE_TYPE = "hello.ack" as const;
export const HELLO_REJECT_MESSAGE_TYPE = "hello.reject" as const;

export const DeviceIdSchema = z.string().regex(/^dev_[a-zA-Z0-9_-]+$/, {
  message: "Device ID must start with dev_ prefix",
});

export const HelloPayloadSchema = z.object({
  deviceId: DeviceIdSchema,
  token: z.string().min(1),
  clientVersion: z.string().min(1),
  platform: z.enum(["ios", "android", "cli"]).default("ios"),
});

export type HelloPayload = z.infer<typeof HelloPayloadSchema>;

export const HelloMessageSchema = EnvelopeBaseSchema.extend({
  type: z.literal(HELLO_MESSAGE_TYPE),
  payload: HelloPayloadSchema,
});

export type HelloMessage = z.infer<typeof HelloMessageSchema>;

export const HelloAckPayloadSchema = z.object({
  sessionId: z.string().regex(/^ses_[a-zA-Z0-9_-]+$/),
  agentVersion: z.string().min(1),
  serverName: z.string().min(1),
});

export type HelloAckPayload = z.infer<typeof HelloAckPayloadSchema>;

export const HelloAckMessageSchema = EnvelopeBaseSchema.extend({
  type: z.literal(HELLO_ACK_MESSAGE_TYPE),
  payload: HelloAckPayloadSchema,
});

export type HelloAckMessage = z.infer<typeof HelloAckMessageSchema>;

export const HelloRejectCodeSchema = z.enum([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "REVOKED",
  "PROTOCOL_MISMATCH",
  "MALFORMED_HANDSHAKE",
]);

export type HelloRejectCode = z.infer<typeof HelloRejectCodeSchema>;

export const HelloRejectPayloadSchema = z.object({
  code: HelloRejectCodeSchema,
  message: z.string().min(1),
});

export type HelloRejectPayload = z.infer<typeof HelloRejectPayloadSchema>;

export const HelloRejectMessageSchema = EnvelopeBaseSchema.extend({
  type: z.literal(HELLO_REJECT_MESSAGE_TYPE),
  payload: HelloRejectPayloadSchema,
});

export type HelloRejectMessage = z.infer<typeof HelloRejectMessageSchema>;

export function createHelloMessage(
  payload: HelloPayload,
  options?: { sessionId?: string; id?: string; ts?: number }
): HelloMessage {
  return createEnvelope(HELLO_MESSAGE_TYPE, payload, options) as HelloMessage;
}

export function createHelloAckMessage(
  payload: HelloAckPayload,
  options?: { sessionId?: string; id?: string; ts?: number }
): HelloAckMessage {
  return createEnvelope(HELLO_ACK_MESSAGE_TYPE, payload, options) as HelloAckMessage;
}

export function createHelloRejectMessage(
  payload: HelloRejectPayload,
  options?: { sessionId?: string; id?: string; ts?: number }
): HelloRejectMessage {
  return createEnvelope(HELLO_REJECT_MESSAGE_TYPE, payload, options) as HelloRejectMessage;
}
