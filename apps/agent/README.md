# @pinkpixel/haku

Draw lofi music from your terminal, or let an AI agent do it.

This is the CLI and MCP server for [Haku](https://github.com/pinkpixel-dev/haku), a little app that turns lines on a canvas into cozy lofi tracks. Left to right is time, up and down is pitch, and every note gets nudged onto the chords, so whatever you draw fits. A backing band (warm keys, round bass, brushed drums) plays along underneath, with swing, vinyl crackle, tape wobble, and rain.

The `haku` command gives you (or your agent) a tool for every drawing command, plus snapshots, analysis, playback, and WAV or MIDI export. Projects are plain `.haku.json` files, and everything renders offline in Node with the same audio code the web app uses.

## Requirements

- Node 22.18 or newer
- For listening without the browser: one of `pw-play`, `paplay`, `aplay`, `afplay`, or `ffplay` (Windows uses PowerShell, so nothing extra there)

The package is about 7 MB, mostly because the instrument samples come with it.

## Install

Run it without installing:

```bash
npx @pinkpixel/haku --help
```

Or install it globally to get the `haku` command:

```bash
npm install -g @pinkpixel/haku
haku guide
```

## Using it with an AI agent

The MCP server runs over stdio. In Claude Code:

```bash
claude mcp add haku -- npx -y @pinkpixel/haku mcp
```

For clients that use a JSON config:

```json
{
  "mcpServers": {
    "haku": {
      "command": "npx",
      "args": ["-y", "@pinkpixel/haku", "mcp"]
    }
  }
}
```

The agent gets a short guide to the canvas and moods when it connects, and every tool has its own schema. Relative file paths resolve from wherever your client starts the server, so absolute paths are the safer bet.

## A quick session

Commands use kebab-case (`draw-shape`), and the snake_case names the MCP tools use work too. Objects and lists go in as JSON.

```bash
haku new-project -f lofi.haku.json --mood rainy-study --name "First try"
haku draw-shape -f lofi.haku.json --shape wave --x 0 --y 0.5 --width 1 --height 0.4 --cycles 2
haku add-layer -f lofi.haku.json --instrument glock --name Sparkle
haku draw-line -f lofi.haku.json --layer Sparkle --brush spray --from '{"x":0.5,"y":0.3}' --to '{"x":1,"y":0.6}'
haku describe -f lofi.haku.json
haku snapshot -f lofi.haku.json --out lofi.png
haku play -f lofi.haku.json
haku export -f lofi.haku.json --format wav
```

Set `HAKU_PROJECT=lofi.haku.json` and you can skip the `-f` every time.

`haku exec` runs a file of commands (a JSON array, or one JSON object per line) as one step. If any of them fails, nothing changes. Leave out the file and it reads stdin:

```bash
haku exec -f lofi.haku.json moves.jsonl
```

## The canvas

- x is time. 0 is the start of the scene and 1 is the end. A scene is 1 to 16 bars of 4 beats.
- y is pitch. 0 is the top of the layer's range (the high notes) and 1 is the bottom. Drum layers split it into 7 rows instead: kick, tom, snare, side stick, hi-hat, open hat, and ride, from the bottom up.
- Brushes set the rhythm: pencil plays eighth notes, brush plays long soft quarters, chalk adds two-note harmonies, spray scatters sixteenths, and stamp hits every sixteenth (good for drums).
- Faster strokes play louder. `draw-melody` skips the snapping when you want exact notes.
- Moods set the tempo, key, chords, band, and mix in one go: `rainy-study`, `late-night-train`, `sunny-cafe`, `dusk-walk`, and `snowy-window`.

`haku guide` prints all of this plus the chord progression presets.

## Tools

Every drawing and editing command is its own tool (`draw_line`, `set_mood`, `add_scene`, and so on). `haku --help` lists them all. These are the extras:

| Tool | What it does |
|---|---|
| `new_project` | Makes a new `.haku.json` from a mood |
| `batch` | Runs a list of commands as one step. All or nothing |
| `describe` | Reads the project back as text, with a little piano roll per layer |
| `snapshot` | A PNG of a scene: chords, notes, strokes, and a legend. `--out` saves it as `.png` or `.svg` |
| `analyze` | Notes per layer, how many strong-beat notes are chord tones, notes outside the key, half-step clashes between layers, and loudness in LUFS |
| `play` / `stop` | Renders the scene (or the whole song) and plays it through your speakers |
| `export` | WAV, MIDI, or the project file, for one scene or the whole song |
| `open_project` / `save_project` | Sends a file to the Haku browser tab, or saves the tab's project to a file |
| `status` | Whether the bridge is running and what the tab is doing |

## Working live in the browser

Haku also has a web app with the actual drawing canvas. When it's open, leave out `-f` and the tools work on that tab instead of a file, so you see and hear every change, and Ctrl+Z still undoes it. The MCP server hosts a small bridge on `127.0.0.1:5179` for this, and the tab connects on its own. Without an MCP server, run `haku bridge` in another terminal.

Right now the web app isn't hosted anywhere, so live mode means running it from the repo:

```bash
git clone https://github.com/pinkpixel-dev/haku.git
cd haku
pnpm install
pnpm --filter @haku/web dev
```

Then open http://localhost:5178. A few things to know:

- Browsers won't let a page make sound until you've clicked in it once. If `play` says so, click anywhere in the tab and try again.
- With more than one Haku tab open, tools drive the one you clicked into most recently.
- The bridge only accepts tabs from `localhost` pages and only accepts tools from outside the browser. `HAKU_ALLOW_ORIGINS` (comma separated) adds other page origins, and `HAKU_BRIDGE_PORT` changes the port.

## Environment variables

| Variable | What it does |
|---|---|
| `HAKU_PROJECT` | Default project file for commands that take `-f` |
| `HAKU_BRIDGE_PORT` | Bridge port. Default `5179` |
| `HAKU_ALLOW_ORIGINS` | Extra page origins allowed to connect as a Haku tab |
| `HAKU_SAMPLES` | Use a different sample folder (one with a `manifest.json`) |

## Credits

Haku's code is Apache 2.0 (see `dist/LICENSE`). The bundled samples are edited versions of the originals: trimmed, shortened, faded, level-adjusted, and re-encoded to Ogg Vorbis. The Wurlitzer also has its sfz mapping's tuning and level fixes baked in, and the rain recordings are cut into seamless loops.

| Sound | Source | Author | License |
|---|---|---|---|
| Upright piano | [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE) | Simon Dalzell of Ivy Audio, distributed by Versilian Studios | CC0 1.0 |
| Glockenspiel, marimba, harp | [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE) | Versilian Studios | CC0 1.0 |
| Wurlitzer EP200 | [Greg Sullivan's E-Pianos](https://github.com/sfzinstruments/GregSullivan.E-Pianos) | [Greg Sullivan](http://www.sullivang.net/), sfz mapping by kinwie | [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/) |
| Drums | [Big Rusty Drums](https://github.com/sfzinstruments/karoryfer.big-rusty-drums) | Karoryfer Samples | CC0 1.0 |
| Rain on the roof | [Soft rain on roof window](https://freesound.org/people/Metadex/sounds/235827/) | Metadex | CC0 1.0 |
| Rain on the window | [January rain on a window](https://freesound.org/people/mmorgaine/sounds/333510/) | mmorgaine | CC0 1.0 |

Snapshots use [Figtree](https://github.com/erikdkennedy/figtree) by Erik Kennedy, under the SIL Open Font License 1.1 (`dist/fonts/OFL.txt`).

---

Made with 💖 by [Pink Pixel](https://pinkpixel.dev)
