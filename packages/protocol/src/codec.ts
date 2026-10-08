import { defaultRegistry, MessageRegistry } from "./registry.js";
import { PingMessage } from "./messages/ping.js";
import { PongMessage } from "./messages/pong.js";
import { ErrorMessage } from "./messages/error.js";
import {
  HelloMessage,
  HelloAckMessage,
  HelloRejectMessage,
} from "./messages/hello.js";
import {
  TermOpenMessage,
  TermInputMessage,
  TermDataMessage,
  TermResizeMessage,
  TermExitMessage,
} from "./messages/terminal.js";
import {
  SysRequestMessage,
  SysMetricsMessage,
} from "./messages/sysinfo.js";
import {
  AgentPromptMessage,
  AgentStreamMessage,
  AgentAbortMessage,
} from "./messages/agent.js";
import {
  ProjectListMessage,
  ProjectListRespMessage,
  ProjectSetMessage,
  ProjectSetRespMessage,
} from "./messages/project.js";

/** Max permitted serialized message length in bytes (1 MB default) */
export const DEFAULT_MAX_MESSAGE_BYTES = 1024 * 1024; // 1 MB

export type KnownMessage =
  | PingMessage
  | PongMessage
  | ErrorMessage
  | HelloMessage
  | HelloAckMessage
  | HelloRejectMessage
  | TermOpenMessage
  | TermInputMessage
  | TermDataMessage
  | TermResizeMessage
  | TermExitMessage
  | SysRequestMessage
  | SysMetricsMessage
  | AgentPromptMessage
  | AgentStreamMessage
  | AgentAbortMessage
  | ProjectListMessage
  | ProjectListRespMessage
  | ProjectSetMessage
  | ProjectSetRespMessage;

export type ProtocolErrorCode =
  | "ERR_MALFORMED_JSON"
  | "ERR_PAYLOAD_TOO_LARGE"
  | "ERR_INVALID_ENVELOPE"
  | "ERR_UNKNOWN_MESSAGE_TYPE"
  | "ERR_SCHEMA_VALIDATION";

export interface ProtocolDecodeError {
  code: ProtocolErrorCode;
  message: string;
  details?: unknown;
}

export type DecodeResult<T = KnownMessage> =
  | { success: true; data: T }
  | { success: false; error: ProtocolDecodeError };

export interface CodecOptions {
  maxBytes?: number;
  registry?: MessageRegistry;
}

/**
 * Encodes a message object to a UTF-8 JSON wire string.
 * Enforces max message byte length limits.
 */
export function serializeMessage(message: unknown, options?: CodecOptions): string {
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_MESSAGE_BYTES;
  const json = JSON.stringify(message);
  const byteLength = new TextEncoder().encode(json).length;
  if (byteLength > maxBytes) {
    throw new Error(`Message size ${byteLength} bytes exceeds maximum allowed limit of ${maxBytes} bytes`);
  }
  return json;
}

/**
 * Parses and validates an incoming wire string against registered protocol schemas.
 */
export function parseMessage<T = KnownMessage>(
  raw: string,
  options?: CodecOptions
): DecodeResult<T> {
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_MESSAGE_BYTES;
  const registry = options?.registry ?? defaultRegistry;

  // 1. Size guard check
  const byteLength = new TextEncoder().encode(raw).length;
  if (byteLength > maxBytes) {
    return {
      success: false,
      error: {
        code: "ERR_PAYLOAD_TOO_LARGE",
        message: `Payload of ${byteLength} bytes exceeds max limit of ${maxBytes} bytes`,
        details: { byteLength, maxBytes },
      },
    };
  }

  // 2. JSON parsing
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err: unknown) {
    return {
      success: false,
      error: {
        code: "ERR_MALFORMED_JSON",
        message: "Failed to parse JSON string",
        details: err instanceof Error ? err.message : String(err),
      },
    };
  }

  // 3. Envelope structural verification
  if (typeof parsed !== "object" || parsed === null) {
    return {
      success: false,
      error: {
        code: "ERR_INVALID_ENVELOPE",
        message: "Message must be a non-null object",
      },
    };
  }

  const candidate = parsed as Record<string, unknown>;
  if (typeof candidate["type"] !== "string" || !candidate["type"]) {
    return {
      success: false,
      error: {
        code: "ERR_INVALID_ENVELOPE",
        message: "Message missing required 'type' field",
      },
    };
  }

  const messageType = candidate["type"];

  // 4. Schema lookup in registry
  const schema = registry.get(messageType);
  if (!schema) {
    return {
      success: false,
      error: {
        code: "ERR_UNKNOWN_MESSAGE_TYPE",
        message: `Unknown or unregistered message type: '${messageType}'`,
        details: { type: messageType, available: registry.registeredTypes() },
      },
    };
  }

  // 5. Schema validation
  const validation = schema.safeParse(parsed);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "ERR_SCHEMA_VALIDATION",
        message: `Validation failed for message type '${messageType}'`,
        details: validation.error.format(),
      },
    };
  }

  return {
    success: true,
    data: validation.data as T,
  };
}
