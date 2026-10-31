// Creating projects, scenes, and layers with sensible defaults.

import { createRng, makeId } from '../rng.ts';
import { resolveProgression } from '../theory/progressions.ts';
import { INSTRUMENTS, LAYER_COLORS, type InstrumentId } from './constants.ts';
import { getMood, type MoodId } from './moods.ts';
import { ProjectSchema, type Layer, type Project, type Scene } from './schema.ts';

export interface NewLayerOptions {
  name?: string;
  instrument: InstrumentId;
  color?: string;
  index?: number;
}

export function createLayer({ name, instrument, color, index = 0 }: NewLayerOptions): Layer {
  return {
    id: makeId('l'),
    name: name ?? INSTRUMENTS[instrument].label,
    instrument,
    color: color ?? LAYER_COLORS[index % LAYER_COLORS.length]!,
    volume: 0.8,
    pan: 0,
    muted: false,
    solo: false,
    harmony: 'smart',
    octave: 0,
    kit: 'sticks',
    strokes: [],
  };
}

export function createScene(project: Pick<Project, 'key' | 'mood'>, name: string, bars = 4): Scene {
  const mood = getMood(project.mood ?? 'rainy-study');
  return {
    id: makeId('s'),
    name,
    bars,
    progression: resolveProgression(mood.progression, project.key),
    layers: [createLayer({ instrument: mood.lead, name: 'Melody' })],
    backing: structuredClone(mood.backing),
  };
}

export interface NewProjectOptions {
  name?: string;
  mood?: MoodId;
  seed?: number;
  bars?: number;
}

export function createProject({ name = 'Untitled loop', mood = 'rainy-study', seed, bars = 4 }: NewProjectOptions = {}): Project {
  const preset = getMood(mood);
  const now = new Date().toISOString();
  const base = { key: { ...preset.key }, mood };
  const scene = createScene(base, 'A', bars);
  return {
    format: 'haku',
    version: 1,
    id: makeId('p'),
    name,
    createdAt: now,
    updatedAt: now,
    seed: seed ?? Math.floor(createRng(Date.now())() * 2 ** 31),
    mood,
    window: preset.window,
    key: base.key,
    bpm: preset.bpm,
    swing: preset.swing,
    humanize: 0.5,
    mix: structuredClone(preset.mix),
    scenes: [scene],
    arrangement: [{ sceneId: scene.id, repeat: 1 }],
    activeSceneId: scene.id,
  };
}

/** Validates unknown data (a file, a bridge message) as a project. Throws with a readable message. */
export function parseProject(data: unknown): Project {
  const result = ProjectSchema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0]!;
    throw new Error(`Not a valid Haku project: ${issue.path.join('.') || 'root'}: ${issue.message}`);
  }
  return result.data;
}

export function findScene(project: Project, sceneId?: string): Scene {
  const id = sceneId ?? project.activeSceneId;
  const scene = project.scenes.find((s) => s.id === id || s.name === id);
  if (!scene) throw new Error(`No scene "${id}"`);
  return scene;
}

/** Finds a layer by id or name. Searches the given scene, or the active one. */
export function findLayer(project: Project, layerId?: string, sceneId?: string): { scene: Scene; layer: Layer } {
  const scene = findScene(project, sceneId);
  const layer = layerId
    ? scene.layers.find((l) => l.id === layerId || l.name.toLowerCase() === layerId.toLowerCase())
    : scene.layers.find((l) => INSTRUMENTS[l.instrument].kind === 'tonal') ?? scene.layers[0];
  if (!layer) throw new Error(layerId ? `No layer "${layerId}" in scene ${scene.name}` : `Scene ${scene.name} has no layers`);
  return { scene, layer };
}
