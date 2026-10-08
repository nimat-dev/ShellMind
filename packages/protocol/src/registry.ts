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
