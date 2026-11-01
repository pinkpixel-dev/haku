// Undo and redo over whole projects. execute() never mutates, so every state is a snapshot we can
// keep. Slider drags would fill the stack with tiny steps, so repeated edits to the same control
// within a short window merge into one step.

import type { Project } from '@haku/core';
import type { Command } from '@haku/protocol';

export interface History {
  past: Project[];
  present: Project;
  future: Project[];
  /** What the last step changed and when, for merging slider drags. */
  last: { key: string; at: number } | null;
}

export const HISTORY_LIMIT = 100;
export const MERGE_WINDOW_MS = 800;

/** Commands that only move the view around. They change the project but aren't worth an undo step. */
const VIEW_ONLY: ReadonlySet<Command['type']> = new Set(['select_scene', 'describe']);

/** Drawing and structural commands always get their own step. */
const NEVER_MERGE: ReadonlySet<Command['type']> = new Set([
  'draw_path', 'draw_line', 'draw_curve', 'draw_shape', 'draw_melody', 'erase',
  'add_layer', 'remove_layer', 'add_scene', 'remove_scene', 'set_mood', 'set_key', 'set_progression',
]);

/**
 * Two commands merge when they're the same kind aimed at the same thing and only numbers differ,
 * like two positions of one volume slider. Strings and booleans (ids, names, toggles) must match.
 */
export function mergeKey(cmd: Command): string | null {
  if (NEVER_MERGE.has(cmd.type)) return null;
  return JSON.stringify(cmd, (_, v) => (typeof v === 'number' ? 0 : v));
}

export const initHistory = (present: Project): History => ({ past: [], present, future: [], last: null });

export function record(h: History, cmd: Command, next: Project, now = Date.now()): History {
  if (VIEW_ONLY.has(cmd.type)) return { ...h, present: next, last: null };
  const key = mergeKey(cmd);
  const merge = key !== null && h.last?.key === key && now - h.last.at < MERGE_WINDOW_MS;
  return {
    past: merge ? h.past : [...h.past, h.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
    last: key ? { key, at: now } : null,
  };
}

/** Several commands sent together (an agent's batch) become one undo step that never merges. */
export function recordBatch(h: History, cmds: readonly Command[], next: Project, now = Date.now()): History {
  if (cmds.every((c) => VIEW_ONLY.has(c.type))) return { ...h, present: next, last: null };
  if (cmds.length === 1) return record(h, cmds[0]!, next, now);
  return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: next, future: [], last: null };
}

/** Undo keeps the scene you're looking at, so stepping back doesn't yank the view around. */
function keepView(target: Project, from: Project): Project {
  if (target.activeSceneId === from.activeSceneId || !target.scenes.some((s) => s.id === from.activeSceneId)) return target;
  return { ...target, activeSceneId: from.activeSceneId };
}

export function undo(h: History): History {
  const prev = h.past.at(-1);
  if (!prev) return h;
  return { past: h.past.slice(0, -1), present: keepView(prev, h.present), future: [h.present, ...h.future], last: null };
}

export function redo(h: History): History {
  const next = h.future[0];
  if (!next) return h;
  return { past: [...h.past, h.present], present: keepView(next, h.present), future: h.future.slice(1), last: null };
}
