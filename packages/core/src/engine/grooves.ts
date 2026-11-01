// Drum grooves, written as one bar of sixteenth notes per drum.
// X loud, x medium, o soft, g ghost, . rest.
//
// Swing only moves offbeat sixteenths, so a jazz ride's skip note sits on the last sixteenth of the
// beat. That's a hard swing, which suits lofi fine.

import type { DrumKit, DrumPiece, GrooveId } from '../model/constants.ts';

type Pattern = Partial<Record<DrumPiece, string>>;

export interface Groove {
  label: string;
  kit: DrumKit;
  bar: Pattern;
  /** Played instead of `bar` on the last bar of a loop, so the loop breathes before it comes around. */
  turnaround?: Pattern;
  /**
   * How far each piece sits behind the grid, in beats. Applied after swing, so a late kick on an
   * offbeat still swings. This is the groove's own feel and plays even with humanize at zero.
   */
  lag?: Partial<Record<DrumPiece, number>>;
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
    turnaround: {
      kick: 'o.......o.....o.',
      brush: 'g...X..g....XgXg',
      brushhat: 'x...x.o.x...x...',
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
      cabasa: '.g.o.g.o.g.o.g.o',
    },
    // The other half of the clave, so the loop turns over the way a bossa phrase does.
    turnaround: {
      kick: 'x..ox..ox..ox..o',
      rim: '..x..x...x..x...',
      hat: 'o.g.o.g.o.g.o.g.',
      cabasa: '.g.o.g.o.g.o.gxo',
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
    turnaround: {
      kick: 'x.......o.....o.',
      rim: '........o...o...',
      ride: 'o...o...o...o.o.',
    },
  },
  'jazz-ride': {
    label: 'Jazzy ride',
    kit: 'sticks',
    // Spang-a-lang on the ride, a feathered kick, and the hat closing on 2 and 4.
    bar: {
      kick: 'g...g...g...g...',
      ride: 'x...X..ox...X..o',
      hat: '....o.......o...',
      snare: '..........g.....',
    },
    turnaround: {
      kick: 'g...g...g...g...',
      ride: 'x...X..ox...X...',
      hat: '....o.......o...',
      snare: '......g...g..xg.',
    },
  },
  'lazy-kick': {
    label: 'Lazy kick',
    kit: 'sticks',
    // Boom bap with the kick dragging well behind the beat and a shaker instead of hats.
    bar: {
      kick: 'X.....x...X..x..',
      snare: '....X.......X...',
      shaker: 'xgogxgogxgogxgog',
    },
    turnaround: {
      kick: 'X.....x...X.....',
      snare: '....X.......X.gg',
      shaker: 'xgogxgogxgogx...',
      openhat: '..............o.',
    },
    lag: { kick: 0.06, snare: 0.03 },
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

/** Pushes the band's drum hits behind the grid by the groove's lag. Run after swing. */
export function applyGrooveLag(events: { drum?: DrumPiece; track: string; time: number }[], id: GrooveId): void {
  const lag = GROOVES[id].lag;
  if (!lag) return;
  for (const e of events) {
    if (e.track === 'backing:drums' && e.drum) e.time += lag[e.drum] ?? 0;
  }
}
