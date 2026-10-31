# Haku

Draw on a canvas, get a cozy lofi track.

You sketch a line and Haku reads it as a melody: left to right is time, up and down is pitch. Every note gets nudged onto the chords, so whatever you draw fits. Underneath, a little backing band (warm keys, a round bass, brushed drums) follows the progression, and the whole thing gets the usual lofi treatment of swing, vinyl crackle, tape wobble, and rain on the window.

There's also a CLI and an MCP server, so AI agents can draw music with the same tools you use.

> [!NOTE]
> Haku is early. The music engine, the audio engine, and a working web app are done, so you can draw and hear loops right now. The cozy look, saving, the CLI, and the MCP server are still being built. See `DOCS/ROADMAP.md`.

## What it does (so far)

- **Turns strokes into notes.** Pencil for eighth-note melodies, brush for long soft notes, chalk for two-note harmonies, spray for sparkles, stamp for one hit per step.
- **Keeps everything in tune.** Notes on strong beats land on chord tones, and the rest stay in the key. You can also pick plain scale, pentatonic, chord-only, or chromatic snapping per layer.
- **Reads a few gestures.** Tap for a single note, a short vertical line strums the chord, a tight zigzag plays a trill, a quick flick adds a grace note.
- **Plays a backing band.** Voice-led jazzy chords (7ths, 9ths, 13ths), roots, walking, or dub bass, and five drum grooves from dusty boom bap to lazy bossa.
- **Comes with moods.** Rainy study, late-night train, sunny café, dusk walk, and snowy window. Each one sets the tempo, key, chords, band, and mix.
- **Sounds like lofi.** Sampled upright piano, Wurlitzer, glock, marimba, and harp, synth keys, pads, plucks, and bass, and a real drum kit, all run through tape warmth, wobble, reverb, vinyl crackle, and rain.
- **Exports MIDI** with a track per layer, and renders WAV offline (the browser and Node use the same audio code, so they sound the same).

## Running it

You'll need Node 22.18 or newer and pnpm. Rebuilding the samples also needs ffmpeg with libvorbis.

```bash
pnpm install
pnpm --filter @haku/web dev
```

Then open http://localhost:5178, draw on the canvas, and press play (or Space). The number keys 1 to 5 pick brushes and E switches to the eraser. Right now a reload starts a fresh loop, since saving isn't in yet.

To run the tests and typecheck everything:

```bash
pnpm test
pnpm typecheck
```

`pnpm render` renders every mood with a little demo melody to `./renders` and prints the peak, RMS, and loudness of each. It's mostly there for tuning the mix. Add `--mood sunny-cafe` for just one, or `--project path/to/project.json` to render a saved project.

The processed samples are already in `assets/samples/`. To rebuild them from the original recordings:

```bash
pnpm samples:fetch   # downloads about 400 MB into assets/sources/
pnpm samples:build   # makes assets/samples/ again
```

The two rain recordings come from Freesound, which needs a login, so those get downloaded by hand. `DOCS/SPIKES.md` has the exact files and where they go.

## Using the engine from code

Everything goes through commands, which is also how the CLI and MCP server will work:

```ts
import { createProject, buildSceneScore, describeProject } from '@haku/core';
import { execute } from '@haku/protocol';

let project = createProject({ mood: 'rainy-study' });
project = execute(project, {
  type: 'draw_curve',
  points: [{ x: 0, y: 0.6 }, { x: 0.3, y: 0.3 }, { x: 0.6, y: 0.5 }, { x: 1, y: 0.4 }],
}).project;

console.log(describeProject(project)); // chords, layers, and a little piano roll
const score = buildSceneScore(project); // every note, in beats
```

The canvas is 0 to 1 on both axes. x spans the whole scene and y = 0 is the top (the highest notes).

## Credits

The sounds come from VSCO 2 CE, Big Rusty Drums, Greg Sullivan's Wurlitzer EP200, and two rain recordings from Freesound. The Wurlitzer is CC-BY 3.0, and everything else is CC0. Full details are in `DOCS/CREDITS.md`.

## License

Apache 2.0. See `LICENSE`.

---

Made with 💖 by [Pink Pixel](https://pinkpixel.dev)
