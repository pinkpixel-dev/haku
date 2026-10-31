// Drum grooves, written as one bar of sixteenth notes per drum.
// X loud, x medium, o soft, g ghost, . rest.

import type { DrumKit, DrumPiece, GrooveId } from '../model/constants.ts';

type Pattern = Partial<Record<DrumPiece, string>>;

export interface Groove {
  label: string;
  kit: DrumKit;
  bar: Pattern;
  /** Played instead of `bar` on the last bar of a loop, so the loop breathes before it comes around. */
  turnaround?: Pattern;
}

export const GROOVES: Record<GrooveId, Groove> = {
  dusty: {
    label: 'Dusty boom bap',
    kit: 'sticks',
    bar: {
      kick: 'X......x..X.....',
      snare: '....X.......X...',
      hat: 'x.o.x.o.x.ogx.o.',
    },
    turnaround: {
      kick: 'X......x..X..x..',
      snare: '....X.......X.g.',
      hat: 'x.o.x.o.x.ogx...',
      openhat: '..............o.',
    },
  },
  brushes: {
    label: 'Brushes',
    kit: 'brushes',
    bar: {
      kick: 'o.......o.......',
      brush: 'g...X..g....X.g.',
      brushhat: 'x...x.o.x...x.o.',
    },
  },
  halftime: {
    label: 'Half-time',
    kit: 'sticks',
    bar: {
      kick: 'X.........x.....',
      snare: '........X.......',
      hat: 'x.o.x.o.x.o.x.o.',
    },
    turnaround: {
      kick: 'X.........x..o..',
      snare: '........X.....g.',
      hat: 'x.o.x.o.x.o.x...',
      openhat: '..............o.',
    },
  },
  bossa: {
    label: 'Lazy bossa',
    kit: 'sticks',
    bar: {
      kick: 'x..ox..ox..ox..o',
      rim: 'x..x..x...x..x..',
      hat: 'o.g.o.g.o.g.o.g.',
    },
  },
  sparse: {
    label: 'Sparse',
    kit: 'sticks',
    bar: {
      kick: 'x.......o.......',
      rim: '........o.......',
      ride: 'o...o...o...o...',
    },
  },
};

const LEVELS: Record<string, number> = { X: 0.95, x: 0.72, o: 0.5, g: 0.28 };

export interface DrumHit {
  /** Beat within the bar. */
  beat: number;
  piece: DrumPiece;
  velocity: number;
}

export function grooveBar(id: GrooveId, turnaround: boolean): DrumHit[] {
  const groove = GROOVES[id];
  const pattern = turnaround && groove.turnaround ? groove.turnaround : groove.bar;
  const hits: DrumHit[] = [];
  for (const [piece, steps] of Object.entries(pattern) as [DrumPiece, string][]) {
    for (let i = 0; i < steps.length; i++) {
      const v = LEVELS[steps[i]!];
      if (v !== undefined) hits.push({ beat: i / 4, piece, velocity: v });
    }
  }
  return hits.sort((a, b) => a.beat - b.beat);
}
