// Makes the built app installable: a web manifest, icons, and a service worker that precaches the
// app plus the whole sample set. The manifest is emitted under a fixed name instead of linked from
// index.html, because Vite would otherwise try to bundle it and leave its icon paths behind.
// manifest.webmanifest, not manifest.json: that name already belongs to the sample manifest.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Plugin } from 'vite';

const here = (file: string) => new URL(`./${file}`, import.meta.url);
const ICONS = ['icon-192.png', 'icon-512.png'];

const MANIFEST = {
  name: 'Haku',
  short_name: 'Haku',
  description: 'Draw on a canvas, get cozy lofi music.',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#201a17',
  theme_color: '#201a17',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  ],
};

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

export function pwa(): Plugin {
  let publicDir = '';
  return {
    name: 'haku-pwa',
    enforce: 'post',
    configResolved(config) {
      publicDir = config.publicDir;
    },
    transformIndexHtml() {
      return [
        { tag: 'link', attrs: { rel: 'manifest', href: '/manifest.webmanifest' }, injectTo: 'head' },
        { tag: 'link', attrs: { rel: 'icon', type: 'image/png', href: '/icon-192.png' }, injectTo: 'head' },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/icon-192.png' }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'theme-color', content: MANIFEST.theme_color }, injectTo: 'head' },
      ];
    },
    // The dev server gets the manifest and icons too, but no service worker (it would cache dev builds).
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0];
        if (path === '/manifest.webmanifest') {
          res.setHeader('Content-Type', 'application/manifest+json');
          res.end(JSON.stringify(MANIFEST));
        } else if (path && ICONS.includes(path.slice(1))) {
          res.setHeader('Content-Type', 'image/png');
          res.end(readFileSync(here(path.slice(1))));
        } else next();
      });
    },
    generateBundle(_, bundle) {
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: JSON.stringify(MANIFEST, null, 2) });
      for (const icon of ICONS) this.emitFile({ type: 'asset', fileName: icon, source: readFileSync(here(icon)) });

      const samples = walk(publicDir).map((f) => relative(publicDir, f).split(sep).join('/'));
      const built = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const files = ['/', ...new Set([...built, ...samples, 'manifest.webmanifest', ...ICONS])].map((f) => (f === '/' ? f : `/${f}`)).sort();
      // A new list (new hashed bundles, new samples) means a new cache, and the old one gets cleared.
      const version = createHash('sha256').update(files.join('\n')).update(readFileSync(here('sw.js'))).digest('hex').slice(0, 12);
      const sw = readFileSync(here('sw.js'), 'utf8').replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(files));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: sw });
    },
  };
}
