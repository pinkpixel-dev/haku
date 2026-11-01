// Bundles the CLI and MCP server for npm. The workspace packages (@haku/core, protocol, audio) are
// private, so they're bundled in; everything else stays a normal dependency. The sample set and the
// snapshot fonts are copied next to the bundle, where src/paths.ts looks for them, and so is the
// built web app (the build script builds it first).

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
    // The built web app for `haku web`, minus its copy of the samples (served from dist/samples).
    { from: '../web/dist/assets', to: 'dist/web' },
    { from: '../web/dist/*.{html,js,webmanifest,png}', to: 'dist/web' },
    // The samples include a CC-BY instrument, so the license and credits travel with the package.
    { from: '../../LICENSE', to: 'dist' },
  ],
});
