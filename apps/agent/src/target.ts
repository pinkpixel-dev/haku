// Where commands land: a project file on disk, or the project open in a connected tab. Both take
// the same commands and answer the same way, so tools don't care which one they have.

import { randomUUID } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { parseProject, type Project } from '@haku/core';
import { executeUnknown, READ_ONLY_COMMANDS, type CommandType, type ExecuteReply } from '@haku/protocol';
import type { Link } from './bridge.ts';

export interface Target {
  readonly kind: 'file' | 'live';
  /** For messages: the file path, or "the Haku tab". */
  readonly label: string;
  read(): Promise<Project>;
  /** Runs commands in order. If one fails, none of them stick. */
  run(commands: unknown[]): Promise<ExecuteReply>;
}

const isReadOnly = (cmd: unknown) => READ_ONLY_COMMANDS.includes((cmd as { type: CommandType })?.type);

/** Applies commands to a project in memory. Throws on the first bad one, naming which it was. */
export function applyAll(project: Project, commands: unknown[]): { project: Project } & ExecuteReply {
  const messages: string[] = [];
  const data: unknown[] = [];
  for (const [i, cmd] of commands.entries()) {
    try {
      const r = executeUnknown(project, cmd);
      project = r.project;
      messages.push(r.message);
      data.push(r.data ?? null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(commands.length > 1 ? `Command ${i + 1} (${(cmd as { type?: string })?.type ?? '?'}) failed: ${msg}. Nothing was changed.` : msg);
    }
  }
  return { project, messages, data };
}

export async function readProjectFile(path: string): Promise<Project> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') throw new Error(`No project file at ${path}. Make one with new_project.`);
    throw err;
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${path} isn't valid JSON`);
  }
  return parseProject(data);
}

/** Writes through a temp file and a rename, so a crash never leaves half a project behind. */
export async function writeProjectFile(path: string, project: Project): Promise<void> {
  const tmp = `${path}.${randomUUID().slice(0, 8)}.tmp`;
  await writeFile(tmp, `${JSON.stringify(project, null, 2)}\n`);
  await rename(tmp, path);
}

export class FileTarget implements Target {
  readonly kind = 'file';
  readonly label: string;

  constructor(path: string) {
    this.label = path;
  }

  read() {
    return readProjectFile(this.label);
  }

  async run(commands: unknown[]): Promise<ExecuteReply> {
    const result = applyAll(await this.read(), commands);
    if (!commands.every(isReadOnly)) await writeProjectFile(this.label, result.project);
    return { messages: result.messages, data: result.data };
  }
}

export class LiveTarget implements Target {
  readonly kind = 'live';
  readonly label = 'the Haku tab';
  private link: Link;

  constructor(link: Link) {
    this.link = link;
  }

  async read() {
    return parseProject(await this.link.request({ op: 'get_project' }));
  }

  async run(commands: unknown[]): Promise<ExecuteReply> {
    // Reading needs no round trip through the tab's undo history.
    if (commands.every(isReadOnly)) {
      const { messages, data } = applyAll(await this.read(), commands);
      return { messages, data };
    }
    return (await this.link.request({ op: 'execute', commands })) as ExecuteReply;
  }
}
