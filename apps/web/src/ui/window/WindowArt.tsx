// The window itself: the scene outside, a wooden frame and sill, a potted plant, and a vine
// hanging in from the corner (both borrowed from the Haku icon). The plant sways in time with the
// music while it plays.

import { useId, type CSSProperties } from 'react';
import type { WindowScene } from '@haku/core';
import { GLASS, SCENES } from './scenes.tsx';

interface Props {
  scene: WindowScene;
  /** Seconds per sway cycle. Leave out for a still picture (thumbnails). */
  swaySeconds?: number;
  swaying?: boolean;
  className?: string;
}

const WOOD = '#5c3f2c';
const WOOD_LIGHT = '#7a5640';
const WOOD_DARK = '#3f2a1e';
const LEAF = '#8fae8b';
const LEAF_SHADE = '#6c8c6a';

function Leaf({ x, y, r, flip = false, s = 1 }: { x: number; y: number; r: number; flip?: boolean; s?: number }) {
  // A pothos-ish leaf: one flat shape plus a darker half for the cel shading.
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${flip ? -s : s} ${s})`}>
      <path d="M0 0 C 6 -6 14 -4 15 4 C 14 10 6 13 0 0 Z" fill={LEAF} />
      <path d="M0 0 C 6 4 10 8 15 4 C 14 10 6 13 0 0 Z" fill={LEAF_SHADE} />
    </g>
  );
}

export function WindowArt({ scene, swaySeconds, swaying = false, className = '' }: Props) {
  const id = useId();
  const Art = SCENES[scene].art;
  const sway = swaySeconds ? ({ '--sway-duration': `${swaySeconds}s` } as CSSProperties) : undefined;

  return (
    <svg viewBox="0 0 320 206" className={`window-art ${className}`} role="img" aria-label={`Window view: ${SCENES[scene].label}`}>
      <defs>
        <clipPath id={`${id}-glass`}>
          <rect x={GLASS.x} y={GLASS.y} width={GLASS.w} height={GLASS.h} />
        </clipPath>
      </defs>

      {/* Wall around the window. */}
      <rect width="320" height="206" fill="#2a1f19" />

      <g clipPath={`url(#${id}-glass)`}>
        <Art />
        {/* Two soft streaks of reflection on the glass. */}
        <path d={`M${GLASS.x + 30} ${GLASS.y} h22 l-60 ${GLASS.h} h-22 Z`} fill="#fff" opacity="0.05" />
        <path d={`M${GLASS.x + 200} ${GLASS.y} h10 l-60 ${GLASS.h} h-10 Z`} fill="#fff" opacity="0.04" />
      </g>

      {/* Frame, mullions, and sill, each with a lighter top edge. */}
      <path fillRule="evenodd" fill={WOOD} d={`M4 2 H316 V188 H4 Z M${GLASS.x} ${GLASS.y} V${GLASS.y + GLASS.h} H${GLASS.x + GLASS.w} V${GLASS.y} Z`} />
      <rect x="4" y="2" width="312" height="3" fill={WOOD_LIGHT} />
      <rect x="157" y={GLASS.y} width="6" height={GLASS.h} fill={WOOD} />
      <rect x="157" y={GLASS.y} width="2" height={GLASS.h} fill={WOOD_LIGHT} />
      <rect x={GLASS.x} y="88" width={GLASS.w} height="6" fill={WOOD} />
      <rect x={GLASS.x} y="88" width={GLASS.w} height="2" fill={WOOD_LIGHT} />
      <rect x="0" y="184" width="320" height="14" rx="2" fill={WOOD_LIGHT} />
      <rect x="0" y="188" width="320" height="10" fill={WOOD} />
      <rect x="6" y="198" width="308" height="6" fill={WOOD_DARK} />

      {/* Vine hanging in from the top left corner. */}
      <g className="window-art__vine">
        <path d="M2 4 C 22 20 18 44 30 62 S 40 96 34 118" stroke="#5d6f4f" strokeWidth="2" fill="none" />
        <Leaf x={8} y={10} r={40} />
        <Leaf x={20} y={30} r={100} flip />
        <Leaf x={24} y={52} r={50} s={1.1} />
        <Leaf x={34} y={74} r={120} flip />
        <Leaf x={36} y={96} r={70} s={0.9} />
        <Leaf x={33} y={114} r={110} flip s={0.8} />
      </g>

      {/* Potted plant on the sill. */}
      <g className={`window-art__plant ${swaying ? 'is-swaying' : ''}`} style={sway}>
        <path d="M262 166 C 258 154 250 146 244 140 M268 166 C 268 150 266 138 262 126 M273 166 C 276 152 284 144 292 140 M266 166 C 262 158 256 156 250 156 M270 166 C 274 158 280 154 288 154" stroke="#5d6f4f" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <Leaf x={244} y={140} r={-150} s={1.15} />
        <Leaf x={262} y={126} r={-105} s={1.25} flip />
        <Leaf x={262} y={128} r={-70} s={1.1} />
        <Leaf x={292} y={140} r={-30} s={1.15} />
        <Leaf x={250} y={156} r={-170} s={1} flip />
        <Leaf x={288} y={154} r={-10} s={1} />
      </g>
      <path d="M246 166 H290 L285 188 H251 Z" fill="#b8674f" />
      <path d="M268 166 H290 L285 188 H268 Z" fill="#9a5543" />
      <rect x="243" y="163" width="50" height="6" rx="1.5" fill="#c97a60" />
    </svg>
  );
}
