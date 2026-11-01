// The MCP server: every tool from tools.ts over stdio. It also hosts the localhost bridge (or joins
// one that's already running), so an open Haku tab can be driven live while the agent is connected.

import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { SharedLink } from './bridge.ts';
import { GUIDE } from './guide.ts';
import { Player } from './player.ts';
import { TOOLS, type Context } from './tools.ts';
import { VERSION } from './version.ts';

export async function startMcp() {
  // stdout is the protocol channel. Anything that logs with console.log goes to stderr instead.
  console.log = console.error;
  console.info = console.error;

  const link = new SharedLink();
  try {
    await link.ensure();
    console.error(link.hosting ? 'Haku bridge listening, waiting for a tab' : 'Joined the Haku bridge that was already running');
  } catch (err) {
    console.error(`Haku bridge unavailable: ${err instanceof Error ? err.message : String(err)}. File tools still work.`);
  }

  const player = new Player();
  const ctx: Context = {
    link: () => link.ensure().catch(() => null),
    player,
    waitForPlayback: false,
    cwd: process.cwd(),
  };

  const handle = serveStdio(() => {
    const server = new McpServer({ name: 'haku', version: VERSION }, { instructions: GUIDE });
    for (const tool of TOOLS) {
      server.registerTool(
        tool.name,
        {
          title: tool.title,
          description: tool.description,
          inputSchema: tool.input,
          annotations: { readOnlyHint: tool.readOnly ?? false, destructiveHint: tool.destructive ?? false },
        },
        async (args: unknown) => {
          try {
            const result = await tool.run(args as never, ctx);
            const content: ({ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string })[] = [{ type: 'text', text: result.text }];
            if (result.image) content.push({ type: 'image', data: result.image.data.toString('base64'), mimeType: result.image.mimeType });
            return { content };
          } catch (err) {
            return { content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }], isError: true };
          }
        },
      );
    }
    // The bridge and any playback keep the process alive, so let them go when the client leaves.
    server.server.onclose = () => {
      player.stop();
      void link.close().then(() => process.exit(0));
    };
    return server;
  });

  const shutdown = () => {
    player.stop();
    void Promise.all([handle.close(), link.close()]).finally(() => process.exit(0));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
