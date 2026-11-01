// The tab's end of the agent bridge. Connects to the localhost relay (run by the Haku MCP server or
// `haku bridge`), answers requests, and quietly retries with backoff while nothing is listening.
// It can be switched off from the status bar; that choice is remembered.

import { BRIDGE_HOST, BRIDGE_PORT, parseBridgeMessage, type BridgeMessage, type TabOp } from '@haku/protocol';

export type LinkState = 'off' | 'waiting' | 'connected';
type Handler = (op: TabOp) => unknown;

const ENABLED_KEY = 'haku:agent-link';
const MIN_DELAY = 1000;
const MAX_DELAY = 15_000;
const port = Number(import.meta.env.VITE_HAKU_BRIDGE_PORT) || BRIDGE_PORT;

class AgentLink {
  state: LinkState = 'off';
  enabled = localStorage.getItem(ENABLED_KEY) !== 'off';
  handler: Handler | null = null;
  private ws: WebSocket | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private delay = MIN_DELAY;
  private listeners = new Set<() => void>();

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };

  private set(state: LinkState) {
    if (state === this.state) return;
    this.state = state;
    for (const fn of this.listeners) fn();
  }

  start() {
    if (this.enabled && !this.ws && !this.timer) this.connect();
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    localStorage.setItem(ENABLED_KEY, enabled ? 'on' : 'off');
    if (enabled) {
      this.delay = MIN_DELAY;
      this.start();
      return;
    }
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.ws?.close();
    this.ws = null;
    this.set('off');
  }

  /** Tells the bridge this tab is the one in front, so agents drive it rather than another tab. */
  private hello = () => this.send({ kind: 'hello', app: 'haku' });

  private send(msg: BridgeMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private connect() {
    this.timer = null;
    this.set('waiting');
    const ws = new WebSocket(`ws://${BRIDGE_HOST}:${port}/tab`);
    this.ws = ws;
    ws.onopen = () => {
      this.delay = MIN_DELAY;
      this.set('connected');
      this.hello();
      window.addEventListener('focus', this.hello);
    };
    ws.onmessage = (e) => void this.answer(String(e.data));
    ws.onclose = () => {
      window.removeEventListener('focus', this.hello);
      if (this.ws !== ws) return;
      this.ws = null;
      if (!this.enabled) return this.set('off');
      this.set('waiting');
      this.timer = setTimeout(() => this.connect(), this.delay);
      this.delay = Math.min(MAX_DELAY, this.delay * 2);
    };
  }

  private async answer(raw: string) {
    const msg = parseBridgeMessage(raw);
    if (msg?.kind !== 'request' || msg.op.op === 'ping') return;
    const id = msg.id;
    try {
      if (!this.handler) throw new Error('Haku is still opening');
      const result = await this.handler(msg.op);
      this.send({ kind: 'response', id, ok: true, result });
    } catch (err) {
      this.send({ kind: 'response', id, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
}

export const agentLink = new AgentLink();
