// One line of help per command. The CLI shows these in --help and the MCP server uses them as tool
// descriptions, so they're written for someone (or some model) who has never seen Haku.

import type { CommandType } from './schemas.ts';

export const COMMAND_HELP: Record<CommandType, string> = {
  set_project: 'Rename the project or change tempo, swing, humanize, or the window view.',
  set_key: 'Change the key. Chords follow automatically, since they are stored relative to the tonic.',
  set_mood: 'Apply a mood preset: tempo, key, chords, swing, mix, backing band, and window. Drawn strokes stay.',
  set_progression: 'Set the chords for a scene, from a preset id, roman numerals, or chord symbols.',
  set_backing: 'Change the backing band for a scene: chord instrument and comping style, bass style, drum groove, and their volumes.',
  mix: 'Change the master mix: level, warmth, crackle, reverb, wobble, and rain.',
  add_layer: 'Add a layer to draw on, with its own instrument. Returns the new layer id.',
  update_layer: 'Change a layer: name, instrument, volume, pan, mute, solo, harmony snapping, octave, or drum kit.',
  remove_layer: 'Delete a layer and everything drawn on it.',
  draw_path: 'Draw a freehand stroke from raw points. x is time across the scene (0 to 1), y is pitch (0 is high). Notes snap to the chords.',
  draw_line: 'Draw a straight stroke between two points. A rising line plays a rising melody.',
  draw_curve: 'Draw a smooth curve through a few points. Good for phrases that rise and fall.',
  draw_shape: 'Draw a shape (wave, arc, zigzag, stairs up or down) inside a box. Quick way to get a musical figure.',
  draw_melody: 'Write exact notes by pitch and beat, with no snapping. Use when you know the notes you want.',
  erase: 'Remove strokes from a layer: by stroke id, by a box on the canvas, or all of them.',
  add_scene: 'Add a scene (a section like a verse or a bridge), optionally copied from another. It goes on the end of the arrangement.',
  update_scene: 'Rename a scene or change its length in bars. Strokes stretch to fit.',
  remove_scene: 'Delete a scene and take it out of the arrangement.',
  select_scene: 'Make a scene the active one, which is the default for drawing commands.',
  arrange: 'Set the song order: a list of scenes, each with an optional repeat count.',
  describe: 'Read the project back as text: key, tempo, chords, layers, and a small piano roll of what each layer plays.',
};
