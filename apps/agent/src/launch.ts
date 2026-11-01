// Opening Haku for a tool that needs the live tab when none is connected: start `haku web` in the
// background if it isn't running, open the browser, and wait for the tab to say hello.

import { spawn } from 'node:child_process';
import type { PingReply } from '@haku/protocol';
import type { Link } from './bridge.ts';
import { openBrowser, webPort, webRunning, webUrl } from './web.ts';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls until check returns something truthy, or gives up with null. */
async function waitFor<T>(check: () => Promise<T | null | false>, timeoutMs: number): Promise<T | null> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() >= end) return null;
    await sleep(400);
  }
}

async function tabOn(getLink: () => Promise<Link | null>): Promise<Link | null> {
  try {
    const link = await getLink();
    if (!link) return null;
    return ((await link.request({ op: 'ping' })) as PingReply).tab ? link : null;
  } catch {
    return null;
  }
}

export async function launchTab(getLink: () => Promise<Link | null>): Promise<Link> {
  const port = webPort();
  const url = webUrl(port);

  if (!(await webRunning(port))) {
    // argv[1] is this haku's own entry point, so the server runs the same version (or the same source).
    const child = spawn(process.execPath, [process.argv[1]!, 'web', '--no-open', '--exit-when-idle'], { detached: true, stdio: 'ignore' });
    child.unref();
    if (!(await waitFor(() => webRunning(port), 10_000))) {
      throw new Error(`Couldn't start haku web on port ${port}. Run "haku web" yourself to see what went wrong.`);
    }
  }

  // A tab that's already open might just be reconnecting to a fresh bridge, so give it a moment
  // before opening a second one.
  const existing = await waitFor(() => tabOn(getLink), 3000);
  if (existing) return existing;

  const opened = await openBrowser(url);
  const fresh = await waitFor(() => tabOn(getLink), 45_000);
  if (fresh) return fresh;
  throw new Error(
    opened
      ? `Opened Haku at ${url}, but no tab connected yet. Check the browser, then try again.`
      : `No Haku tab is connected and no browser could be opened. Open ${url} yourself, then try again.`,
  );
}
