import { z } from "zod";
import { EnvelopeBaseSchema, createEnvelope } from "../envelope.js";

// --- Risk Hints & Classifiers ---

export const RiskHintSchema = z.enum(["low", "medium", "high"]);
export type RiskHint = z.infer<typeof RiskHintSchema>;

export const PermissionDecisionSchema = z.enum(["allow", "deny"]);
export type PermissionDecision = z.infer<typeof PermissionDecisionSchema>;

const HIGH_RISK_COMMAND_REGEX =
  /\b(rm|rmdir|mkfs|dd|sudo|shutdown|reboot|poweroff|fdisk)\b|\bgit\s+(reset\s+--hard|clean\s+.*-[a-zA-Z]*f[a-zA-Z]*|clean\s+.*--force|push\s+.*(-[a-zA-Z]*f[a-zA-Z]*|--force))\b|chmod\s+-[a-zA-Z]*R|chown\s+-[a-zA-Z]*R/i;

const CHAINED_OR_SUBEXEC_HIGH_RISK_REGEX =
  /(&&|\|\||;)\s*(rm|rmdir|mkfs|dd|sudo)\b|\$\([^)]*\b(rm|rmdir|sudo)\b[^)]*\)|`[^`]*\b(rm|rmdir|sudo)\b[^`]*`/i;

const SAFE_READONLY_COMMAND_PREFIXES = [
  "ls",
  "pwd",
  "cat",
  "head",
  "tail",
  "grep",
  "find",
  "which",
  "echo",
  "stat",
  "file",
  "uname",
  "whoami",
  "git status",
  "git diff",
  "git log",
  "git branch",
  "git show",
];

const SAFE_READONLY_TOOLS = new Set([
  "Read",
  "GlobTool",
  "GrepTool",
  "ListMcpResourcesTool",
  "ReadMcpResourceTool",
  "ReadMcpResourceDirTool",
]);

/**
 * Classifies the operational risk of a tool or bash command.
 * Strictly pure: depends on string inputs only.
 */
export function classifyRisk(
  toolName: string,
  input: Record<string, unknown>
): { riskHint: RiskHint; reason: string } {
  if (toolName === "Bash") {
    const rawCmd = typeof input["command"] === "string" ? input["command"].trim() : "";

    if (!rawCmd) {
      return { riskHint: "low", reason: "Empty command" };
    }

    if (HIGH_RISK_COMMAND_REGEX.test(rawCmd) || CHAINED_OR_SUBEXEC_HIGH_RISK_REGEX.test(rawCmd)) {
      return {
        riskHint: "high",
        reason: "Destructive or privileged command pattern detected",
      };
    }

    // Check if it has command chaining or pipes with anything unverified
    const hasChainingOrPipes = /[;&|`]/.test(rawCmd) || rawCmd.includes("$(");

    if (!hasChainingOrPipes) {
      const isReadonly = SAFE_READONLY_COMMAND_PREFIXES.some(
        (prefix) => rawCmd === prefix || rawCmd.startsWith(prefix + " ")
      );
      if (isReadonly) {
        return { riskHint: "low", reason: "Safe read-only command" };
      }
    }

    return { riskHint: "medium", reason: "Standard command execution" };
  }

  if (SAFE_READONLY_TOOLS.has(toolName)) {
    return { riskHint: "low", reason: "Read-only file/resource access" };
  }

  if (toolName === "Write" || toolName === "Edit" || toolName === "NotebookEdit") {
    return { riskHint: "medium", reason: "File modification" };
  }

  return { riskHint: "medium", reason: `Tool invocation: ${toolName}` };
}

/**
 * Checks whether a tool invocation matches the pure read-only allowlist.
 */
export function isReadonlyCommand(toolName: string, input: Record<string, unknown>): boolean {
  return classifyRisk(toolName, input).riskHint === "low";
}

// --- Wire Messages ---

// 1. perm.request
export const PERM_REQUEST_MESSAGE_TYPE = "perm.request" as const;

export const PermRequestPayloadSchema = z.object({
  requestId: z.string(),
  toolName: z.string(),
  command: z.string().optional(),
  input: z.record(z.unknown()).default({}),
  cwd: z.string(),
  riskHint: RiskHintSchema,
  description: z.string().optional(),
});
export type PermRequestPayload = z.infer<typeof PermRequestPayloadSchema>;

export const PermRequestMessageSchema = EnvelopeBaseSchema.extend({
  type: z.literal(PERM_REQUEST_MESSAGE_TYPE),
  payload: PermRequestPayloadSchema,
});
export type PermRequestMessage = z.infer<typeof PermRequestMessageSchema>;

export function createPermRequestMessage(
  payload: PermRequestPayload,
  options?: { sessionId?: string; id?: string; ts?: number }
): PermRequestMessage {
  return createEnvelope(PERM_REQUEST_MESSAGE_TYPE, payload, options) as PermRequestMessage;
}

// 2. perm.response
export const PERM_RESPONSE_MESSAGE_TYPE = "perm.response" as const;

export const PermResponsePayloadSchema = z.object({
  requestId: z.string(),
  decision: PermissionDecisionSchema,
  rememberForSession: z.boolean().optional(),
  reason: z.string().optional(),
});
export type PermResponsePayload = z.infer<typeof PermResponsePayloadSchema>;

export const PermResponseMessageSchema = EnvelopeBaseSchema.extend({
  type: z.literal(PERM_RESPONSE_MESSAGE_TYPE),
  payload: PermResponsePayloadSchema,
});
export type PermResponseMessage = z.infer<typeof PermResponseMessageSchema>;

export function createPermResponseMessage(
  payload: PermResponsePayload,
  options?: { sessionId?: string; id?: string; ts?: number }
): PermResponseMessage {
  return createEnvelope(PERM_RESPONSE_MESSAGE_TYPE, payload, options) as PermResponseMessage;
}
