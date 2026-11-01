// What you see through the window, one flat cel-shaded backdrop per scene. Everything is drawn in
// the window art's coordinate space (viewBox 320 x 206), and the glass sits at x 14 to 306,
// y 12 to 178. Skies are flat bands, not gradients, to keep the cel look.

import type { ReactNode } from 'react';
import type { WindowScene } from '@haku/core';

export const GLASS = { x: 14, y: 12, w: 292, h: 166 } as const;
const R = GLASS.x + GLASS.w;
const B = GLASS.y + GLASS.h;

function Bands({ colors }: { colors: string[] }) {
  // Lower bands are a little taller, like light pooling near the horizon.
  const weights = colors.map((_, i) => 1 + i * 0.25);
  const total = weights.reduce((a, b) => a + b, 0);
  let y: number = GLASS.y;
  return (
    <>
      {colors.map((c, i) => {
        const h = (weights[i]! / total) * GLASS.h;
        const rect = <rect key={c + i} x={GLASS.x} y={y} width={GLASS.w} height={h + 0.5} fill={c} />;
        y += h;
        return rect;
      })}
    </>
  );
}

/** Seeded positions so the art is identical on every render. */
function scatter(count: number, seed: number) {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  return Array.from({ length: count }, () => [rand(), rand()] as const);
}

const STARS = scatter(26, 11).map(([a, b]) => [GLASS.x + a * GLASS.w, GLASS.y + b * 70] as const);

function Rain() {
  return (
    <>
      <Bands colors={['#38414d', '#424c58', '#4d5864', '#58636d']} />
      <path d={`M${GLASS.x} 140 Q 70 118 130 132 T 230 124 T ${R} 132 V ${B} H ${GLASS.x} Z`} fill="#343d48" />
      {/* Rooftops across the street. */}
      <path d={`M${GLASS.x} 152 L 40 152 L 60 136 L 80 152 L 112 152 V 146 H 150 L 172 128 L 194 146 H 238 L 256 134 L 274 146 H ${R} V ${B} H ${GLASS.x} Z`} fill="#272d35" />
      <rect x="62" y="128" width="7" height="12" fill="#272d35" />
      <rect x="258" y="124" width="6" height="12" fill="#272d35" />
      <rect x="120" y="156" width="8" height="7" fill="#e7b77f" opacity="0.55" />
      <rect x="204" y="154" width="8" height="7" fill="#e7b77f" opacity="0.4" />
    </>
  );
}

function Dusk() {
  return (
    <>
      <Bands colors={['#5f4763', '#86566c', '#b56a6e', '#d9846c', '#efa679']} />
      <circle cx="214" cy="150" r="28" fill="#f7c48f" />
      <path d={`M${GLASS.x} 138 Q 80 116 150 134 T ${R} 126 V ${B} H ${GLASS.x} Z`} fill="#6a4558" />
      <path d={`M${GLASS.x} 156 Q 110 140 190 154 T ${R} 150 V ${B} H ${GLASS.x} Z`} fill="#4a3046" />
      {/* A few birds heading home. */}
      <path d="M86 58 q4 -4 8 0 q4 -4 8 0 M110 46 q3 -3 6 0 q3 -3 6 0" stroke="#4a3046" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </>
  );
}

function NightCity() {
  const buildings: [number, number, number][] = [
    [14, 34, 70], [46, 26, 96], [70, 40, 58], [108, 22, 110], [128, 36, 76], [162, 30, 92], [190, 44, 64], [232, 24, 104], [254, 30, 80], [282, 24, 66],
  ];
  const lit = scatter(60, 5);
  return (
    <>
      <Bands colors={['#11172a', '#171f37', '#1e2744', '#262f50']} />
      {STARS.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 5 === 0 ? 1.1 : 0.7} fill="#efe6cf" opacity={0.5 + (i % 3) * 0.2} />
      ))}
      <circle cx="244" cy="44" r="14" fill="#f2e6c9" />
      <circle cx="251" cy="39" r="12.5" fill="#11172a" />
      {buildings.map(([x, w, h], i) => (
        <rect key={i} x={x} y={B - h} width={w} height={h} fill={i % 2 ? '#0d101b' : '#121626'} />
      ))}
      {lit.map(([a, b], i) => {
        const [x, w, h] = buildings[Math.floor(a * buildings.length)]!;
        const wx = x + 4 + Math.floor(b * ((w - 10) / 6)) * 6;
        const wy = B - h + 6 + Math.floor(((a * 97) % 1) * ((h - 12) / 8)) * 8;
        return i % 3 === 0 ? null : <rect key={i} x={wx} y={wy} width="3" height="4" fill="#f2c48d" opacity={i % 4 === 0 ? 0.9 : 0.55} />;
      })}
    </>
  );
}

function Sunny() {
  return (
    <>
      <Bands colors={['#86c3dc', '#9dd0e4', '#b6dceb', '#cde8f1']} />
      <circle cx="72" cy="50" r="17" fill="#f6d47e" />
      <g fill="#f6f2ea">
        <circle cx="190" cy="54" r="11" />
        <circle cx="204" cy="48" r="14" />
        <circle cx="220" cy="55" r="10" />
        <rect x="186" y="55" width="40" height="10" rx="5" />
      </g>
      <path d={`M${GLASS.x} 132 Q 90 108 170 128 T ${R} 120 V ${B} H ${GLASS.x} Z`} fill="#9dbd8e" />
      <path d={`M${GLASS.x} 152 Q 120 134 210 150 T ${R} 146 V ${B} H ${GLASS.x} Z`} fill="#7b9c71" />
      <g fill="#5f7f5a">
        <circle cx="64" cy="140" r="11" />
        <circle cx="78" cy="144" r="8" />
        <rect x="68" y="146" width="3" height="12" fill="#6b4a34" />
      </g>
    </>
  );
}

function Snow() {
  return (
    <>
      <Bands colors={['#95a1b1', '#a7b2c1', '#b9c3cf', '#cbd3dc']} />
      <path d={`M${GLASS.x} 130 Q 100 110 180 128 T ${R} 122 V ${B} H ${GLASS.x} Z`} fill="#dfe5eb" />
      <path d={`M${GLASS.x} 154 Q 120 138 220 152 T ${R} 148 V ${B} H ${GLASS.x} Z`} fill="#eef1f4" />
      {[
        [58, 136, 1],
        [80, 140, 0.8],
        [232, 132, 1.1],
        [256, 138, 0.85],
      ].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <path d="M0 -24 L10 0 H-10 Z" fill="#4c605c" />
          <path d="M0 -24 L4 -14 H-4 Z" fill="#eef1f4" />
          <rect x="-1.5" y="0" width="3" height="5" fill="#5a4334" />
        </g>
      ))}
    </>
  );
}

export const SCENES: Record<WindowScene, { label: string; art: () => ReactNode }> = {
  rain: { label: 'Rain', art: Rain },
  dusk: { label: 'Dusk', art: Dusk },
  'night-city': { label: 'Night city', art: NightCity },
  sunny: { label: 'Sunny', art: Sunny },
  snow: { label: 'Snow', art: Snow },
};
