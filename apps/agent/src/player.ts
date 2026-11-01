// Plays a rendered WAV through whatever command-line player this machine has. Used for `play` when
// no tab is connected.

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';

const PLAYERS: { cmd: string; args: (file: string) => string[] }[] = [
  { cmd: 'pw-play', args: (f) => [f] },
  { cmd: 'paplay', args: (f) => [f] },
  { cmd: 'aplay', args: (f) => ['-q', f] },
  { cmd: 'afplay', args: (f) => [f] },
  { cmd: 'ffplay', args: (f) => ['-nodisp', '-autoexit', '-loglevel', 'quiet', f] },
];

function onPath(cmd: string): boolean {
  const exts = process.platform === 'win32' ? (process.env.PATHEXT ?? '.EXE').split(';') : [''];
  return (process.env.PATH ?? '').split(delimiter).some((dir) => exts.some((ext) => existsSync(join(dir, cmd + ext))));
}

function findPlayer(file: string): { cmd: string; args: string[] } | null {
  if (process.platform === 'win32') {
    // PowerShell can always play a WAV, no extra install needed.
    return { cmd: 'powershell', args: ['-NoProfile', '-Command', `(New-Object Media.SoundPlayer '${file.replace(/'/g, "''")}').PlaySync()`] };
  }
  const p = PLAYERS.find((p) => onPath(p.cmd));
  return p ? { cmd: p.cmd, args: p.args(file) } : null;
}

export class Player {
  private child: ChildProcess | null = null;

  /** Starts playing and returns the player's name. `done` settles when it finishes or is stopped. */
  play(file: string): { name: string; done: Promise<void> } {
    this.stop();
    const player = findPlayer(file);
    if (!player) throw new Error(`No audio player found. Install one of ${PLAYERS.map((p) => p.cmd).join(', ')}, or open Haku in a browser.`);
    const child = spawn(player.cmd, player.args, { stdio: 'ignore' });
    this.child = child;
    const done = new Promise<void>((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', () => resolve());
    }).finally(() => {
      if (this.child === child) this.child = null;
    });
    return { name: player.cmd, done };
  }

  get playing() {
    return this.child !== null;
  }

  stop(): boolean {
    if (!this.child) return false;
    this.child.kill();
    this.child = null;
    return true;
  }
}
