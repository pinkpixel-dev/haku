// The wire format between the open Haku tab and agent tools. A small WebSocket relay on localhost
// (hosted by the MCP server or `haku bridge`) passes requests from agents to the tab and answers
// back. Tabs connect on /tab, agent tools on /agent. Everything is JSON.

import { z } from 'zod';

export const BRIDGE_HOST = '127.0.0.1';
export const BRIDGE_PORT = 5179;

export const PLAY_MODES = ['loop', 'song'] as const;
export type PlayMode = (typeof PLAY_MODES)[number];

/** What an agent can ask the tab to do. */
export const TabOpSchema = z.discriminatedUnion('op', [
  /** Returns the project JSON. */
  z.object({ op: z.literal('get_project') }),
  /** Runs commands in order as one undo step. If any fails, nothing changes. */
  z.object({ op: z.literal('execute'), commands: z.array(z.unknown()).min(1).max(500) }),
  /** Swaps in a whole project. The one that was open stays saved in the browser. */
  z.object({ op: z.literal('open_project'), project: z.unknown() }),
  z.object({ op: z.literal('play'), mode: z.enum(PLAY_MODES).optional(), scene: z.string().optional() }),
  z.object({ op: z.literal('stop') }),
  z.object({ op: z.literal('status') }),
]);
export type TabOp = z.infer<typeof TabOpSchema>;

/** Answered by the bridge itself, without a tab. */
export const PingOpSchema = z.object({ op: z.literal('ping') });

export const BridgeMessageSchema = z.discriminatedUnion('kind', [
  /** A tab says it's here, and again whenever it gets focus, so the one you're looking at wins. */
  z.object({ kind: z.literal('hello'), app: z.literal('haku'), version: z.string().optional() }),
  z.object({ kind: z.literal('request'), id: z.string().min(1).max(64), op: z.union([TabOpSchema, PingOpSchema]) }),
  z.object({ kind: z.literal('response'), id: z.string().min(1).max(64), ok: z.boolean(), result: z.unknown().optional(), error: z.string().optional() }),
]);
export type BridgeMessage = z.infer<typeof BridgeMessageSchema>;

export interface TabStatus {
  projectId: string;
  projectName: string;
  sceneId: string;
  sceneName: string;
  playing: boolean;
  mode: PlayMode;
  /** Whether the samples have loaded. */
  engine: 'idle' | 'loading' | 'ready' | 'error';
}

export interface ExecuteReply {
  messages: string[];
  data: unknown[];
}

export interface PingReply {
  tab: boolean;
  tabs: number;
}

/** Parses one incoming frame. Returns null for anything that isn't a valid message. */
export function parseBridgeMessage(raw: string): BridgeMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = BridgeMessageSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
