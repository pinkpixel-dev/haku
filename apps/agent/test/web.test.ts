// The `haku web` static server: the app, the shared samples, the health check, and nothing outside them.

import type { Server } from 'node:http';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serveWeb, webRunning } from '../src/web.ts';

let server: Server;
let base: string;
let port: number;

beforeAll(async () => {
  // A fixture stands in for the built app, so the test doesn't need a web build first.
  process.env.HAKU_WEB_DIR = join(import.meta.dirname, 'fixtures/web');
  server = await serveWeb(0);
  port = (server.address() as { port: number }).port;
  base = `http://127.0.0.1:${port}`;
});

afterAll(() => {
  delete process.env.HAKU_WEB_DIR;
  server.close();
});

const get = (path: string) => fetch(base + path);

describe('haku web server', () => {
  it('serves the app and falls back to the sample set', async () => {
    const page = await get('/');
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toMatch(/text\/html/);
    const manifest = await get('/manifest.json');
    expect(manifest.status).toBe(200);
    expect((await manifest.json()) as object).toHaveProperty('instruments');
  });

  it('answers the health check', async () => {
    expect(await webRunning(port)).toBe(true);
  });

  it("won't serve files outside its folders", async () => {
    for (const path of ['/%2e%2e/%2e%2e/package.json', '/..%2f..%2fpackage.json', '/nope']) expect((await get(path)).status).toBe(404);
  });
});
