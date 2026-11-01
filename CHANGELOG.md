# Changelog

## Unreleased

### 🎵 Playback
- New Follow toggle next to Loop and Song. During Song playback the canvas switches to whichever scene is playing. Pick a different scene yourself and Follow turns off, so you don't get pulled back mid-edit. It's remembered between visits

### 🖼️ Snapshots
- `snapshot` takes `scope: song` (`--scope song` in the CLI) for a picture of the whole arrangement: the song order across the top, then each scene's chords and notes on the same time scale. Scenes that aren't in the song get named in the reply

### 🥁 Grooves
- Two new grooves. Jazzy ride has a spang-a-lang ride, a feathered kick, and the hat on 2 and 4. Lazy kick is boom bap with the kick dragging behind the beat and a shaker instead of hats
- Brushes, bossa, and sparse now have turnaround bars like the others, so loops breathe before they come around
- The bossa picked up a cabasa
- New shaker and cabasa samples from the Versilian Community Sample Library (CC0), credited in the app

### 🎻 Instruments
- Three new sampled instruments for your layers: vibraphone (soft mallets), kalimba, and nylon guitar
- The kalimba is a Tanzanian mbira that isn't tuned to equal temperament, so every tine was measured and retuned to the nearest note to sit in tune with the band
- Vibraphone and kalimba come from the Versilian Community Sample Library, and the guitar from FreePats. All three are CC0 and credited in the app

### 🎹 Comping
- Rolled: each chord rolls up slowly from the bottom, with a softer roll halfway through the bar
- Shells: rootless voicings on the Charleston rhythm, leaving the root to the bass the way a jazz pianist would

### ⚡ Loading
- Tone.js and the audio engine now load in their own chunk after the page is up, so the main bundle dropped from about 730 kB to about 460 kB

## 0.3.0 - October 31, 2026

### 🌐 haku web
- New `haku web` command that serves the Haku app on http://127.0.0.1:5177 and opens it in your browser. The npm package now includes the web app, so you don't need to clone the repo to draw
- When an agent or CLI command needs the Haku tab and none is open, Haku starts `haku web` in the background and opens the browser for you. The background server quits after 30 minutes with no tab connected. Set `HAKU_NO_LAUNCH=1` to get the old "No Haku tab is connected" error instead
- `HAKU_WEB_PORT` changes the port. Projects are saved per address, so a different port starts with an empty project list

### 📦 Installable app
- Haku can be installed as an app from Chrome or Edge. It gets its own window and icon
- The app and all samples are cached after the first visit, so the installed app opens even when `haku web` isn't running

### 🏷️ Versioning
- Bumped to 0.3.0, and `@pinkpixel/haku` to 0.2.0

## 0.2.1 - October 31, 2026

### 🎛️ Layers
- Adding a layer is now a full-width "Add layer" button that opens an instrument picker, instead of a small + next to a dropdown
- The Layers panel is wider and roomier, with more space between layers and their settings

### 🎵 Snapping
- Smart harmony now follows chords that borrow notes from outside the key. Over E7 in A minor, offbeat notes use G# and skip G, instead of mixing both. This fixes the sour notes over chords like the `V7b9` in Late night and the `iv6` in Snowfall and Sunday walk, and over any major-key progression used in a minor key. Existing strokes may snap a little differently under those chords

### 🔍 Analyze
- Clashes now only count notes a minor 2nd or minor 9th apart. Notes two octaves apart and major 7ths no longer show up as clashes
- "Out of key" no longer counts notes that belong to the chord playing underneath

### 🐛 Fixes
- WAV exports and `analyze` no longer fail with "Attempting to connect nodes from different contexts" when two renders run at the same time, like when an agent calls `analyze` and `export` together. Renders now wait their turn

### 🏷️ Versioning
- Bumped to 0.2.1

## 0.2.0 - October 31, 2026

### 🏡 Cozy room
- The app now sits inside a little study: plank walls, beams, a hanging lantern, vines down both sides, and a desk with books, a mug, a pinned photo, sheet music, and petals
- The window moved out of the side panel and became a wide six-pane window across the top, with the same weather as before
- A ginger cat naps on top of the Band panel
- The top bar, toolbar, panels, and canvas sit in carved wood frames, with little leaf sprigs on the panel titles
- The status bar is now a small plaque on the desk

### 🎨 Canvas
- Notes are rounded pills with a light highlight, and other layers show a bit stronger than before
- Strokes are drawn as smooth curves, with beads along the active layer's strokes
- The chord strip is lighter, so the chord names sit right on the grid

### 🎛️ Controls
- The view outside the window now lives under Ambience in the Mix panel, next to the rain settings
- Band and Mix are tighter so more fits on screen

### 🏷️ Versioning
- Bumped to 0.2.0

## 0.1.0 - October 31, 2026

### 🎼 Music engine
- Turn drawn strokes into notes, with x as time and y as pitch, read on each brush's grid
- Snap notes to the harmony: chord tones on strong beats, scale tones elsewhere, no clashing avoid notes
- Five brushes (pencil, brush, chalk, spray, stamp) and drum layers with a row per drum
- Gestures for taps, strums, trills, and grace-note flicks
- Velocity from pen pressure or drawing speed
- Roman numeral and chord symbol progressions, with ten presets
- Backing band with voice-led chords, four comping styles, three bass styles, and five drum grooves
- Swing and seeded humanize, so a project plays the same way every time
- Five moods: rainy study, late-night train, sunny café, dusk walk, snowy window
- MIDI export with a track per part
- Text descriptions of a project, including a small piano roll per layer

### 🧩 Protocol
- One command set for every change to a project, validated with zod, with a readable message for each result

### 🎹 Samples
- Upright piano, Wurlitzer, glockenspiel, marimba, harp, a drum kit, and two seamless rain loops (7.7 MB)
- Scripts to download the original recordings and rebuild the sample set

### 🔊 Audio engine
- Plays every instrument: the sampled ones with velocity layers, plus FM keys, a warm pad, a soft pluck, and a round bass built from Tone.js synths
- Drum kit with velocity layers and round robins
- Shared lofi chain with tape saturation and a warmth low-pass, wobble, reverb, bus compression, and a limiter
- Generated vinyl crackle and hiss, plus the rain loops, mixed in after the compressor so they never pump
- Brush size sets how bright a note sounds
- Offline rendering to WAV, using the same audio graph in the browser and in Node
- First pass at mix balance: every mood lands around -13 LUFS with peaks under -1 dBFS

### 🖌️ Web app
- Drawing canvas with a chord strip, beat grid, the notes each layer plays, and a moving playhead
- Pen pressure, mouse, and touch drawing, plus a box eraser
- Layers with mute, solo, volume, pan, instrument, harmony mode, octave, and drum kit
- Band controls for chords, bass, and drums, plus swing and humanize
- Mix controls for master, warmth, crackle, reverb, wobble, and rain
- Tempo, key, chords, bars, and mood in the top bar
- Keyboard shortcuts: Space plays and stops, 1 to 5 pick brushes, E toggles the eraser

### 💾 Projects
- Projects save on their own to the browser's IndexedDB, and the last one you had open comes back on reload
- Projects dialog to open, delete, or start a new loop from a mood
- Save a project as a `.haku.json` file and import it again (imports get their own id, so nothing gets overwritten)
- Undo and redo for every change, with slider drags merged into one step (Ctrl+Z, Ctrl+Shift+Z or Ctrl+Y)

### 🎞️ Scenes and song
- Scene tabs under the canvas, with new, duplicate, rename, and remove
- Arrangement strip: add scenes to the song, reorder them, and set how many times each one plays
- Loop and Song playback modes. In Song mode the playing scene's chip lights up, and the canvas shows the playhead while that scene is on screen

### 📤 Export
- WAV export of the current scene (played twice) or the whole song, rendered in the browser
- MIDI export of the scene or the whole song

### 📜 Credits
- Credits dialog listing every sound source with its license, plus the libraries and fonts Haku uses

### 🪟 Window and moods
- A window at the top of the right column showing the view outside: rain, dusk, night city, sunny, or snow, drawn as flat cel-shaded scenes with a wooden frame, a hanging vine, and a potted plant
- Moving weather on the glass: rain streaks, snow, drifting petals, and twinkling stars, plus droplets sliding down whenever the rain sound is on
- The weather speeds up while music plays, and the plant sways once per bar (both stay still with reduced motion turned on)
- A mood picker with a little window for each mood, plus its key and tempo. Works with arrow keys, Enter, and Escape

### 🎨 Look
- Warmer walnut tones taken from the Haku icon, a faint grain on the panels, and Fraunces for panel titles
- Under 1400px wide, the key, chords, bars, and mood controls move to a second row of the top bar instead of getting squeezed

### 🤖 Agents
- `haku` CLI and MCP server with a tool for every command, plus `new_project`, `open_project`, `save_project`, `batch`, `play`, `stop`, `snapshot`, `analyze`, `export`, and `status`
- Work on a `.haku.json` file, or live on the open Haku tab through a localhost bridge (the MCP server hosts it, or run `haku bridge`)
- Agent changes in the tab go through undo like your own, and a batch of commands undoes in one step
- Snapshots of a scene as a PNG (chords, notes, strokes, and a legend), so agents that can see images can check their work
- Analysis of chord fit, notes outside the key, clashes between layers, and loudness in LUFS from an offline render
- Offline playback through the system's audio player when no tab is connected
- `haku exec` runs a file of commands (or stdin) as one all-or-nothing step
- "Agent connected" toggle in the status bar to switch the browser link on or off
- The CLI and MCP server are on npm as `@pinkpixel/haku`, with the samples, fonts, license, and credits included

### 🧰 Tooling
- `pnpm render` renders each mood (or a saved project) to WAV and prints peak, RMS, and LUFS
- `pnpm haku` runs the CLI from source, and `pnpm build:agent` bundles it for npm with the samples included
