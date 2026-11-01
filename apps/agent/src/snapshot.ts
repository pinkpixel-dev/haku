// A picture of one scene, for agents that can see images: the chord strip, beat grid, every layer's
// notes and the strokes that made them, laid out the same way as the web canvas (x is time across
// the scene, y is pitch across each layer's range). Built as SVG, then rasterized with resvg.

import {
  buildSceneScore,
  drumRows,
  findScene,
  INSTRUMENTS,
  keyLabel,
  layerRange,
  noteName,
  pitchToY,
  prefersFlats,
  type Layer,
  type Project,
} from '@haku/core';
import { fontFiles } from './paths.ts';

/** The web app's walnut palette (tokens.css), as hex because resvg doesn't read oklch. */
const C = {
  bg: '#1b1410',
  sunken: '#16100c',
  raised: '#2f2520',
  border: '#3f342e',
  strong: '#5b4c44',
  text: '#f2eee9',
  muted: '#afa69d',
  faint: '#7f756e',
};

const FONT = 'Figtree, sans-serif';

export interface SnapshotOptions {
  scene?: string;
  /** Layer to put in front, with its pitch guides. Defaults to the first layer with notes. */
  layer?: string;
  width?: number;
  height?: number;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const n = (v: number) => Math.round(v * 10) / 10;

export function snapshotSvg(project: Project, opts: SnapshotOptions = {}): string {
  const scene = findScene(project, opts.scene);
  const score = buildSceneScore(project, scene.id);
  const flats = prefersFlats(project.key);
  const W = opts.width ?? 1200;
  const H = opts.height ?? 640;
  const pad = 20;
  const header = 46;
  const strip = 30;
  const legend = 40;
  const x0 = pad;
  const x1 = W - pad;
  const top = header + strip;
  const bottom = H - legend;
  const cw = x1 - x0;
  const ch = bottom - top;
  const beats = scene.bars * 4;
  const bx = (b: number) => x0 + (b / beats) * cw;

  const noteCount = (l: Layer) => score.events.filter((e) => e.track === l.id).length;
  const focus =
    scene.layers.find((l) => l.id === opts.layer || l.name.toLowerCase() === opts.layer?.toLowerCase()) ??
    scene.layers.find((l) => noteCount(l) > 0) ??
    scene.layers[0] ??
    null;

  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">`);
  out.push(`<rect width="${W}" height="${H}" fill="${C.bg}"/>`);

  // Header: project, scene, key, tempo.
  out.push(`<text x="${x0}" y="29" font-size="17" font-weight="600" fill="${C.text}">${esc(project.name)}</text>`);
  const info = `Scene ${scene.name} · ${scene.bars} bars · ${keyLabel(project.key)} · ${project.bpm} BPM`;
  out.push(`<text x="${x1}" y="29" font-size="13" fill="${C.muted}" text-anchor="end">${esc(info)}</text>`);

  // Chord strip.
  out.push(`<rect x="${x0}" y="${header}" width="${cw}" height="${strip}" fill="${C.sunken}" rx="4"/>`);
  for (const [i, chord] of score.chords.entries()) {
    const cx = bx(chord.time);
    const w = bx(chord.time + chord.duration) - cx;
    if (i % 2 === 1) out.push(`<rect x="${n(cx)}" y="${header}" width="${n(w)}" height="${strip}" fill="${C.raised}" opacity="0.5"/>`);
    out.push(`<text x="${n(cx + 9)}" y="${header + 20}" font-size="12.5" font-weight="600" fill="${C.muted}">${esc(chord.symbol)}</text>`);
  }

  // Canvas and grid.
  out.push(`<rect x="${x0}" y="${top}" width="${cw}" height="${ch}" fill="${C.sunken}" opacity="0.55"/>`);
  for (let b = 0; b <= beats; b++) {
    const gx = n(bx(b));
    const bar = b % 4 === 0;
    out.push(`<line x1="${gx}" y1="${bar ? header : top}" x2="${gx}" y2="${bottom}" stroke="${bar ? C.strong : C.border}" opacity="${bar ? 0.9 : 0.45}"/>`);
    // Bar numbers sit at the bottom right of each bar, clear of the pitch labels on the left.
    if (bar && b > 0) out.push(`<text x="${n(gx - 6)}" y="${bottom - 6}" font-size="10" fill="${C.faint}" text-anchor="end">${b / 4}</text>`);
  }

  // Pitch guides for the focus layer: drum rows, or a line per C.
  if (focus && INSTRUMENTS[focus.instrument].kind === 'drums') {
    const rows = drumRows(focus.kit);
    rows.forEach((piece, i) => {
      const y = n(top + (1 - (i + 1) / rows.length) * ch);
      out.push(`<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${C.border}" opacity="0.5"/>`);
      out.push(`<text x="${x0 + 7}" y="${n(y + ch / rows.length / 2 + 4)}" font-size="10.5" fill="${C.faint}">${piece}</text>`);
    });
  } else if (focus) {
    const range = layerRange(focus);
    for (let m = Math.ceil(range[0] / 12) * 12; m <= range[1]; m += 12) {
      const y = n(top + pitchToY(m, range) * ch);
      out.push(`<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${C.border}" stroke-dasharray="2 4" opacity="0.6"/>`);
      out.push(`<text x="${x0 + 7}" y="${n(y - top < 16 ? y + 12 : y - 5)}" font-size="10.5" fill="${C.faint}">${noteName(m, flats)}</text>`);
    }
  }

  // Notes and strokes, background layers first so the focus layer sits on top.
  const layers = [...scene.layers].sort((a, b) => Number(a.id === focus?.id) - Number(b.id === focus?.id));
  for (const layer of layers) {
    const front = layer.id === focus?.id;
    const drums = INSTRUMENTS[layer.instrument].kind === 'drums';
    const range = layerRange(layer);
    const rows = drumRows(layer.kit);
    out.push(`<g fill="${layer.color}" opacity="${front ? 0.75 : 0.32}">`);
    for (const e of score.events) {
      if (e.track !== layer.id) continue;
      let ny: number;
      let nh: number;
      if (drums) {
        const i = Math.max(0, rows.indexOf(e.drum as (typeof rows)[number]));
        ny = 1 - (i + 1) / rows.length;
        nh = 1 / rows.length;
      } else {
        nh = 1 / (range[1] - range[0]);
        ny = pitchToY(e.midi, range) - nh / 2;
      }
      const rx = bx(e.time);
      const rw = Math.max(3, bx(e.time + e.duration) - rx - 1.5);
      const rh = Math.max(4, nh * ch - 1.5);
      out.push(`<rect x="${n(rx)}" y="${n(top + ny * ch)}" width="${n(rw)}" height="${n(rh)}" rx="${n(Math.min(3, rh / 2))}"/>`);
    }
    out.push('</g>');
    for (const s of layer.strokes) {
      const width = n(2 + s.size * 10);
      const opacity = front ? 0.85 : 0.2;
      if (s.points.length === 1) {
        const p = s.points[0]!;
        out.push(`<circle cx="${n(x0 + p.x * cw)}" cy="${n(top + p.y * ch)}" r="${n(width / 2 + 1)}" fill="${layer.color}" opacity="${opacity}"/>`);
      } else {
        const pts = s.points.map((p) => `${n(x0 + p.x * cw)},${n(top + p.y * ch)}`).join(' ');
        out.push(`<polyline points="${pts}" fill="none" stroke="${layer.color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`);
      }
    }
  }

  // Legend: one chip per layer.
  let lx = x0;
  const ly = H - legend / 2 + 4;
  if (!scene.layers.length) out.push(`<text x="${lx}" y="${ly}" font-size="12" fill="${C.faint}">No layers yet</text>`);
  for (const layer of scene.layers) {
    const flags = [layer.muted && 'muted', layer.solo && 'solo'].filter(Boolean).join(', ');
    const label = `${layer.name} · ${INSTRUMENTS[layer.instrument].label} · ${noteCount(layer)} notes${flags ? ` · ${flags}` : ''}`;
    const weight = layer.id === focus?.id ? 600 : 400;
    out.push(`<rect x="${lx}" y="${ly - 9}" width="10" height="10" rx="2" fill="${layer.color}"/>`);
    out.push(`<text x="${lx + 16}" y="${ly}" font-size="12" font-weight="${weight}" fill="${layer.id === focus?.id ? C.text : C.muted}">${esc(label)}</text>`);
    // Rough text width, close enough to space the chips.
    lx += 16 + label.length * 6.6 + 22;
  }

  out.push('</svg>');
  return out.join('\n');
}

/** PNG bytes. resvg is a native module, so it's only loaded when a PNG is actually asked for. */
export async function snapshotPng(svg: string, width?: number): Promise<Buffer> {
  const { Resvg } = await import('@resvg/resvg-js');
  const files = fontFiles();
  const resvg = new Resvg(svg, {
    fitTo: width ? { mode: 'width', value: width } : { mode: 'original' },
    // The bundled Figtree only. If it's somehow missing, fall back to the (slow) system fonts.
    font: files.length ? { loadSystemFonts: false, fontFiles: files, defaultFontFamily: 'Figtree', sansSerifFamily: 'Figtree' } : { loadSystemFonts: true },
  });
  return resvg.render().asPng();
}
