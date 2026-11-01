import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseProject } from '@haku/core';
import { Player } from '../src/player.ts';
import { TOOLS, type Context } from '../src/tools.ts';

let dir: string;
let ctx: Context;
const tool = (name: string) => TOOLS.find((t) => t.name === name)!;
const call = (name: string, args: Record<string, unknown>) => tool(name).run(tool(name).input.parse(args) as never, ctx);
const project = async () => parseProject(JSON.parse(await readFile(join(dir, 'song.haku.json'), 'utf8')));

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'haku-tools-'));
  ctx = { link: async () => null, player: new Player(), waitForPlayback: true, cwd: dir, autoLaunch: false };
  await call('new_project', { file: 'song.haku.json', name: 'Tool test', mood: 'sunny-cafe', seed: 5 });
});

afterAll(() => rm(dir, { recursive: true, force: true }));

describe('tools on a project file', () => {
  it('has one tool per protocol command plus the extras, all with unique names', () => {
    const names = TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of ['describe', 'draw_shape', 'batch', 'play', 'snapshot', 'analyze', 'export', 'status']) expect(names).toContain(name);
  });

  it('runs commands and saves the file', async () => {
    const r = await call('draw_shape', { file: 'song.haku.json', shape: 'arc', x: 0, y: 0.5, width: 1, height: 0.4 });
    expect(r.text).toMatch(/Drew a pencil arc/);
    expect((await project()).scenes[0]!.layers[0]!.strokes).toHaveLength(1);
  });

  it("won't overwrite a file with new_project unless asked", async () => {
    await expect(call('new_project', { file: 'song.haku.json' })).rejects.toThrow(/already exists/);
  });

  it('runs a batch all or nothing', async () => {
    const before = await project();
    await expect(
      call('batch', { file: 'song.haku.json', commands: [{ type: 'set_project', bpm: 60 }, { type: 'remove_layer', layer: 'Nope' }] }),
    ).rejects.toThrow(/Command 2 \(remove_layer\) failed.*Nothing was changed/);
    expect((await project()).bpm).toBe(before.bpm);

    const ok = await call('batch', { file: 'song.haku.json', commands: [{ type: 'set_project', bpm: 60 }, { type: 'add_layer', instrument: 'drums', name: 'Kit' }] });
    expect(ok.text.split('\n')).toHaveLength(2);
    expect((await project()).bpm).toBe(60);
  });

  it('describe leaves the file untouched', async () => {
    const before = await readFile(join(dir, 'song.haku.json'), 'utf8');
    expect((await call('describe', { file: 'song.haku.json' })).text).toContain('Tool test');
    expect(await readFile(join(dir, 'song.haku.json'), 'utf8')).toBe(before);
  });

  it('takes a snapshot as a PNG', async () => {
    const r = await call('snapshot', { file: 'song.haku.json', width: 600 });
    expect(r.image?.mimeType).toBe('image/png');
    expect(r.image!.data.subarray(1, 4).toString()).toBe('PNG');
  });

  it('analyzes chord fit without rendering', async () => {
    const r = await call('analyze', { file: 'song.haku.json', audio: false });
    expect(r.text).toMatch(/"Melody" \(\w+\): \d+ notes/);
    expect(r.text).toMatch(/strong-beat chord tones \d+%/);
    expect(r.text).not.toMatch(/LUFS/);
  });

  it('exports MIDI and the project file', async () => {
    await call('export', { file: 'song.haku.json', format: 'midi', out: 'loop.mid' });
    expect((await readFile(join(dir, 'loop.mid'))).subarray(0, 4).toString()).toBe('MThd');
    await call('export', { file: 'song.haku.json', format: 'json', out: 'copy.haku.json' });
    expect(parseProject(JSON.parse(await readFile(join(dir, 'copy.haku.json'), 'utf8'))).name).toBe('Tool test');
  });

  it('asks for a file or haku web when no tab is connected and auto-launch is off', async () => {
    await expect(call('describe', {})).rejects.toThrow(/haku web.*project file/);
  });
});
