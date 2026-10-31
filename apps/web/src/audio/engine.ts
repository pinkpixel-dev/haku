// The browser side of the audio engine: loads the sample bank, keeps one Rig in sync with the
// project, and loops the active scene on Tone's transport. All the sound itself lives in @haku/audio.

import * as Tone from 'tone';
import { beatsToSeconds, buildSceneScore, type Project, type SampleManifest, type Score } from '@haku/core';
import { browserDecoder, loadSampleBank, Rig } from '@haku/audio';

export type EngineStatus = { state: 'idle' } | { state: 'loading'; loaded: number; total: number } | { state: 'ready' } | { state: 'error'; message: string };

type Listener = () => void;

class LiveEngine {
  private rig: Rig | null = null;
  private loading: Promise<void> | null = null;
  private project: Project | null = null;
  private score: Score | null = null;
  private scheduledKey = '';
  private listeners = new Set<Listener>();
  status: EngineStatus = { state: 'idle' };
  playing = false;

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  private setStatus(status: EngineStatus) {
    this.status = status;
    this.emit();
  }

  /** Loads samples. Safe to call before any user gesture: decoding works on a suspended context. */
  load(): Promise<void> {
    this.loading ??= (async () => {
      try {
        const base = import.meta.env.BASE_URL;
        const res = await fetch(`${base}manifest.json`);
        if (!res.ok) throw new Error(`Couldn't load the sample manifest (${res.status})`);
        const manifest = (await res.json()) as SampleManifest;
        this.setStatus({ state: 'loading', loaded: 0, total: 1 });
        const bank = await loadSampleBank(manifest, browserDecoder(base), (loaded, total) => this.setStatus({ state: 'loading', loaded, total }));
        this.rig = new Rig(bank);
        await this.rig.ready;
        this.setStatus({ state: 'ready' });
        if (this.project) this.update(this.project);
      } catch (err) {
        this.loading = null;
        this.setStatus({ state: 'error', message: err instanceof Error ? err.message : String(err) });
      }
    })();
    return this.loading;
  }

  /** Call on every project change. Mix and volume changes apply instantly; notes reschedule only when the score changes. */
  update(project: Project) {
    this.project = project;
    const rig = this.rig;
    if (!rig) return;
    rig.sync(project);

    const score = buildSceneScore(project);
    const key = `${score.bpm}|${score.beats}|${JSON.stringify(score.events)}`;
    this.score = score;
    if (key === this.scheduledKey) return;
    this.scheduledKey = key;

    const transport = Tone.getTransport();
    transport.bpm.value = score.bpm;
    transport.loop = true;
    transport.loopStart = 0;
    transport.loopEnd = beatsToSeconds(score.beats, score.bpm);
    rig.schedule(score);
  }

  async play() {
    await Tone.start();
    await this.load();
    if (!this.rig || this.playing) return;
    const transport = Tone.getTransport();
    transport.start('+0.05', 0);
    this.rig.master.startAmbience(Tone.now(), Math.random() * 20);
    this.playing = true;
    this.emit();
  }

  stop() {
    if (!this.rig || !this.playing) return;
    Tone.getTransport().stop();
    this.rig.master.stopAmbience(Tone.now());
    this.playing = false;
    this.emit();
  }

  toggle() {
    return this.playing ? this.stop() : this.play();
  }

  /** Playhead position in beats from the start of the scene, or null when stopped. */
  beat(): number | null {
    if (!this.playing || !this.score) return null;
    const transport = Tone.getTransport();
    const seconds = transport.seconds;
    if (seconds < 0) return 0;
    return ((seconds * this.score.bpm) / 60) % this.score.beats;
  }
}

export const engine = new LiveEngine();
