// The organic bits of the room, drawn as small inline SVGs: hanging vines, leaf sprigs for panel
// titles, the sleeping cat, and the tiny pictures on the photo, mug, and sheet music. Colors come
// from CSS classes in room.css so everything follows the tokens. All of it is decoration.

import { useMemo } from 'react';

/** Seeded so the art is identical on every render. */
function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

/** A pothos-ish leaf pointing along +x: one flat shape plus a darker half for the cel shading. */
function Leaf({ x, y, r, s = 1, flip = false }: { x: number; y: number; r: number; s?: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${flip ? -s : s} ${s})`}>
      <path className="art-leaf" d="M0 0 C 6 -6 14 -4 15 4 C 14 10 6 13 0 0 Z" />
      <path className="art-leaf-shade" d="M0 0 C 6 4 10 8 15 4 C 14 10 6 13 0 0 Z" />
    </g>
  );
}

interface VineProps {
  /** Length along the vine in SVG units (one unit is one CSS pixel at scale 1). */
  length: number;
  seed: number;
  /** Hang straight down, or drape sideways like a garland. */
  horizontal?: boolean;
  className?: string;
}

/** A wavy stem with leaves alternating sides, getting a little smaller toward the end. */
export function Vine({ length, seed, horizontal = false, className = '' }: VineProps) {
  const { stem, leaves } = useMemo(() => {
    const rand = seeded(seed);
    const pts: [number, number][] = [];
    for (let a = 0; a <= length; a += 24) pts.push([a, 22 + Math.sin(a / 41 + seed) * 9]);
    const xy = ([a, b]: [number, number]) => (horizontal ? `${a} ${b}` : `${b} ${a}`);
    let d = `M${xy(pts[0]!)}`;
    for (let i = 1; i < pts.length; i++) {
      const [a0, b0] = pts[i - 1]!;
      const [a1, b1] = pts[i]!;
      d += ` Q${xy([a0 + 12, b0])} ${xy([(a0 + a1) / 2, (b0 + b1) / 2])} T${xy([a1, b1])}`;
    }
    const leaves = pts.slice(1).map(([a, b], i) => {
      const side = i % 2 === 0;
      const fade = 1 - (a / length) * 0.35;
      // Vertical vines point leaves outward and down; garlands let them droop.
      const r = horizontal ? (side ? 62 : 118) + rand() * 24 - 12 : (side ? 28 : 152) + rand() * 30 - 15;
      const [x, y] = horizontal ? [a, b] : [b, a];
      return { x, y, r, s: (1.25 + rand() * 0.45) * fade, flip: rand() > 0.5 };
    });
    return { stem: d, leaves };
  }, [length, seed, horizontal]);

  const [w, h] = horizontal ? [length + 24, 48] : [48, length + 24];
  return (
    <svg className={`vine ${className}`} viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <path className="art-vine" d={stem} fill="none" strokeWidth="2" strokeLinecap="round" />
      {leaves.map((l, i) => (
        <Leaf key={i} {...l} />
      ))}
    </svg>
  );
}

/** Three little leaves on a twig, for panel titles. */
export function Sprig({ className = '' }: { className?: string }) {
  return (
    <svg className={`sprig ${className}`} viewBox="0 0 36 18" width="30" height="15" aria-hidden="true">
      <path className="art-vine" d="M2 13 C 12 13 22 10 34 4" fill="none" strokeWidth="1.4" strokeLinecap="round" />
      <Leaf x={9} y={13} r={-110} s={0.62} />
      <Leaf x={17} y={11} r={-60} s={0.7} flip />
      <Leaf x={24} y={9} r={-100} s={0.66} />
      <Leaf x={33} y={4} r={-20} s={0.62} />
    </svg>
  );
}

/**
 * A ginger cat asleep on top of the band panel, tail hanging over the front edge.
 * The panel's top edge sits at y = 118 in this drawing.
 */
export function Cat({ className = '' }: { className?: string }) {
  return (
    <svg className={`cat ${className}`} viewBox="0 0 230 200" aria-hidden="true">
      {/* Tail over the edge, drawn first so the body sits on top of its root. */}
      <path className="art-fur-stroke" d="M186 108 C 214 110 216 140 208 162 C 203 176 208 186 214 192" fill="none" strokeWidth="13" strokeLinecap="round" />
      <path className="art-fur-dark-stroke" d="M210 152 C 206 166 206 178 212 188" fill="none" strokeWidth="13" strokeLinecap="round" strokeDasharray="7 9" />
      <path className="art-fur-light-stroke" d="M209 181 C 210 186 212 190 214 192" fill="none" strokeWidth="13" strokeLinecap="round" />

      {/* Body, with a darker flank and back stripes. */}
      <path className="art-fur" d="M66 119 C 60 84 96 58 140 60 C 182 62 206 88 200 119 Z" />
      <path className="art-fur-dark" d="M80 119 C 110 106 168 102 200 112 L 200 119 Z" />
      <path className="art-fur-dark-stroke" d="M124 63 q 7 12 2 24 M144 62 q 7 12 2 24 M163 67 q 6 11 1 22 M180 76 q 5 10 0 19" fill="none" strokeWidth="5" strokeLinecap="round" />

      {/* Head resting on its paws. */}
      <path className="art-fur" d="M38 76 L 34 44 L 58 62 Z" />
      <path className="art-fur" d="M74 62 L 96 44 L 98 76 Z" />
      <path className="art-ear" d="M40 70 L 38 52 L 52 63 Z" />
      <path className="art-ear" d="M80 63 L 93 52 L 93 70 Z" />
      <ellipse className="art-fur" cx="66" cy="90" rx="36" ry="28" />
      <path className="art-fur-dark-stroke" d="M60 66 v 10 M67 64 v 12 M74 66 v 10" fill="none" strokeWidth="3.4" strokeLinecap="round" />
      <ellipse className="art-fur-light" cx="64" cy="102" rx="18" ry="11" />
      <path className="art-ink" d="M42 91 q 7 6 14 0 M72 91 q 7 6 14 0" fill="none" strokeWidth="2.2" strokeLinecap="round" />
      <path className="art-ear" d="M60 97 h 8 l -4 4 Z" />
      <path className="art-blush" d="M38 100 h 10 M82 100 h 10" fill="none" strokeWidth="2.4" strokeLinecap="round" />

      {/* Front paws tucked in. */}
      <ellipse className="art-fur-light" cx="50" cy="116" rx="15" ry="6" />
      <ellipse className="art-fur-light" cx="86" cy="117" rx="13" ry="5" />
    </svg>
  );
}

/** The sunset in the pinned photo: flat bands, a sun, two hills, a tree. */
export function SunsetPicture() {
  return (
    <svg viewBox="0 0 80 70" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="80" height="70" fill="#5f4763" />
      <rect y="16" width="80" height="14" fill="#86566c" />
      <rect y="30" width="80" height="12" fill="#c46f6c" />
      <rect y="42" width="80" height="12" fill="#e69172" />
      <circle cx="50" cy="44" r="10" fill="#f7c48f" />
      <path d="M0 50 Q 22 40 44 50 T 80 46 V 70 H 0 Z" fill="#6a4558" />
      <path d="M0 60 Q 30 52 60 60 T 80 58 V 70 H 0 Z" fill="#4a3046" />
      <path d="M16 56 v -8 M12 50 q 4 -8 8 0" stroke="#3a2638" strokeWidth="2" fill="none" />
      <path d="M8 16 q 6 -3 12 -1 q 6 2 12 0 M50 10 q 5 -3 10 -1" stroke="#9b6a80" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Painted flowers on the mug. */
export function MugFlowers() {
  const flower = (x: number, y: number, s: number) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {[0, 72, 144, 216, 288].map((r) => (
        <ellipse key={r} className="art-petal" cx="0" cy="-5" rx="3.4" ry="5" transform={`rotate(${r})`} />
      ))}
      <circle className="art-flower-heart" r="2.4" />
    </g>
  );
  return (
    <svg viewBox="0 0 44 34" aria-hidden="true">
      <path className="art-vine" d="M6 30 C 12 22 18 20 24 12 M24 22 C 30 20 34 16 38 10" fill="none" strokeWidth="1.2" />
      <Leaf x={12} y={24} r={-150} s={0.5} />
      <Leaf x={30} y={19} r={-40} s={0.5} />
      {flower(14, 14, 1)}
      {flower(32, 22, 0.8)}
      {flower(36, 8, 0.6)}
    </svg>
  );
}

/** A scatter of notes on the open sheet music. */
export function SheetNotes({ seed }: { seed: number }) {
  const notes = useMemo(() => {
    const rand = seeded(seed);
    // Two staves of seven notes, each on a line or a space.
    return Array.from({ length: 14 }, (_, i) => ({ x: 14 + (i % 7) * 22 + rand() * 4, y: 14 + Math.floor(i / 7) * 34 + Math.floor(rand() * 9) * 2.5 }));
  }, [seed]);
  return (
    <svg className="sheet__notes" viewBox="0 0 170 70" preserveAspectRatio="none" aria-hidden="true">
      {[14, 48].flatMap((top) =>
        [0, 5, 10, 15, 20].map((k) => <path key={`${top}-${k}`} className="art-staff" d={`M6 ${top + k} H164`} strokeWidth="0.6" />),
      )}
      {notes.map((n, i) => (
        <g key={i} transform={`translate(${n.x} ${n.y})`}>
          <ellipse className="art-ink-fill" rx="2.6" ry="1.9" transform="rotate(-20)" />
          <path className="art-ink" d="M2.3 -0.5 V -11" strokeWidth="0.9" />
        </g>
      ))}
    </svg>
  );
}
