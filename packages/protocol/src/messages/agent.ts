import { z } from "zod";
import { EnvelopeBaseSchema, createEnvelope } from "../envelope.js";

// --- Agent Stream Event Schemas ---

export const AssistantTextEventSchema = z.object({
  type: z.literal("assistant_text"),
  text: z.string(),
  messageId: z.string().optional(),
});
export type AssistantTextEvent = z.infer<typeof AssistantTextEventSchema>;

export const ToolUseEventSchema = z.object({
  type: z.literal("tool_use"),
  toolName: z.string(),
  toolUseId: z.string(),
  input: z.record(z.unknown()),
});
export type ToolUseEvent = z.infer<typeof ToolUseEventSchema>;

export const ToolResultEventSchema = z.object({
  type: z.literal("tool_result"),
  toolUseId: z.string(),
  content: z.string(),
  isError: z.boolean(),
});
export type ToolResultEvent = z.infer<typeof ToolResultEventSchema>;

export const RateLimitEventSchema = z.object({
  type: z.literal("rate_limit"),
  utilization: z.number(),
  resetsAt: z.number(),
  rateLimitType: z.string(),
});
export type RateLimitEvent = z.infer<typeof RateLimitEventSchema>;

export const DoneEventSchema = z.object({
  type: z.literal("done"),
  result: z.string(),
  costUsd: z.number().default(0),
  durationMs: z.number().default(0),
});
export type DoneEvent = z.infer<typeof DoneEventSchema>;

export const AbortedEventSchema = z.object({
  type: z.literal("aborted"),
  reason: z.string().optional(),
});
export type AbortedEvent = z.infer<typeof AbortedEventSchema>;

export const ErrorEventSchema = z.object({
  type: z.literal("error"),
  error: z.string(),
  code: z.string().optional(),
});
export type ErrorEvent = z.infer<typeof ErrorEventSchema>;

export const AgentStreamEventSchema = z.discriminatedUnion("type", [
  AssistantTextEventSchema,
  ToolUseEventSchema,
  ToolResultEventSchema,
  RateLimitEventSchema,
  DoneEventSchema,
  AbortedEventSchema,
  ErrorEventSchema,
]);
export type AgentStreamEvent = z.infer<typeof AgentStreamEventSchema>;

// --- Messages ---

// 1. agent.prompt
export const AGENT_PROMPT_MESSAGE_TYPE = "agent.prompt" as const;

export const AgentPromptPayloadSchema = z.object({
  prompt: z.string().min(1),
  cwd: z.string().optional(),
});
export type AgentPromptPayload = z.infer<typeof AgentPromptPayloadSchema>;

export const AgentPromptMessageSchema = EnvelopeBaseSchema.extend({
  type: z.literal(AGENT_PROMPT_MESSAGE_TYPE),
  payload: AgentPromptPayloadSchema,
});
export type AgentPromptMessage = z.infer<typeof AgentPromptMessageSchema>;

export function createAgentPromptMessage(
  payload: AgentPromptPayload,
  options?: { sessionId?: string; id?: string; ts?: number }
): AgentPromptMessage {
  return createEnvelope(AGENT_PROMPT_MESSAGE_TYPE, payload, options) as AgentPromptMessage;
}

// 2. agent.stream
export const AGENT_STREAM_MESSAGE_TYPE = "agent.stream" as const;

export const AgentStreamPayloadSchema = z.object({
  event: AgentStreamEventSchema,
});
export type AgentStreamPayload = z.infer<typeof AgentStreamPayloadSchema>;

export const AgentStreamMessageSchema = EnvelopeBaseSchema.extend({
  type: z.literal(AGENT_STREAM_MESSAGE_TYPE),
  payload: AgentStreamPayloadSchema,
});
export type AgentStreamMessage = z.infer<typeof AgentStreamMessageSchema>;

export function createAgentStreamMessage(
  payload: AgentStreamPayload,
  options?: { sessionId?: string; id?: string; ts?: number }
): AgentStreamMessage {
  return createEnvelope(AGENT_STREAM_MESSAGE_TYPE, payload, options) as AgentStreamMessage;
}

// 3. agent.abort
export const AGENT_ABORT_MESSAGE_TYPE = "agent.abort" as const;

export const AgentAbortPayloadSchema = z.object({
  reason: z.string().optional(),
});
export type AgentAbortPayload = z.infer<typeof AgentAbortPayloadSchema>;

export const AgentAbortMessageSchema = EnvelopeBaseSchema.extend({
  type: z.literal(AGENT_ABORT_MESSAGE_TYPE),
  payload: AgentAbortPayloadSchema.default({}),
});
export type AgentAbortMessage = z.infer<typeof AgentAbortMessageSchema>;

export function createAgentAbortMessage(
  payload: AgentAbortPayload = {},
  options?: { sessionId?: string; id?: string; ts?: number }
): AgentAbortMessage {
  return createEnvelope(AGENT_ABORT_MESSAGE_TYPE, payload, options) as AgentAbortMessage;
}
