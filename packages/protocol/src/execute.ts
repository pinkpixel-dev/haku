// Applies commands to projects. Pure: the input project is never mutated, and every result says
// in a sentence what changed, which is what the CLI prints and what agents read back.

import {
  createLayer,
  createScene,
  describeProject,
  findLayer,
  findScene,
  getMood,
  INSTRUMENTS,
  keyLabel,
  makeId,
  progressionText,
  resolveProgression,
  type Project,
} from '@haku/core';
import { drawMelody, drawStroke, erase } from './draw.ts';
import { CommandSchema, READ_ONLY_COMMANDS, type Command } from './schemas.ts';

export interface ExecResult {
  project: Project;
  message: string;
  data?: unknown;
}

/** Copies only the keys that were actually given. */
function assignDefined<T extends object>(target: T, patch: Partial<T>): string[] {
  const changed: string[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    (target as Record<string, unknown>)[k] = v;
    changed.push(k);
  }
  return changed;
}

const listChanges = (changed: string[]) => (changed.length ? changed.join(', ') : 'nothing');

/** Validates unknown input (from JSON, the bridge, or an agent) and runs it. */
export function executeUnknown(project: Project, input: unknown): ExecResult {
  const parsed = CommandSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    throw new Error(`Bad command: ${issue.path.join('.') || 'command'}: ${issue.message}`);
  }
  return execute(project, parsed.data);
}

export function execute(input: Project, cmd: Command): ExecResult {
  const project = structuredClone(input);
  const result = run(project, cmd);
  if (!READ_ONLY_COMMANDS.includes(cmd.type)) result.project.updatedAt = new Date().toISOString();
  return result;
}

function run(project: Project, cmd: Command): ExecResult {
  switch (cmd.type) {
    case 'set_project': {
      const { type: _, ...patch } = cmd;
      const changed = assignDefined(project, patch);
      return { project, message: `Updated ${listChanges(changed)}` };
    }

    case 'set_key': {
      // Progressions are stored relative to the tonic, so chords follow the key automatically.
      project.key = { tonic: cmd.tonic[0]!.toUpperCase() + cmd.tonic.slice(1), mode: cmd.mode };
      const scene = findScene(project);
      return { project, message: `Key is now ${keyLabel(project.key)}. Chords: ${progressionText(scene.progression, project.key)}` };
    }

    case 'set_mood': {
      const mood = getMood(cmd.mood);
      const scene = findScene(project, cmd.scene);
      project.mood = cmd.mood;
      project.bpm = mood.bpm;
      project.swing = mood.swing;
      project.window = mood.window;
      project.mix = structuredClone(mood.mix);
      if (!cmd.keep_key) project.key = { ...mood.key };
      scene.progression = resolveProgression(mood.progression, project.key);
      scene.backing = structuredClone(mood.backing);
      return {
        project,
        message: `Mood is ${mood.label}: ${keyLabel(project.key)}, ${mood.bpm} BPM, chords ${progressionText(scene.progression, project.key)}. Your strokes stay put.`,
      };
    }

    case 'set_progression': {
      const scene = findScene(project, cmd.scene);
      scene.progression = resolveProgression(cmd.progression, project.key);
      return { project, message: `Scene ${scene.name} chords: ${progressionText(scene.progression, project.key)}` };
    }

    case 'set_backing': {
      const scene = findScene(project, cmd.scene);
      const changed = [
        ...assignDefined(scene.backing.chords, cmd.chords ?? {}).map((k) => `chords.${k}`),
        ...assignDefined(scene.backing.bass, cmd.bass ?? {}).map((k) => `bass.${k}`),
        ...assignDefined(scene.backing.drums, cmd.drums ?? {}).map((k) => `drums.${k}`),
      ];
      return { project, message: `Scene ${scene.name} backing: updated ${listChanges(changed)}` };
    }

    case 'mix': {
      const { type: _, rain, ...levels } = cmd;
      const changed = [...assignDefined(project.mix, levels), ...assignDefined(project.mix.rain, rain ?? {}).map((k) => `rain.${k}`)];
      return { project, message: `Mix: updated ${listChanges(changed)}` };
    }

    case 'add_layer': {
      const scene = findScene(project, cmd.scene);
      const layer = createLayer({ instrument: cmd.instrument, name: cmd.name, color: cmd.color, index: scene.layers.length });
      assignDefined(layer, { harmony: cmd.harmony, octave: cmd.octave, kit: cmd.kit });
      scene.layers.push(layer);
      return { project, message: `Added layer "${layer.name}" [${layer.id}] (${INSTRUMENTS[layer.instrument].label}) to scene ${scene.name}`, data: { layerId: layer.id } };
    }

    case 'update_layer': {
      const { layer } = findLayer(project, cmd.layer, cmd.scene);
      const { type: _, layer: __, scene: ___, ...patch } = cmd;
      const changed = assignDefined(layer, patch);
      return { project, message: `Layer "${layer.name}": updated ${listChanges(changed)}` };
    }

    case 'remove_layer': {
      const { scene, layer } = findLayer(project, cmd.layer, cmd.scene);
      scene.layers = scene.layers.filter((l) => l.id !== layer.id);
      return { project, message: `Removed layer "${layer.name}" and its ${layer.strokes.length} strokes` };
    }

    case 'draw_path':
    case 'draw_line':
    case 'draw_curve':
    case 'draw_shape':
      return drawStroke(project, cmd);

    case 'draw_melody':
      return drawMelody(project, cmd);

    case 'erase':
      return erase(project, cmd);

    case 'add_scene': {
      const source = cmd.copy_from ? findScene(project, cmd.copy_from) : null;
      const scene = source
        ? { ...structuredClone(source), id: makeId('s'), name: cmd.name }
        : createScene(project, cmd.name, cmd.bars ?? findScene(project).bars);
      if (source) for (const layer of scene.layers) layer.id = makeId('l');
      if (cmd.bars) scene.bars = cmd.bars;
      if (cmd.progression) scene.progression = resolveProgression(cmd.progression, project.key);
      project.scenes.push(scene);
      project.arrangement.push({ sceneId: scene.id, repeat: 1 });
      if (cmd.select !== false) project.activeSceneId = scene.id;
      return { project, message: `Added scene ${scene.name} [${scene.id}], ${scene.bars} bars, and put it at the end of the arrangement`, data: { sceneId: scene.id } };
    }

    case 'update_scene': {
      const scene = findScene(project, cmd.scene);
      const changed = assignDefined(scene, { name: cmd.name, bars: cmd.bars });
      return { project, message: `Scene ${scene.name}: updated ${listChanges(changed)}` };
    }

    case 'remove_scene': {
      const scene = findScene(project, cmd.scene);
      if (project.scenes.length === 1) throw new Error("Can't remove the only scene");
      project.scenes = project.scenes.filter((s) => s.id !== scene.id);
      project.arrangement = project.arrangement.filter((a) => a.sceneId !== scene.id);
      if (project.arrangement.length === 0) project.arrangement = [{ sceneId: project.scenes[0]!.id, repeat: 1 }];
      if (project.activeSceneId === scene.id) project.activeSceneId = project.scenes[0]!.id;
      return { project, message: `Removed scene ${scene.name}` };
    }

    case 'select_scene': {
      const scene = findScene(project, cmd.scene);
      project.activeSceneId = scene.id;
      return { project, message: `Now editing scene ${scene.name}` };
    }

    case 'arrange': {
      project.arrangement = cmd.items.map((i) => ({ sceneId: findScene(project, i.scene).id, repeat: i.repeat ?? 1 }));
      const names = project.arrangement.map((a) => `${findScene(project, a.sceneId).name}${a.repeat > 1 ? `×${a.repeat}` : ''}`);
      return { project, message: `Arrangement: ${names.join(' → ')}` };
    }

    case 'describe':
      return { project, message: describeProject(project, cmd.scene) };
  }
}
