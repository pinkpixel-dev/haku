import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { createProject, type Project } from '@haku/core';
import { parseBridgeMessage, type BridgeMessage } from '@haku/protocol';
import { BridgeClient, BridgeHost, NO_TAB, SharedLink } from '../src/bridge.ts';
import { applyAll, LiveTarget } from '../src/target.ts';

const cleanup: (() => unknown)[] = [];
afterEach(async () => {
  while (cleanup.length) await cleanup.pop()!();
});

async function host() {
  const h = await BridgeHost.listen(0);
  cleanup.push(() => h.close());
  return h;
}

/** A pretend browser tab that keeps a project in memory and answers like the web app does. */
function fakeTab(port: number, origin = 'http://localhost:5178'): Promise<{ ws: WebSocket; project: () => Project }> {
  let project = createProject({ seed: 1, name: 'Tab project' });
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/tab`, { origin });
    cleanup.push(() => ws.close());
    ws.on('open', () => {
      ws.send(JSON.stringify({ kind: 'hello', app: 'haku' }));
      resolve({ ws, project: () => project });
    });
    ws.on('error', reject);
    ws.on('unexpected-response', (_, res) => reject(new Error(`rejected with ${res.statusCode}`)));
    ws.on('message', (raw) => {
      const msg = parseBridgeMessage(raw.toString());
      if (msg?.kind !== 'request') return;
      const reply = (body: object) => ws.send(JSON.stringify({ kind: 'response', id: msg.id, ...body } as BridgeMessage));
      try {
        if (msg.op.op === 'get_project') return reply({ ok: true, result: project });
        if (msg.op.op === 'execute') {
          const r = applyAll(project, msg.op.commands);
          project = r.project;
          return reply({ ok: true, result: { messages: r.messages, data: r.data } });
        }
        reply({ ok: false, error: `unsupported ${msg.op.op}` });
      } catch (err) {
        reply({ ok: false, error: (err as Error).message });
      }
    });
  });
}

const waitFor = async (check: () => boolean) => {
  for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
};

describe('bridge', () => {
  it('relays agent commands to the tab and back', async () => {
    const h = await host();
    const tab = await fakeTab(h.port);
    const client = (await BridgeClient.connect(h.port))!;
    cleanup.push(() => client.close());

    expect(await client.request({ op: 'ping' })).toEqual({ tab: true, tabs: 1 });
    const target = new LiveTarget(client);
    const reply = await target.run([{ type: 'set_project', bpm: 77 }, { type: 'add_layer', instrument: 'glock', name: 'Bells' }]);
    expect(reply.messages).toHaveLength(2);
    expect(tab.project().bpm).toBe(77);
    expect((await target.read()).scenes[0]!.layers.map((l) => l.name)).toContain('Bells');
  });

  it('answers read-only commands without asking the tab to change anything', async () => {
    const h = await host();
    const tab = await fakeTab(h.port);
    const before = tab.project();
    const reply = await new LiveTarget(h).run([{ type: 'describe' }]);
    expect(reply.messages[0]).toContain('Tab project');
    expect(tab.project()).toBe(before);
  });

  it('passes tab errors back to the agent', async () => {
    const h = await host();
    await fakeTab(h.port);
    await expect(new LiveTarget(h).run([{ type: 'select_scene', scene: 'Nope' }])).rejects.toThrow(/No scene "Nope"/);
  });

  it('says so when no tab is connected', async () => {
    const h = await host();
    expect(await h.request({ op: 'ping' })).toEqual({ tab: false, tabs: 0 });
    await expect(h.request({ op: 'get_project' })).rejects.toThrow(NO_TAB);
  });

  it('only accepts tabs from localhost pages, and agents from outside the browser', async () => {
    const h = await host();
    await expect(fakeTab(h.port, 'https://example.com')).rejects.toThrow(/401|403/);
    const sneaky = new WebSocket(`ws://127.0.0.1:${h.port}/agent`, { origin: 'http://localhost:5178' });
    cleanup.push(() => sneaky.terminate());
    await expect(new Promise((resolve, reject) => (sneaky.on('open', resolve), sneaky.on('error', reject)))).rejects.toThrow();
  });

  it('sends requests to the tab that said hello last', async () => {
    const h = await host();
    const first = await fakeTab(h.port);
    const second = await fakeTab(h.port);
    await waitFor(() => h.tabCount === 2);
    const target = new LiveTarget(h);
    await target.run([{ type: 'set_project', name: 'To the newest' }]);
    expect(second.project().name).toBe('To the newest');

    first.ws.send(JSON.stringify({ kind: 'hello', app: 'haku' }));
    await new Promise((r) => setTimeout(r, 30));
    await target.run([{ type: 'set_project', name: 'Back to the first' }]);
    expect(first.project().name).toBe('Back to the first');
  });

  it('joins a running host, then takes over when it goes away', async () => {
    const first = await BridgeHost.listen(0);
    const port = first.port;
    const shared = new SharedLink(port);
    cleanup.push(() => shared.close());

    await shared.ensure();
    expect(shared.hosting).toBe(false);
    await first.close();
    await waitFor(() => shared.hosting);
    expect(shared.hosting).toBe(true);
    expect(await shared.request({ op: 'ping' })).toEqual({ tab: false, tabs: 0 });
  });
});
