import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { pwa } from './pwa/plugin.ts';

export default defineConfig({
  plugins: [react(), pwa()],
  // The processed sample set is served as-is at the site root (manifest.json, piano/, drums/, ...).
  // Pointing at assets/samples rather than assets/ keeps the raw sources out of the build.
  publicDir: fileURLToPath(new URL('../../assets/samples', import.meta.url)),
  server: { port: 5178, strictPort: true },
});
