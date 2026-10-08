import { z } from "zod";
import { PING_MESSAGE_TYPE, PingMessageSchema } from "./messages/ping.js";
import { PONG_MESSAGE_TYPE, PongMessageSchema } from "./messages/pong.js";
import { ERROR_MESSAGE_TYPE, ErrorMessageSchema } from "./messages/error.js";
import {
  HELLO_MESSAGE_TYPE,
  HelloMessageSchema,
  HELLO_ACK_MESSAGE_TYPE,
  HelloAckMessageSchema,
  HELLO_REJECT_MESSAGE_TYPE,
  HelloRejectMessageSchema,
} from "./messages/hello.js";
import {
  TERM_OPEN_MESSAGE_TYPE,
  TermOpenMessageSchema,
  TERM_INPUT_MESSAGE_TYPE,
  TermInputMessageSchema,
  TERM_DATA_MESSAGE_TYPE,
  TermDataMessageSchema,
  TERM_RESIZE_MESSAGE_TYPE,
  TermResizeMessageSchema,
  TERM_EXIT_MESSAGE_TYPE,
  TermExitMessageSchema,
} from "./messages/terminal.js";
import {
  SYS_REQUEST_MESSAGE_TYPE,
  SysRequestMessageSchema,
  SYS_METRICS_MESSAGE_TYPE,
  SysMetricsMessageSchema,
} from "./messages/sysinfo.js";
import {
  AGENT_PROMPT_MESSAGE_TYPE,
  AgentPromptMessageSchema,
  AGENT_STREAM_MESSAGE_TYPE,
  AgentStreamMessageSchema,
  AGENT_ABORT_MESSAGE_TYPE,
  AgentAbortMessageSchema,
} from "./messages/agent.js";
import {
  PROJECT_LIST_MESSAGE_TYPE,
  ProjectListMessageSchema,
  PROJECT_LIST_RESP_MESSAGE_TYPE,
  ProjectListRespMessageSchema,
  PROJECT_SET_MESSAGE_TYPE,
  ProjectSetMessageSchema,
  PROJECT_SET_RESP_MESSAGE_TYPE,
  ProjectSetRespMessageSchema,
} from "./messages/project.js";
import {
  PERM_REQUEST_MESSAGE_TYPE,
  PermRequestMessageSchema,
  PERM_RESPONSE_MESSAGE_TYPE,
  PermResponseMessageSchema,
} from "./messages/permission.js";

export type AnyMessageSchema = z.ZodTypeAny;

export class MessageRegistry {
  private static instance: MessageRegistry;
  private schemas: Map<string, AnyMessageSchema> = new Map();

  constructor() {
    this.register(PING_MESSAGE_TYPE, PingMessageSchema);
    this.register(PONG_MESSAGE_TYPE, PongMessageSchema);
    this.register(ERROR_MESSAGE_TYPE, ErrorMessageSchema);
    this.register(HELLO_MESSAGE_TYPE, HelloMessageSchema);
    this.register(HELLO_ACK_MESSAGE_TYPE, HelloAckMessageSchema);
    this.register(HELLO_REJECT_MESSAGE_TYPE, HelloRejectMessageSchema);
    this.register(TERM_OPEN_MESSAGE_TYPE, TermOpenMessageSchema);
    this.register(TERM_INPUT_MESSAGE_TYPE, TermInputMessageSchema);
    this.register(TERM_DATA_MESSAGE_TYPE, TermDataMessageSchema);
    this.register(TERM_RESIZE_MESSAGE_TYPE, TermResizeMessageSchema);
    this.register(TERM_EXIT_MESSAGE_TYPE, TermExitMessageSchema);
    this.register(SYS_REQUEST_MESSAGE_TYPE, SysRequestMessageSchema);
    this.register(SYS_METRICS_MESSAGE_TYPE, SysMetricsMessageSchema);
    this.register(AGENT_PROMPT_MESSAGE_TYPE, AgentPromptMessageSchema);
    this.register(AGENT_STREAM_MESSAGE_TYPE, AgentStreamMessageSchema);
    this.register(AGENT_ABORT_MESSAGE_TYPE, AgentAbortMessageSchema);
    this.register(PROJECT_LIST_MESSAGE_TYPE, ProjectListMessageSchema);
    this.register(PROJECT_LIST_RESP_MESSAGE_TYPE, ProjectListRespMessageSchema);
    this.register(PROJECT_SET_MESSAGE_TYPE, ProjectSetMessageSchema);
    this.register(PROJECT_SET_RESP_MESSAGE_TYPE, ProjectSetRespMessageSchema);
    this.register(PERM_REQUEST_MESSAGE_TYPE, PermRequestMessageSchema);
    this.register(PERM_RESPONSE_MESSAGE_TYPE, PermResponseMessageSchema);
  }

  public static getInstance(): MessageRegistry {
    if (!MessageRegistry.instance) {
      MessageRegistry.instance = new MessageRegistry();
    }
    return MessageRegistry.instance;
  }

  public register(type: string, schema: AnyMessageSchema): void {
    this.schemas.set(type, schema);
  }

  public get(type: string): AnyMessageSchema | undefined {
    return this.schemas.get(type);
  }

  public has(type: string): boolean {
    return this.schemas.has(type);
  }

  public registeredTypes(): string[] {
    return Array.from(this.schemas.keys());
  }
}

export const defaultRegistry = MessageRegistry.getInstance();
