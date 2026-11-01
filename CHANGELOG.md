# Changelog

## 0.1.0 - Unreleased

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

### 🧰 Tooling
- `pnpm render` renders each mood (or a saved project) to WAV and prints peak, RMS, and LUFS
