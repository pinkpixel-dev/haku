// Every tool the CLI and the MCP server offer, defined once. The protocol commands become one tool
// each; the rest (files, playback, pictures, analysis, export) live here because they need Node.

import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { buildArrangementScore, buildSceneScore, createProject, findScene, MOOD_IDS, parseProject, scoreToMidi, type Project } from '@haku/core';
import { COMMAND_HELP, CommandSchema, READ_ONLY_COMMANDS, type CommandType, type PingReply, type TabStatus } from '@haku/protocol';
import { analyzeScenes, formatAnalysis } from './analyze.ts';
import { loadAudio } from './audio.ts';
import { NO_TAB, type Link } from './bridge.ts';
import type { Player } from './player.ts';
import { snapshotPng, snapshotSvg } from './snapshot.ts';
import { FileTarget, LiveTarget, readProjectFile, writeProjectFile, type Target } from './target.ts';

export interface ToolResult {
  text: string;
  /** A PNG for agents that can look at it. */
  image?: { data: Buffer; mimeType: 'image/png' };
}

export interface Context {
  /** The bridge, or null when none is running. */
  link(): Promise<Link | null>;
  player: Player;
  /** The CLI waits for offline playback to finish. The MCP server returns right away. */
  waitForPlayback: boolean;
  cwd: string;
}

export interface Tool<S extends z.ZodObject = z.ZodObject> {
  name: string;
  title: string;
  description: string;
  input: S;
  readOnly?: boolean;
  destructive?: boolean;
  run(args: z.infer<S>, ctx: Context): Promise<ToolResult>;
}

const define = <S extends z.ZodObject>(tool: Tool<S>) => tool as unknown as Tool;

const file = z.string().optional().describe('Project file (.haku.json). Leave out to work on the project open in the Haku tab.');
const scope = z.enum(['scene', 'song']).optional().describe('One scene, or the whole arrangement. Default scene.');
const sceneArg = z.string().optional().describe('Scene id or name. Defaults to the active scene.');
const outArg = (what: string) => z.string().describe(`Where to write the ${what}. Relative paths are from the working directory.`);

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'haku';

async function connectedTab(ctx: Context): Promise<Link | null> {
  const link = await ctx.link();
  if (!link) return null;
  const ping = (await link.request({ op: 'ping' })) as PingReply;
  return ping.tab ? link : null;
}

/** The file when one is given, otherwise the live tab. */
async function targetFor(ctx: Context, path: string | undefined): Promise<Target> {
  if (path) return new FileTarget(resolve(ctx.cwd, path));
  const link = await ctx.link();
  if (!link) throw new Error('No project file given, and the Haku bridge isn\'t running. Pass a file, or start "haku bridge" (or the MCP server) and open Haku.');
  if (!(await connectedTab(ctx))) throw new Error(NO_TAB);
  return new LiveTarget(link);
}

/** The scene a tool works on, resolved to an id so file and live targets agree. */
const sceneOf = (project: Project, scene?: string) => findScene(project, scene);

// ---------- Protocol commands, one tool each ----------

const commandTools: Tool[] = CommandSchema.options.map((option) => {
  // Each option is a z.object with a literal type; widen it so omit() has one signature.
  const schema = option as unknown as z.ZodObject<{ type: z.ZodLiteral<CommandType> } & z.ZodRawShape>;
  const type = schema.shape.type.value;
  const input = schema.omit({ type: true }).extend({ file });
  const readOnly = READ_ONLY_COMMANDS.includes(type);
  return define({
    name: type,
    title: type.replace(/_/g, ' '),
    description: COMMAND_HELP[type],
    input,
    readOnly,
    destructive: type === 'remove_layer' || type === 'remove_scene' || type === 'erase',
    async run(args, ctx) {
      const { file: path, ...rest } = args as { file?: string } & Record<string, unknown>;
      const target = await targetFor(ctx, path);
      const reply = await target.run([{ type, ...rest }]);
      return { text: reply.messages.join('\n') };
    },
  });
});

// ---------- Everything else ----------

const batch = define({
  name: 'batch',
  title: 'Run several commands',
  description: 'Run a list of commands in order as one step (one undo in the tab). If any fails, nothing changes. Each item is a command object with a "type" field, like {"type":"draw_line",...}.',
  input: z.object({ file, commands: z.array(CommandSchema).min(1).max(500) }),
  async run({ file: path, commands }, ctx) {
    const target = await targetFor(ctx, path);
    const reply = await target.run(commands);
    return { text: reply.messages.map((m, i) => `${i + 1}. ${m}`).join('\n') };
  },
});

const newProject = define({
  name: 'new_project',
  title: 'New project',
  description: 'Start a new project from a mood. With file, writes a new .haku.json. Without it, opens the new project in the Haku tab (the old one stays saved there).',
  input: z.object({
    file: z.string().optional().describe('Path for the new .haku.json. Leave out to open it in the Haku tab instead.'),
    name: z.string().min(1).max(80).optional(),
    mood: z.enum(MOOD_IDS).optional().describe('Default rainy-study'),
    bars: z.number().int().min(1).max(16).optional().describe('Length of the first scene. Default 4.'),
    seed: z.number().int().optional().describe('Fixes the random humanize and spray, for repeatable renders'),
    overwrite: z.boolean().optional().describe('Replace the file if it exists'),
  }),
  async run({ file: path, name, mood, bars, seed, overwrite }, ctx) {
    const project = createProject({ name, mood, bars, seed });
    if (path) {
      const full = resolve(ctx.cwd, path);
      if (existsSync(full) && !overwrite) throw new Error(`${full} already exists. Pass overwrite to replace it.`);
      await writeProjectFile(full, project);
      return { text: `Created "${project.name}" (${project.mood}) at ${full}` };
    }
    const tab = await connectedTab(ctx);
    if (!tab) throw new Error(NO_TAB);
    await tab.request({ op: 'open_project', project });
    return { text: `Opened a new project "${project.name}" (${project.mood}) in the Haku tab` };
  },
});

const openProject = define({
  name: 'open_project',
  title: 'Open a file in the tab',
  description: 'Send a .haku.json file to the Haku tab and open it there, so you can hear and see it live.',
  input: z.object({ file: z.string().describe('The .haku.json to open') }),
  async run({ file: path }, ctx) {
    const full = resolve(ctx.cwd, path);
    const project = await readProjectFile(full);
    const tab = await connectedTab(ctx);
    if (!tab) throw new Error(NO_TAB);
    await tab.request({ op: 'open_project', project });
    return { text: `Opened "${project.name}" from ${full} in the Haku tab` };
  },
});

const saveProject = define({
  name: 'save_project',
  title: 'Save the tab to a file',
  description: 'Write the project open in the Haku tab to a .haku.json file.',
  input: z.object({ file: outArg('.haku.json'), overwrite: z.boolean().optional().describe('Replace the file if it exists') }),
  async run({ file: path, overwrite }, ctx) {
    const full = resolve(ctx.cwd, path);
    if (existsSync(full) && !overwrite) throw new Error(`${full} already exists. Pass overwrite to replace it.`);
    const tab = await connectedTab(ctx);
    if (!tab) throw new Error(NO_TAB);
    const project = parseProject(await tab.request({ op: 'get_project' }));
    await writeProjectFile(full, project);
    return { text: `Saved "${project.name}" to ${full}` };
  },
});

const play = define({
  name: 'play',
  title: 'Play',
  description: 'Listen. With the Haku tab connected (and no file), it plays there. Otherwise it renders offline and plays through this machine\'s speakers.',
  input: z.object({
    file,
    scope,
    scene: sceneArg,
    loops: z.number().int().min(1).max(8).optional().describe('Times through a scene when rendering offline. Default 2.'),
  }),
  async run({ file: path, scope = 'scene', scene, loops = 2 }, ctx) {
    if (!path) {
      const tab = await connectedTab(ctx);
      if (tab) {
        const status = (await tab.request({ op: 'play', mode: scope === 'song' ? 'song' : 'loop', scene })) as TabStatus;
        return { text: `Playing ${scope === 'song' ? 'the song' : `scene ${status.sceneName} on a loop`} in the Haku tab` };
      }
    }
    const project = await (await targetFor(ctx, path)).read();
    const sceneId = sceneOf(project, scene).id;
    const audio = await loadAudio();
    const pcm = await audio.render(project, scope === 'song' ? { scope: 'song' } : { scope: 'scene', sceneId, loops, tail: 2 });
    const wav = join(tmpdir(), `haku-play-${randomUUID().slice(0, 8)}.wav`);
    await writeFile(wav, audio.wav(pcm));
    const { name, done } = ctx.player.play(wav);
    const seconds = (pcm.channels[0]!.length / pcm.sampleRate).toFixed(1);
    const what = scope === 'song' ? 'the song' : `scene ${sceneOf(project, scene).name}`;
    if (ctx.waitForPlayback) {
      await done;
      return { text: `Played ${what} (${seconds} s) through ${name}` };
    }
    done.catch(() => {});
    return { text: `Playing ${what} (${seconds} s) through ${name}. Call stop to end it early.` };
  },
});

const stop = define({
  name: 'stop',
  title: 'Stop',
  description: 'Stop playback, in the tab and anything playing offline.',
  input: z.object({}),
  async run(_, ctx) {
    const stopped: string[] = [];
    if (ctx.player.stop()) stopped.push('offline playback');
    const tab = await connectedTab(ctx);
    if (tab) {
      await tab.request({ op: 'stop' });
      stopped.push('the Haku tab');
    }
    return { text: stopped.length ? `Stopped ${stopped.join(' and ')}` : 'Nothing was playing' };
  },
});

const snapshot = define({
  name: 'snapshot',
  title: 'Snapshot',
  description: 'A picture of a scene: chords along the top, each layer\'s notes and strokes, and a legend. Returns a PNG. Pass out to also save it (.png or .svg).',
  readOnly: true,
  input: z.object({
    file,
    scene: sceneArg,
    layer: z.string().optional().describe('Layer to bring to the front, with its pitch guides'),
    width: z.number().int().min(400).max(2400).optional().describe('Image width in pixels. Default 1200.'),
    out: z.string().optional().describe('Also save the picture here (.png or .svg)'),
  }),
  async run({ file: path, scene, layer, width = 1200, out }, ctx) {
    const project = await (await targetFor(ctx, path)).read();
    const s = sceneOf(project, scene);
    const svg = snapshotSvg(project, { scene: s.id, layer, width, height: Math.round(width * 0.53) });
    const notes: string[] = [`Snapshot of scene ${s.name} in "${project.name}"`];
    if (out?.toLowerCase().endsWith('.svg')) {
      const full = resolve(ctx.cwd, out);
      await writeFile(full, svg);
      notes.push(`saved to ${full}`);
    }
    const png = await snapshotPng(svg);
    if (out && !out.toLowerCase().endsWith('.svg')) {
      const full = resolve(ctx.cwd, out);
      await writeFile(full, png);
      notes.push(`saved to ${full}`);
    }
    return { text: notes.join(', '), image: { data: png, mimeType: 'image/png' } };
  },
});

const analyze = define({
  name: 'analyze',
  title: 'Analyze',
  description: 'Check a scene or the song: notes per layer, how many strong-beat notes are chord tones, notes outside the key, half-step clashes between layers, and (with audio) loudness from an offline render.',
  readOnly: true,
  input: z.object({
    file,
    scope,
    scene: sceneArg,
    audio: z.boolean().optional().describe('Render and measure loudness too. Takes a few seconds. Default true.'),
  }),
  async run({ file: path, scope = 'scene', scene, audio = true }, ctx) {
    const project = await (await targetFor(ctx, path)).read();
    const ids = scope === 'song' ? [...new Set(project.arrangement.map((a) => a.sceneId))] : [sceneOf(project, scene).id];
    const scenes = analyzeScenes(project, ids);
    let levels = null;
    if (audio) {
      const kit = await loadAudio();
      const pcm = await kit.render(project, scope === 'song' ? { scope: 'song' } : { scope: 'scene', sceneId: ids[0], loops: 2 });
      levels = kit.levels(pcm);
    }
    return { text: formatAnalysis(scenes, levels) };
  },
});

const exportTool = define({
  name: 'export',
  title: 'Export',
  description: 'Write a WAV (rendered offline, same sound as the app), a MIDI file, or the project JSON.',
  readOnly: true,
  input: z.object({
    file,
    format: z.enum(['wav', 'midi', 'json']),
    scope,
    scene: sceneArg,
    out: z.string().optional().describe('Output path. Defaults to a name made from the project (and scene) in the working directory.'),
  }),
  async run({ file: path, format, scope = 'scene', scene, out }, ctx) {
    const project = await (await targetFor(ctx, path)).read();
    const s = sceneOf(project, scene);
    const base = format === 'json' || scope === 'song' ? slug(project.name) : `${slug(project.name)}-${slug(s.name)}`;
    const ext = { wav: '.wav', midi: '.mid', json: '.haku.json' }[format];
    const full = resolve(ctx.cwd, out ?? base + ext);
    if (format === 'json') {
      await writeProjectFile(full, project);
    } else if (format === 'midi') {
      const score = scope === 'song' ? buildArrangementScore(project) : buildSceneScore(project, s.id);
      await writeFile(full, scoreToMidi(project, score));
    } else {
      const kit = await loadAudio();
      // A scene renders twice through so the loop's reverb tail has something to land on, like the app.
      const pcm = await kit.render(project, scope === 'song' ? { scope: 'song' } : { scope: 'scene', sceneId: s.id, loops: 2 });
      await writeFile(full, kit.wav(pcm));
      const lv = kit.levels(pcm);
      return { text: `Wrote ${full} (${lv.seconds.toFixed(1)} s, ${lv.lufs.toFixed(1)} LUFS, peak ${lv.peakDb.toFixed(1)} dBFS)` };
    }
    return { text: `Wrote ${full}` };
  },
});

const status = define({
  name: 'status',
  title: 'Status',
  description: 'Is the bridge running, is a Haku tab connected, and what is it playing.',
  readOnly: true,
  input: z.object({}),
  async run(_, ctx) {
    const lines: string[] = [];
    const link = await ctx.link();
    if (!link) lines.push('Bridge: not running. Start "haku bridge" or the MCP server, then open Haku.');
    else {
      const ping = (await link.request({ op: 'ping' })) as PingReply;
      if (!ping.tab) lines.push('Bridge: running, no Haku tab connected.');
      else {
        const s = (await link.request({ op: 'status' })) as TabStatus;
        lines.push(`Bridge: running, ${ping.tabs} tab${ping.tabs === 1 ? '' : 's'} connected.`);
        lines.push(`Tab: "${s.projectName}", scene ${s.sceneName}, ${s.playing ? `playing (${s.mode})` : 'stopped'}, sounds ${s.engine}.`);
      }
    }
    if (ctx.player.playing) lines.push('Offline playback: playing.');
    return { text: lines.join('\n') };
  },
});

export const TOOLS: Tool[] = [newProject, openProject, saveProject, ...commandTools, batch, play, stop, snapshot, analyze, exportTool, status];
