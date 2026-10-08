import { z } from "zod";
import { EnvelopeBaseSchema, createEnvelope } from "../envelope.js";
import { AgentStreamEventSchema } from "./agent.js";

export const ChatTurnStatusSchema = z.enum(["streaming", "done", "aborted", "error"]);
export type ChatTurnStatus = z.infer<typeof ChatTurnStatusSchema>;

export const ChatTurnSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  text: z.string().optional(),
  toolEvents: z.array(AgentStreamEventSchema).optional(),
  timestamp: z.number(),
  status: ChatTurnStatusSchema.optional(),
});
export type ChatTurn = z.infer<typeof ChatTurnSchema>;

// 1. chat.history.req
export const CHAT_HISTORY_REQ_MESSAGE_TYPE = "chat.history.req" as const;

export const ChatHistoryReqPayloadSchema = z.object({
  projectCwd: z.string().optional(),
  limit: z.number().int().positive().optional(),
});
export type ChatHistoryReqPayload = z.infer<typeof ChatHistoryReqPayloadSchema>;

export const ChatHistoryReqMessageSchema = EnvelopeBaseSchema.extend({
  type: z.literal(CHAT_HISTORY_REQ_MESSAGE_TYPE),
  payload: ChatHistoryReqPayloadSchema,
});
export type ChatHistoryReqMessage = z.infer<typeof ChatHistoryReqMessageSchema>;

export function createChatHistoryReqMessage(
  payload?: ChatHistoryReqPayload,
  options?: { sessionId?: string; id?: string; ts?: number }
): ChatHistoryReqMessage {
  return createEnvelope(CHAT_HISTORY_REQ_MESSAGE_TYPE, payload ?? {}, options) as ChatHistoryReqMessage;
}

// 2. chat.history.resp
export const CHAT_HISTORY_RESP_MESSAGE_TYPE = "chat.history.resp" as const;

export const ChatHistoryRespPayloadSchema = z.object({
  currentCwd: z.string(),
  turns: z.array(ChatTurnSchema),
});
export type ChatHistoryRespPayload = z.infer<typeof ChatHistoryRespPayloadSchema>;

export const ChatHistoryRespMessageSchema = EnvelopeBaseSchema.extend({
  type: z.literal(CHAT_HISTORY_RESP_MESSAGE_TYPE),
  payload: ChatHistoryRespPayloadSchema,
});
export type ChatHistoryRespMessage = z.infer<typeof ChatHistoryRespMessageSchema>;

export function createChatHistoryRespMessage(
  payload: ChatHistoryRespPayload,
  options?: { sessionId?: string; id?: string; ts?: number }
): ChatHistoryRespMessage {
  return createEnvelope(CHAT_HISTORY_RESP_MESSAGE_TYPE, payload, options) as ChatHistoryRespMessage;
}
