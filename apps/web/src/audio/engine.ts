// The browser side of the audio engine: loads the sample bank, keeps one Rig in sync with the
// project, and plays either the active scene on a loop or the whole arrangement. All the sound
// itself lives in @haku/audio.
//
// Tone.Offline (used for WAV export) swaps Tone's global context while it sets up a render, so this
// file holds on to the live context and transport instead of asking Tone for them each time, and
// it holds off rescheduling until an export is done.
//
// Tone.js and @haku/audio are most of the bundle, so they're loaded with a dynamic import in load()
// instead of up front. Only types come in statically here.

import type * as ToneNS from 'tone';
import { beatsToSeconds, buildArrangementScore, buildSceneScore, type Project, type SampleManifest, type Score } from '@haku/core';
import type { PcmAudio, RenderOptions, Rig, SampleBank } from '@haku/audio';

type AudioModule = typeof import('@haku/audio');

export type EngineStatus = { state: 'idle' } | { state: 'loading'; loaded: number; total: number } | { state: 'ready' } | { state: 'error'; message: string };
export type PlayMode = 'loop' | 'song';

export interface Position {
  sceneId: string;
  /** Beats from the start of that scene. */
  beat: number;
}

type Listener = () => void;

class LiveEngine {
  private tone: typeof ToneNS | null = null;
  private audio: AudioModule | null = null;
  private rig: Rig | null = null;
  private bank: SampleBank | null = null;
  private context: ToneNS.BaseContext | null = null;
  private loading: Promise<void> | null = null;
  private project: Project | null = null;
  private score: Score | null = null;
  private scheduledKey = '';
  private exporting = false;
  private listeners = new Set<Listener>();
  status: EngineStatus = { state: 'idle' };
  playing = false;
  mode: PlayMode = 'loop';
  manifest: SampleManifest | null = null;

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

  private get transport() {
    return this.context!.transport;
  }

  /** Loads samples. Safe to call before any user gesture: decoding works on a suspended context. */
  load(): Promise<void> {
    this.loading ??= (async () => {
      try {
        const [tone, audio] = await Promise.all([import('tone'), import('@haku/audio')]);
        this.tone = tone;
        this.audio = audio;
        this.context = tone.getContext();
        const base = import.meta.env.BASE_URL;
        const res = await fetch(`${base}manifest.json`);
        if (!res.ok) throw new Error(`Couldn't load the sample manifest (${res.status})`);
        this.manifest = (await res.json()) as SampleManifest;
        this.setStatus({ state: 'loading', loaded: 0, total: 1 });
        this.bank = await audio.loadSampleBank(this.manifest, audio.browserDecoder(base), (loaded, total) => this.setStatus({ state: 'loading', loaded, total }));
        this.rig = new audio.Rig(this.bank);
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
    if (!rig || this.exporting) return;
    rig.sync(project);

    const score = this.mode === 'song' ? buildArrangementScore(project) : buildSceneScore(project);
    const key = `${this.mode}|${score.bpm}|${score.beats}|${JSON.stringify(score.events)}`;
    this.score = score;
    if (key === this.scheduledKey) return;
    this.scheduledKey = key;

    const transport = this.transport;
    transport.bpm.value = score.bpm;
    transport.loop = true;
    transport.loopStart = 0;
    transport.loopEnd = beatsToSeconds(score.beats, score.bpm);
    rig.schedule(score);
  }

  setMode(mode: PlayMode) {
    if (mode === this.mode) return;
    this.mode = mode;
    // Start the new mode from the top so the playhead doesn't land mid-section.
    if (this.playing) this.transport.position = 0;
    if (this.project) this.update(this.project);
    this.emit();
  }

  async play() {
    // Normally already loaded by the time anyone presses play. If not, the click's user activation
    // is still fresh enough after the load for start() to resume the context.
    await this.load();
    await this.tone?.start();
    if (!this.rig || this.playing || this.exporting) return;
    this.transport.start('+0.05', 0);
    this.rig.master.startAmbience(this.context!.now(), Math.random() * 20);
    this.playing = true;
    this.emit();
  }

  stop() {
    if (!this.rig || !this.playing) return;
    this.transport.stop();
    this.rig.master.stopAmbience(this.context!.now());
    this.playing = false;
    this.emit();
  }

  toggle() {
    return this.playing ? this.stop() : this.play();
  }

  /** Where the playhead is, or null when stopped. In song mode this says which scene is playing. */
  position(): Position | null {
    if (!this.playing || !this.score || this.exporting) return null;
    const beats = Math.max(0, (this.transport.seconds * this.score.bpm) / 60) % this.score.beats;
    const section = this.score.sections.findLast((s) => beats >= s.start) ?? this.score.sections[0];
    if (!section) return null;
    return { sceneId: section.sceneId, beat: beats - section.start };
  }

  /** Renders offline with the same Rig setup. Playback stops while it runs. */
  async render(project: Project, opts: RenderOptions): Promise<PcmAudio> {
    await this.load();
    if (!this.bank || !this.audio) throw new Error("Sounds aren't loaded yet");
    this.stop();
    this.exporting = true;
    this.emit();
    try {
      return await this.audio.renderProject(project, this.bank, opts);
    } finally {
      this.exporting = false;
      this.scheduledKey = '';
      if (this.project) this.update(this.project);
      this.emit();
    }
  }

  get isExporting() {
    return this.exporting;
  }
}

export const engine = new LiveEngine();
