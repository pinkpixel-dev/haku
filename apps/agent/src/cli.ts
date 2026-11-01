#!/usr/bin/env node
// The haku command. Every tool from tools.ts becomes a subcommand with options generated from its
// schema (draw_line becomes `haku draw-line --from '{"x":0,"y":0.5}' ...`), plus `exec` for a file
// of commands, `web` to open the app in a browser, `bridge` to run the relay on its own, and `mcp`
// to start the MCP server.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Command, Option } from 'commander';
import { z } from 'zod';
import type { PingReply } from '@haku/protocol';
import { BridgeClient, BridgeHost, bridgePort, SharedLink, type Link } from './bridge.ts';
import { GUIDE } from './guide.ts';
import { Player } from './player.ts';
import { TOOLS, type Context, type Tool } from './tools.ts';
import { VERSION } from './version.ts';
import { openBrowser, serveWeb, webPort, webRunning, webUrl } from './web.ts';

type JsonSchema = {
  type?: string | string[];
  enum?: unknown[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
};

const kebab = (s: string) => s.replace(/_/g, '-');

let client: Promise<Link | null> | null = null;
const ctx: Context = {
  // Tries again after a miss, since auto-launch may have just started a bridge.
  link: async () => (await client) ?? (await (client = BridgeClient.connect())),
  player: new Player(),
  waitForPlayback: true,
  // Package-manager scripts (`pnpm haku`) run from the package root; INIT_CWD is where you typed it.
  cwd: process.env.INIT_CWD ?? process.cwd(),
  autoLaunch: !process.env.HAKU_NO_LAUNCH,
};

function fail(message: string): never {
  console.error(`haku: ${message}`);
  process.exit(1);
}

/** Turns one option's text into the value its schema wants. */
function parseValue(raw: string, schema: JsonSchema, flag: string): unknown {
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  if (type === 'number' || type === 'integer') {
    const n = Number(raw);
    if (!Number.isFinite(n)) fail(`--${flag} needs a number, got "${raw}"`);
    return n;
  }
  if (type === 'string' || schema.enum) return raw;
  // Objects, arrays, and unions come in as JSON. A union that allows strings can take the raw text.
  try {
    return JSON.parse(raw);
  } catch {
    const variants = schema.anyOf ?? schema.oneOf ?? [];
    if (variants.some((v) => v.type === 'string')) return raw;
    fail(`--${flag} needs JSON, like '${type === 'array' ? '[...]' : '{...}'}'`);
  }
}

function addTool(program: Command, tool: Tool) {
  const schema = z.toJSONSchema(tool.input, { io: 'input' }) as JsonSchema;
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const cmd = program.command(kebab(tool.name)).description(tool.description);

  for (const [name, prop] of Object.entries(props)) {
    const flag = kebab(name);
    const desc = `${prop.description ?? ''}${required.has(name) ? ' (required)' : ''}`.trim();
    if (prop.type === 'boolean') {
      cmd.addOption(new Option(`--${flag}`, desc));
      cmd.addOption(new Option(`--no-${flag}`).hideHelp());
      continue;
    }
    const short = name === 'file' ? '-f, ' : '';
    const opt = new Option(`${short}--${flag} <value>`, desc);
    if (prop.enum) opt.choices(prop.enum.map(String));
    if (name === 'file' && process.env.HAKU_PROJECT && !required.has(name)) opt.default(process.env.HAKU_PROJECT, '$HAKU_PROJECT');
    cmd.addOption(opt);
  }

  cmd.action(async (opts: Record<string, unknown>) => {
    const args: Record<string, unknown> = {};
    for (const [name, prop] of Object.entries(props)) {
      const v = opts[name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())];
      if (v === undefined) continue;
      args[name] = typeof v === 'string' ? parseValue(v, prop, kebab(name)) : v;
    }
    const parsed = tool.input.safeParse(args);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]!;
      fail(`${issue.path.length ? `--${kebab(issue.path.join('.'))}: ` : ''}${issue.message}`);
    }
    await runTool(tool, parsed.data);
  });
}

async function runTool(tool: Tool, args: unknown) {
  try {
    const result = await tool.run(args as never, ctx);
    console.log(result.text);
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  } finally {
    await (await client)?.close();
  }
}

/** A file (or stdin) of commands: a JSON array, or one JSON object per line. */
async function readCommands(path: string | undefined): Promise<unknown[]> {
  let text: string;
  if (path && path !== '-') text = await readFile(resolve(ctx.cwd, path), 'utf8');
  else {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    text = Buffer.concat(chunks).toString('utf8');
  }
  const trimmed = text.trim();
  if (!trimmed) fail('no commands given');
  try {
    if (trimmed.startsWith('[')) return JSON.parse(trimmed) as unknown[];
    return trimmed
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('//'))
      .map((l) => JSON.parse(l) as unknown);
  } catch (err) {
    fail(`couldn't read the commands as JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
}

const program = new Command('haku')
  .description('Draw lofi music from the terminal. Works on a .haku.json file, or live on the open Haku tab.')
  .version(VERSION)
  .showHelpAfterError();

program
  .command('guide')
  .description('How the canvas, brushes, and commands work.')
  .action(() => console.log(GUIDE));

for (const tool of TOOLS) addTool(program, tool);

program
  .command('exec')
  .argument('[commands]', 'JSON file of commands (an array, or one per line). Reads stdin when left out or "-".')
  .description('Run a file of commands as one step. If any fails, nothing changes.')
  .option('-f, --file <path>', 'Project file. Leave out to work on the Haku tab.', process.env.HAKU_PROJECT)
  .action(async (path: string | undefined, opts: { file?: string }) => {
    const commands = await readCommands(path);
    const batch = TOOLS.find((t) => t.name === 'batch')!;
    const parsed = batch.input.safeParse({ file: opts.file, commands });
    if (!parsed.success) {
      const issue = parsed.error.issues[0]!;
      fail(`${issue.path.join('.')}: ${issue.message}`);
    }
    await runTool(batch, parsed.data);
  });

/** How long an auto-launched `haku web` keeps running with no tab connected. */
const IDLE_MS = 30 * 60_000;

program
  .command('web')
  .description('Open Haku in your browser. Serves the app on localhost and hosts the bridge, so agents can drive it too.')
  .option('--no-open', "Just serve, don't open a browser")
  .addOption(new Option('--exit-when-idle').hideHelp())
  .action(async (opts: { open: boolean; exitWhenIdle?: boolean }) => {
    const port = webPort();
    const url = webUrl(port);
    let server: Awaited<ReturnType<typeof serveWeb>>;
    try {
      server = await serveWeb(port);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EADDRINUSE') fail(err instanceof Error ? err.message : String(err));
      if (!(await webRunning(port))) fail(`port ${port} is taken by something else. Set HAKU_WEB_PORT to use another one.`);
      console.log(`Haku is already running at ${url}`);
      if (opts.open) await openBrowser(url);
      return;
    }

    const link = new SharedLink();
    await link.ensure().catch(() => null);
    console.log(`Haku is running at ${url}. Ctrl+C to stop.`);
    if (opts.open && !(await openBrowser(url))) console.log(`Couldn't open a browser. Open ${url} yourself.`);

    const shutdown = () => {
      server.close();
      void link.close().finally(() => process.exit(0));
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);

    if (opts.exitWhenIdle) {
      let lastTab = Date.now();
      setInterval(async () => {
        const ping = (await link.request({ op: 'ping' }).catch(() => null)) as PingReply | null;
        if (ping?.tab) lastTab = Date.now();
        else if (Date.now() - lastTab > IDLE_MS) shutdown();
      }, 60_000);
    }
  });

program
  .command('bridge')
  .description('Run the localhost bridge on its own, so the CLI can reach the open Haku tab.')
  .action(async () => {
    const port = bridgePort();
    let host: BridgeHost;
    try {
      host = await BridgeHost.listen(port);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') fail(`port ${port} is taken. The MCP server or another bridge is probably already running, which is fine.`);
      throw err;
    }
    host.onEvent = (line) => console.log(line);
    console.log(`Haku bridge on ws://127.0.0.1:${port}. Open Haku in a browser and it connects on its own. Ctrl+C to stop.`);
    process.once('SIGINT', () => void host.close().then(() => process.exit(0)));
  });

program
  .command('mcp')
  .description('Start the MCP server on stdio. It also hosts the bridge to the Haku tab.')
  .action(async () => {
    const { startMcp } = await import('./mcp.ts');
    await startMcp();
  });

// Tool names are snake_case in MCP, so take `haku draw_line` as well as `haku draw-line`.
const argv = [...process.argv];
const sub = argv.findIndex((a, i) => i >= 2 && !a.startsWith('-'));
if (sub >= 0 && /^[a-z]+(_[a-z]+)+$/.test(argv[sub]!)) argv[sub] = kebab(argv[sub]!);

await program.parseAsync(argv);
