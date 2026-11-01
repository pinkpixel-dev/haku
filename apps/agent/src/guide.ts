// The short orientation an agent gets when it connects (MCP server instructions, and `haku guide`).

import { MOOD_IDS, PROGRESSIONS } from '@haku/core';

const presets = Object.entries(PROGRESSIONS)
  .map(([id, p]) => `${id} (${p.text})`)
  .join(', ');

export const GUIDE = `Haku turns strokes on a canvas into lofi music. A backing band (chords, bass, drums) plays along, and drawn notes snap to the chords.

Where the work happens:
- With no file argument, tools act on the project open in the Haku browser tab, live. Changes show up there and land in its undo history. If no tab is open, Haku starts its local app server and opens one in the browser.
- With file set to a .haku.json path, tools read and write that file instead. new_project makes one.

The canvas:
- x is time: 0 is the start of the scene, 1 is the end. A scene is 1 to 16 bars of 4 beats.
- y is pitch: 0 is the top of the layer's range (high), 1 is the bottom (low). Drum layers use 7 rows instead, bottom to top: kick, tom, snare, side stick, hi-hat, open hat, ride.
- Brushes set the rhythm grid: pencil (eighths), brush (quarters, soft), chalk (eighths, two-note harmonies), spray (scattered sixteenths), stamp (one hit per sixteenth, good for drums).
- Faster strokes (lower duration_ms) play louder. draw_melody skips snapping when you want exact notes.

A good loop:
1. describe to see what's there. set_mood picks a whole vibe in one go: ${MOOD_IDS.join(', ')}.
2. add_layer for each part (piano, wurli, fm-ep, glock, vibes, marimba, kalimba, harp, guitar, pad, pluck, bass, drums).
3. Draw with draw_shape, draw_curve, or draw_line. Use batch to send many commands as one step.
4. Check your work: describe (text piano roll), snapshot (a picture), analyze (chord fit, clashes, loudness).
5. play to listen, export for WAV, MIDI, or the project file.

Chord progressions take a preset id or chords like "ii9 V13 Imaj9 vi9" (":N" sets beats per chord). Presets: ${presets}.

Scenes and layers can be named by id or by name.`;
