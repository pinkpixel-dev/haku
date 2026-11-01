// Starts the real MCP server over stdio and talks JSON-RPC to it, the way an MCP host would. This
// also catches anything that writes stray text to stdout.

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const cli = join(import.meta.dirname, '../src/cli.ts');
let child: ChildProcessWithoutNullStreams;
let dir: string;
let nextId = 1;
const waiting = new Map<number, (msg: Record<string, unknown>) => void>();
const stray: string[] = [];

function rpc(method: string, params: object = {}): Promise<Record<string, unknown>> {
  const id = nextId++;
  return new Promise((resolve) => {
    waiting.set(id, resolve);
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });
}

type ToolResult = { content: { type: string; text?: string; mimeType?: string }[]; isError?: boolean };
const callTool = async (name: string, args: object) => (await rpc('tools/call', { name, arguments: args })).result as ToolResult;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'haku-mcp-'));
  // A port of its own, so a bridge you happen to be running doesn't get involved.
  child = spawn(process.execPath, [cli, 'mcp'], { cwd: dir, env: { ...process.env, HAKU_NO_LAUNCH: '1', HAKU_BRIDGE_PORT: String(20000 + Math.floor(Math.random() * 20000)) } });
  createInterface({ input: child.stdout }).on('line', (line) => {
    try {
      const msg = JSON.parse(line) as Record<string, unknown>;
      waiting.get(msg.id as number)?.(msg);
    } catch {
      stray.push(line);
    }
  });
  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'haku-test', version: '0' } });
  expect(init.result).toBeDefined();
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
}, 20_000);

afterAll(async () => {
  child.stdin.end();
  await new Promise((r) => child.once('exit', r));
  await rm(dir, { recursive: true, force: true });
});

describe('MCP server', () => {
  it('introduces itself with the guide', async () => {
    const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'again', version: '0' } });
    expect(JSON.stringify(init)).toContain('Haku turns strokes');
  });

  it('lists every tool with a schema', async () => {
    const { result } = await rpc('tools/list');
    const tools = (result as { tools: { name: string; inputSchema: { properties?: object } }[] }).tools;
    const names = tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(['new_project', 'draw_shape', 'describe', 'batch', 'snapshot', 'analyze', 'play']));
    expect(tools.find((t) => t.name === 'draw_line')!.inputSchema.properties).toHaveProperty('from');
  });

  it('works on a project file end to end', async () => {
    expect((await callTool('new_project', { file: 'mcp.haku.json', mood: 'snowy-window', seed: 2 })).isError).toBeFalsy();
    const drawn = await callTool('draw_curve', { file: 'mcp.haku.json', points: [{ x: 0, y: 0.6 }, { x: 0.5, y: 0.2 }, { x: 1, y: 0.5 }] });
    expect(drawn.content[0]!.text).toMatch(/Drew a pencil curve/);
    const shot = await callTool('snapshot', { file: 'mcp.haku.json', width: 600 });
    expect(shot.content.map((c) => c.type)).toEqual(['text', 'image']);
    expect(shot.content[1]!.mimeType).toBe('image/png');
  });

  it('reports bad input as a tool error instead of crashing', async () => {
    const bad = await callTool('draw_line', { file: 'mcp.haku.json', from: { x: 3, y: 0 }, to: { x: 1, y: 1 } });
    expect(bad.isError).toBe(true);
    const missing = await callTool('describe', {});
    expect(missing.isError).toBe(true);
    expect(missing.content[0]!.text).toMatch(/No Haku tab/);
  });

  it('keeps stdout clean', () => {
    expect(stray).toEqual([]);
  });
});
