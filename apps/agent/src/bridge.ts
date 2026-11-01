// The localhost relay between agent tools and the open Haku tab.
//
// BridgeHost runs the WebSocket server. Tabs connect on /tab (only from localhost pages), agent tools
// on /agent (only from non-browser clients, which send no Origin header). The tab that said hello
// most recently gets the requests, so the one you clicked into last is the one agents drive.
//
// BridgeClient is what short-lived tools (the CLI) use to reach a running host. SharedLink is what
// the MCP server uses: it hosts if the port is free and otherwise joins whoever is hosting, taking
// over if that host goes away.

import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { BRIDGE_HOST, BRIDGE_PORT, parseBridgeMessage, type BridgeMessage, type PingReply, type TabOp } from '@haku/protocol';

export type LinkOp = TabOp | { op: 'ping' };

export interface Link {
  request(op: LinkOp, timeoutMs?: number): Promise<unknown>;
  close(): Promise<void>;
}

export const NO_TAB = 'No Haku tab is connected. Open Haku in a browser (it connects on its own), or pass a project file.';
const DEFAULT_TIMEOUT = 20_000;

export function bridgePort(): number {
  const env = Number(process.env.HAKU_BRIDGE_PORT);
  return Number.isInteger(env) && env > 0 ? env : BRIDGE_PORT;
}

/** Pages on this machine only, plus anything listed in HAKU_ALLOW_ORIGINS (comma separated). */
function originAllowed(origin: string | undefined): boolean {
  if (!origin) return false;
  const extra = (process.env.HAKU_ALLOW_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (extra.includes(origin)) return true;
  try {
    const { hostname, protocol } = new URL(origin);
    return (protocol === 'http:' || protocol === 'https:') && ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
  } catch {
    return false;
  }
}

const roleOf = (req: IncomingMessage) => new URL(req.url ?? '/', 'http://bridge').pathname;

interface Pending {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
  socket: WebSocket;
}

/** Tracks requests sent over one socket and matches up the responses. */
class Requests {
  private pending = new Map<string, Pending>();

  send(socket: WebSocket, op: LinkOp, timeoutMs: number): Promise<unknown> {
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`The Haku tab didn't answer "${op.op}" within ${Math.round(timeoutMs / 1000)} s`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer, socket });
      socket.send(JSON.stringify({ kind: 'request', id, op } satisfies BridgeMessage));
    });
  }

  settle(msg: Extract<BridgeMessage, { kind: 'response' }>) {
    const p = this.pending.get(msg.id);
    if (!p) return;
    this.pending.delete(msg.id);
    clearTimeout(p.timer);
    if (msg.ok) p.resolve(msg.result);
    else p.reject(new Error(msg.error ?? 'The Haku tab reported an error'));
  }

  /** Fails everything still waiting on a socket that went away. */
  drop(socket: WebSocket, reason: string) {
    for (const [id, p] of this.pending) {
      if (p.socket !== socket) continue;
      this.pending.delete(id);
      clearTimeout(p.timer);
      p.reject(new Error(reason));
    }
  }
}

export class BridgeHost implements Link {
  private tabs: WebSocket[] = [];
  private requests = new Requests();
  /** Called with a short line when tabs come and go, for `haku bridge` to print. */
  onEvent: ((line: string) => void) | null = null;

  private wss: WebSocketServer;

  private constructor(wss: WebSocketServer) {
    this.wss = wss;
    wss.on('connection', (ws, req) => (roleOf(req) === '/tab' ? this.addTab(ws) : this.addAgent(ws)));
  }

  /** Starts listening. Rejects with code EADDRINUSE when something already holds the port. */
  static listen(port = bridgePort()): Promise<BridgeHost> {
    return new Promise((resolve, reject) => {
      const wss = new WebSocketServer({
        host: BRIDGE_HOST,
        port,
        maxPayload: 16 * 1024 * 1024,
        verifyClient: ({ req, origin }: { req: IncomingMessage; origin: string | undefined }) => {
          const role = roleOf(req);
          if (role === '/tab') return originAllowed(origin);
          // Browsers always send Origin, so this keeps web pages from driving the tab.
          if (role === '/agent') return !req.headers.origin;
          return false;
        },
      });
      wss.once('listening', () => resolve(new BridgeHost(wss)));
      wss.once('error', reject);
    });
  }

  get tabCount() {
    return this.tabs.length;
  }

  /** The port actually bound, which matters when listening on 0. */
  get port(): number {
    const addr = this.wss.address();
    return typeof addr === 'object' && addr ? addr.port : 0;
  }

  private addTab(ws: WebSocket) {
    this.tabs.push(ws);
    this.onEvent?.(`Tab connected (${this.tabs.length} open)`);
    ws.on('message', (raw) => {
      const msg = parseBridgeMessage(raw.toString());
      if (msg?.kind === 'response') this.requests.settle(msg);
      else if (msg?.kind === 'hello') {
        // Focus moves this tab to the front.
        this.tabs = [...this.tabs.filter((t) => t !== ws), ws];
      }
    });
    ws.on('close', () => {
      this.tabs = this.tabs.filter((t) => t !== ws);
      this.requests.drop(ws, 'The Haku tab closed before it answered');
      this.onEvent?.(`Tab disconnected (${this.tabs.length} open)`);
    });
  }

  private addAgent(ws: WebSocket) {
    ws.on('message', async (raw) => {
      const msg = parseBridgeMessage(raw.toString());
      if (msg?.kind !== 'request') return;
      const reply = (body: { ok: true; result: unknown } | { ok: false; error: string }) =>
        ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ kind: 'response', id: msg.id, ...body }));
      try {
        reply({ ok: true, result: await this.request(msg.op) });
      } catch (err) {
        reply({ ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    });
  }

  async request(op: LinkOp, timeoutMs = DEFAULT_TIMEOUT): Promise<unknown> {
    if (op.op === 'ping') return { tab: this.tabs.length > 0, tabs: this.tabs.length } satisfies PingReply;
    const tab = this.tabs.at(-1);
    if (!tab) throw new Error(NO_TAB);
    return this.requests.send(tab, op, timeoutMs);
  }

  close(): Promise<void> {
    for (const ws of this.wss.clients) ws.terminate();
    return new Promise((resolve) => this.wss.close(() => resolve()));
  }
}

export class BridgeClient implements Link {
  private requests = new Requests();
  onClose: (() => void) | null = null;

  private ws: WebSocket;

  private constructor(ws: WebSocket) {
    this.ws = ws;
    ws.on('message', (raw) => {
      const msg = parseBridgeMessage(raw.toString());
      if (msg?.kind === 'response') this.requests.settle(msg);
    });
    ws.on('close', () => {
      this.requests.drop(ws, 'Lost the connection to the Haku bridge');
      this.onClose?.();
    });
  }

  /** Resolves to null when nothing is listening, so callers can fall back to offline. */
  static connect(port = bridgePort(), timeoutMs = 1000): Promise<BridgeClient | null> {
    return new Promise((resolve) => {
      const ws = new WebSocket(`ws://${BRIDGE_HOST}:${port}/agent`, { handshakeTimeout: timeoutMs, maxPayload: 16 * 1024 * 1024 });
      ws.once('open', () => resolve(new BridgeClient(ws)));
      ws.once('error', () => resolve(null));
    });
  }

  request(op: LinkOp, timeoutMs = DEFAULT_TIMEOUT): Promise<unknown> {
    if (this.ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error('Lost the connection to the Haku bridge'));
    // A little slack so the host's own timeout message is the one that comes back.
    return this.requests.send(this.ws, op, timeoutMs + 2000);
  }

  close(): Promise<void> {
    if (this.ws.readyState === WebSocket.CLOSED) return Promise.resolve();
    return new Promise((resolve) => {
      this.ws.once('close', () => resolve());
      this.ws.close();
    });
  }
}

const isAddrInUse = (err: unknown) => (err as NodeJS.ErrnoException)?.code === 'EADDRINUSE';

/** Hosts the bridge when the port is free, otherwise joins the existing host. Used by the MCP server. */
export class SharedLink implements Link {
  private current: Link | null = null;
  private connecting: Promise<Link | null> | null = null;
  private closed = false;

  private port: number;

  constructor(port = bridgePort()) {
    this.port = port;
  }

  get hosting() {
    return this.current instanceof BridgeHost;
  }

  ensure(): Promise<Link | null> {
    if (this.current) return Promise.resolve(this.current);
    this.connecting ??= (async () => {
      try {
        this.current = await BridgeHost.listen(this.port);
      } catch (err) {
        if (!isAddrInUse(err)) throw err;
        const client = await BridgeClient.connect(this.port);
        if (client) {
          // If the other host goes away, take over so the tab still has somewhere to connect.
          client.onClose = () => {
            this.current = null;
            if (!this.closed) setTimeout(() => void this.ensure().catch(() => {}), 250);
          };
        }
        this.current = client;
      }
      return this.current;
    })().finally(() => (this.connecting = null));
    return this.connecting;
  }

  async request(op: LinkOp, timeoutMs?: number): Promise<unknown> {
    const link = await this.ensure();
    if (!link) throw new Error(`Couldn't reach the Haku bridge on port ${this.port}`);
    return link.request(op, timeoutMs);
  }

  async close() {
    this.closed = true;
    await this.current?.close();
    this.current = null;
  }
}
