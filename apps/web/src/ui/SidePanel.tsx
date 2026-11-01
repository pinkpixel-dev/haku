// The band (backing chords, bass, drums), the lofi mix, and the ambience (rain and the view out
// the window). The cat sleeps on top.

import { BASS_STYLES, CHORD_INSTRUMENTS, COMP_STYLES, GROOVE_IDS, INSTRUMENTS, RAIN_KINDS, WINDOW_SCENES, type Project, type Scene } from '@haku/core';
import type { Command } from '@haku/protocol';
import { Select, Slider, Switch, titleCase } from './controls.tsx';
import { Cat, Sprig } from './room/art.tsx';
import { SCENES } from './window/scenes.tsx';

interface Props {
  project: Project;
  scene: Scene;
  run: (cmd: Command) => void;
}

const opts = <T extends string>(ids: readonly T[], label: (id: T) => string = titleCase) => ids.map((value) => ({ value, label: label(value) }));

export function SidePanel({ project, scene, run }: Props) {
  const b = scene.backing;
  const m = project.mix;
  const backing = (patch: Omit<Extract<Command, { type: 'set_backing' }>, 'type' | 'scene'>) => run({ type: 'set_backing', scene: scene.id, ...patch });
  const mix = (patch: Omit<Extract<Command, { type: 'mix' }>, 'type'>) => run({ type: 'mix', ...patch });

  return (
    <aside className="side">
      <div className="side__cat">
        <Cat />
      </div>
      <div className="side__scroll">
        <section className="panel" aria-labelledby="band-title">
          <h2 id="band-title" className="panel__title">
            Band <Sprig />
          </h2>

          <div className="band-part">
            <Switch label="Chords" checked={b.chords.enabled} onChange={(enabled) => backing({ chords: { enabled } })} />
            <div className="field-row">
              <Select label="Sound" value={b.chords.instrument} options={opts(CHORD_INSTRUMENTS, (id) => INSTRUMENTS[id].label)} onChange={(instrument) => backing({ chords: { instrument } })} />
              <Select label="Style" value={b.chords.style} options={opts(COMP_STYLES)} onChange={(style) => backing({ chords: { style } })} />
            </div>
            <Slider label="Volume" value={b.chords.volume} onChange={(volume) => backing({ chords: { volume } })} />
          </div>

          <div className="band-part">
            <Switch label="Bass" checked={b.bass.enabled} onChange={(enabled) => backing({ bass: { enabled } })} />
            <Select label="Style" value={b.bass.style} options={opts(BASS_STYLES)} onChange={(style) => backing({ bass: { style } })} />
            <Slider label="Volume" value={b.bass.volume} onChange={(volume) => backing({ bass: { volume } })} />
          </div>

          <div className="band-part">
            <Switch label="Drums" checked={b.drums.enabled} onChange={(enabled) => backing({ drums: { enabled } })} />
            <Select label="Groove" value={b.drums.groove} options={opts(GROOVE_IDS)} onChange={(groove) => backing({ drums: { groove } })} />
            <Slider label="Volume" value={b.drums.volume} onChange={(volume) => backing({ drums: { volume } })} />
          </div>

          <div className="band-part">
            <Slider label="Swing" value={project.swing} onChange={(swing) => run({ type: 'set_project', swing })} />
            <Slider label="Humanize" value={project.humanize} onChange={(humanize) => run({ type: 'set_project', humanize })} />
          </div>
        </section>

        <section className="panel" aria-labelledby="mix-title">
          <h2 id="mix-title" className="panel__title">
            Mix <Sprig />
          </h2>
          <Slider label="Master" value={m.master} onChange={(master) => mix({ master })} />
          <Slider label="Warmth" value={m.warmth} onChange={(warmth) => mix({ warmth })} />
          <Slider label="Crackle" value={m.crackle} onChange={(crackle) => mix({ crackle })} />
          <Slider label="Reverb" value={m.reverb} onChange={(reverb) => mix({ reverb })} />
          <Slider label="Wobble" value={m.wobble} onChange={(wobble) => mix({ wobble })} />
          <div className="band-part" role="group" aria-labelledby="ambience-title">
            <h3 id="ambience-title" className="panel__subtitle">
              Ambience
            </h3>
            <Switch label="Rain" checked={m.rain.enabled} onChange={(enabled) => mix({ rain: { enabled } })} />
            <div className="field-row">
              <Select label="Sound" value={m.rain.kind} options={opts(RAIN_KINDS, (k) => (k === 'roof' ? 'Roof window' : 'Window pane'))} onChange={(kind) => mix({ rain: { kind } })} />
              <Select label="View" value={project.window} options={WINDOW_SCENES.map((w) => ({ value: w, label: SCENES[w].label }))} onChange={(view) => run({ type: 'set_project', window: view })} />
            </div>
            <Slider label="Level" value={m.rain.level} onChange={(level) => mix({ rain: { level } })} />
          </div>
        </section>
      </div>
    </aside>
  );
}
