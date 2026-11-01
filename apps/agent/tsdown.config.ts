// Bundles the CLI and MCP server for npm. The workspace packages (@haku/core, protocol, audio) are
// private, so they're bundled in; everything else stays a normal dependency. The sample set and the
// snapshot fonts are copied next to the bundle, where src/paths.ts looks for them.

import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node22.18',
  outDir: 'dist',
  clean: true,
  dts: false,
  deps: { alwaysBundle: [/^@haku\//] },
  copy: [
    { from: '../../assets/samples', to: 'dist' },
    { from: 'assets/fonts/*', to: 'dist/fonts' },
  ],
});
