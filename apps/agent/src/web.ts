// `haku web`: serves the built app on localhost and opens it in the default browser. Files come from
// the built app first, then the sample set, which is shared with offline rendering instead of being
// shipped twice. /__haku answers so other haku processes can tell this server from anything else.

import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { samplesDir, webDir } from './paths.ts';
import { VERSION } from './version.ts';

export const WEB_HOST = '127.0.0.1';
const WEB_PORT = 5177;

export function webPort(): number {
  const env = Number(process.env.HAKU_WEB_PORT);
  return Number.isInteger(env) && env > 0 ? env : WEB_PORT;
}

/** 127.0.0.1 rather than localhost: projects are stored per origin, so the address has to stay the same. */
export const webUrl = (port = webPort()) => `http://${WEB_HOST}:${port}/`;

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
};

/** Resolves a URL path inside root, or null if it tries to climb out. */
function inside(root: string, urlPath: string): string | null {
  const full = normalize(join(root, urlPath));
  return full === root || full.startsWith(root + sep) ? full : null;
}

async function findFile(roots: string[], urlPath: string): Promise<string | null> {
  for (const root of roots) {
    const full = inside(root, urlPath);
    if (!full) continue;
    const info = await stat(full).catch(() => null);
    if (info?.isFile()) return full;
  }
  return null;
}

/** Starts serving. Rejects with code EADDRINUSE when the port is taken. */
export function serveWeb(port = webPort()): Promise<Server> {
  const roots = [webDir(), samplesDir()];
  const server = createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end();
      return;
    }
    let path: string;
    try {
      path = decodeURIComponent(new URL(req.url ?? '/', 'http://haku').pathname);
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (path === '/__haku') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ haku: true, version: VERSION }));
      return;
    }
    const file = await findFile(roots, path === '/' ? '/index.html' : path);
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      // Bundles have hashed names and never change. Everything else gets checked each time.
      'Cache-Control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, WEB_HOST, () => resolve(server));
  });
}

/** True when a haku web server already answers on the port. */
export async function webRunning(port = webPort()): Promise<boolean> {
  try {
    const res = await fetch(`${webUrl(port)}__haku`, { signal: AbortSignal.timeout(1000) });
    return res.ok && ((await res.json()) as { haku?: boolean }).haku === true;
  } catch {
    return false;
  }
}

/** Opens a URL in the default browser. Resolves false when no opener could be started. */
export function openBrowser(url: string): Promise<boolean> {
  const [cmd, args] =
    process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['explorer.exe', [url]] : ['xdg-open', [url]];
  return new Promise((resolve) => {
    const child = spawn(cmd, args as string[], { stdio: 'ignore', detached: true });
    child.once('error', () => resolve(false));
    child.once('spawn', () => {
      child.unref();
      resolve(true);
    });
  });
}
