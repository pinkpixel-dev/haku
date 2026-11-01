# Changelog

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
