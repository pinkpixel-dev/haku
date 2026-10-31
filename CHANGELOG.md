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
