import { z } from "zod";
import { EnvelopeBaseSchema, createEnvelope } from "../envelope.js";

// --- Types ---
export const ProjectEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
});
export type ProjectEntry = z.infer<typeof ProjectEntrySchema>;

// 1. project.list
export const PROJECT_LIST_MESSAGE_TYPE = "project.list" as const;

export const ProjectListPayloadSchema = z.object({}).default({});
export type ProjectListPayload = z.infer<typeof ProjectListPayloadSchema>;

export const ProjectListMessageSchema = EnvelopeBaseSchema.extend({
  type: z.literal(PROJECT_LIST_MESSAGE_TYPE),
  payload: ProjectListPayloadSchema,
});
export type ProjectListMessage = z.infer<typeof ProjectListMessageSchema>;

export function createProjectListMessage(
  payload: ProjectListPayload = {},
  options?: { sessionId?: string; id?: string; ts?: number }
): ProjectListMessage {
  return createEnvelope(PROJECT_LIST_MESSAGE_TYPE, payload, options) as ProjectListMessage;
}

// 2. project.list.resp
export const PROJECT_LIST_RESP_MESSAGE_TYPE = "project.list.resp" as const;

export const ProjectListRespPayloadSchema = z.object({
  currentCwd: z.string(),
  projects: z.array(ProjectEntrySchema),
});
export type ProjectListRespPayload = z.infer<typeof ProjectListRespPayloadSchema>;

export const ProjectListRespMessageSchema = EnvelopeBaseSchema.extend({
  type: z.literal(PROJECT_LIST_RESP_MESSAGE_TYPE),
  payload: ProjectListRespPayloadSchema,
});
export type ProjectListRespMessage = z.infer<typeof ProjectListRespMessageSchema>;

export function createProjectListRespMessage(
  payload: ProjectListRespPayload,
  options?: { sessionId?: string; id?: string; ts?: number }
): ProjectListRespMessage {
  return createEnvelope(PROJECT_LIST_RESP_MESSAGE_TYPE, payload, options) as ProjectListRespMessage;
}

// 3. project.set
export const PROJECT_SET_MESSAGE_TYPE = "project.set" as const;

export const ProjectSetPayloadSchema = z.object({
  cwd: z.string().min(1),
});
export type ProjectSetPayload = z.infer<typeof ProjectSetPayloadSchema>;

export const ProjectSetMessageSchema = EnvelopeBaseSchema.extend({
  type: z.literal(PROJECT_SET_MESSAGE_TYPE),
  payload: ProjectSetPayloadSchema,
});
export type ProjectSetMessage = z.infer<typeof ProjectSetMessageSchema>;

export function createProjectSetMessage(
  payload: ProjectSetPayload,
  options?: { sessionId?: string; id?: string; ts?: number }
): ProjectSetMessage {
  return createEnvelope(PROJECT_SET_MESSAGE_TYPE, payload, options) as ProjectSetMessage;
}

// 4. project.set.resp
export const PROJECT_SET_RESP_MESSAGE_TYPE = "project.set.resp" as const;

export const ProjectSetRespPayloadSchema = z.object({
  success: z.boolean(),
  currentCwd: z.string(),
  error: z.string().optional(),
});
export type ProjectSetRespPayload = z.infer<typeof ProjectSetRespPayloadSchema>;

export const ProjectSetRespMessageSchema = EnvelopeBaseSchema.extend({
  type: z.literal(PROJECT_SET_RESP_MESSAGE_TYPE),
  payload: ProjectSetRespPayloadSchema,
});
export type ProjectSetRespMessage = z.infer<typeof ProjectSetRespMessageSchema>;

export function createProjectSetRespMessage(
  payload: ProjectSetRespPayload,
  options?: { sessionId?: string; id?: string; ts?: number }
): ProjectSetRespMessage {
  return createEnvelope(PROJECT_SET_RESP_MESSAGE_TYPE, payload, options) as ProjectSetRespMessage;
}
