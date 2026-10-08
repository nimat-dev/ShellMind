import { z } from "zod";
import { EnvelopeBaseSchema, createEnvelope } from "../envelope.js";

// 1. sys.request
export const SYS_REQUEST_MESSAGE_TYPE = "sys.request" as const;

export const SysRequestPayloadSchema = z.object({
  diskPath: z.string().optional(),
});

export type SysRequestPayload = z.infer<typeof SysRequestPayloadSchema>;

export const SysRequestMessageSchema = EnvelopeBaseSchema.extend({
  type: z.literal(SYS_REQUEST_MESSAGE_TYPE),
  payload: SysRequestPayloadSchema.default({}),
});

export type SysRequestMessage = z.infer<typeof SysRequestMessageSchema>;

export function createSysRequestMessage(
  payload: SysRequestPayload = {},
  options?: { sessionId?: string; id?: string; ts?: number }
): SysRequestMessage {
  return createEnvelope(SYS_REQUEST_MESSAGE_TYPE, payload, options) as SysRequestMessage;
}

// 2. sys.metrics
export const SYS_METRICS_MESSAGE_TYPE = "sys.metrics" as const;

export const CpuMetricsSchema = z.object({
  percent: z.number().min(0).max(100),
  cores: z.number().int().positive(),
});

export const MemoryMetricsSchema = z.object({
  usedBytes: z.number().nonnegative(),
  totalBytes: z.number().positive(),
  percent: z.number().min(0).max(100),
});

export const DiskMetricsSchema = z
  .object({
    usedBytes: z.number().nonnegative(),
    totalBytes: z.number().positive(),
    percent: z.number().min(0).max(100),
    mount: z.string().optional(),
  })
  .nullable();

export const SysMetricsPayloadSchema = z.object({
  cpu: CpuMetricsSchema,
  memory: MemoryMetricsSchema,
  disk: DiskMetricsSchema,
  uptimeSeconds: z.number().nonnegative(),
  platform: z.string(),
  hostname: z.string(),
  collectedAt: z.number().int().positive(),
});

export type SysMetricsPayload = z.infer<typeof SysMetricsPayloadSchema>;

export const SysMetricsMessageSchema = EnvelopeBaseSchema.extend({
  type: z.literal(SYS_METRICS_MESSAGE_TYPE),
  payload: SysMetricsPayloadSchema,
});

export type SysMetricsMessage = z.infer<typeof SysMetricsMessageSchema>;

export function createSysMetricsMessage(
  payload: SysMetricsPayload,
  options?: { sessionId?: string; id?: string; ts?: number }
): SysMetricsMessage {
  return createEnvelope(SYS_METRICS_MESSAGE_TYPE, payload, options) as SysMetricsMessage;
}
