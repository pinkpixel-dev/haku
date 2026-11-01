// Project state. Every change goes through execute() from @haku/protocol, the same as the CLI and
// agents, so the web app can't drift from what the command protocol does. On top of that: undo and
// redo, autosave to IndexedDB, and opening or creating projects.
//
// The latest state also lives in a ref, so commands from the agent bridge can run synchronously and
// answer with what happened, even when several arrive before React re-renders.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createProject, findScene, type MoodId, type Project } from '@haku/core';
import { CommandSchema, execute, type Command, type ExecuteReply } from '@haku/protocol';
import { initHistory, record, recordBatch, redo as redoStep, undo as undoStep, type History } from './history.ts';
import { loadLastProject, saveProject } from './storage.ts';

export type SaveState = 'saved' | 'saving' | 'error';

interface State {
  history: History;
  message: string;
  error: string | null;
}

const AUTOSAVE_MS = 600;

const fresh = (project: Project, message: string): State => ({ history: initHistory(project), message, error: null });

export function useProject() {
  const [state, setState] = useState<State | null>(null);
  const stateRef = useRef<State | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const lastSaved = useRef<Project | null>(null);

  const commit = useCallback((next: State) => {
    stateRef.current = next;
    setState(next);
  }, []);

  /** Applies a change to the latest state. Returning null leaves it alone. */
  const update = useCallback((fn: (s: State) => State | null) => {
    const s = stateRef.current;
    if (!s) return;
    const next = fn(s);
    if (next) commit(next);
  }, [commit]);

  // Open whatever you had last, or start a new loop.
  useEffect(() => {
    let cancelled = false;
    loadLastProject().then((last) => {
      if (cancelled) return;
      if (last) {
        lastSaved.current = last;
        commit(fresh(last, `Opened "${last.name}".`));
      } else {
        commit(fresh(createProject({ mood: 'rainy-study' }), 'New loop in Rainy study. Draw on the canvas, then press play.'));
      }
    });
    return () => void (cancelled = true);
  }, [commit]);

  // Autosave a moment after the last change.
  const present = state?.history.present ?? null;
  useEffect(() => {
    if (!present || present === lastSaved.current) return;
    setSaveState('saving');
    const timer = setTimeout(() => {
      saveProject(present)
        .then(() => {
          lastSaved.current = present;
          setSaveState('saved');
        })
        .catch(() => setSaveState('error'));
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [present]);

  const run = useCallback(
    (cmd: Command) =>
      update((s) => {
        try {
          const r = execute(s.history.present, cmd);
          return { history: record(s.history, cmd, r.project), message: r.message, error: null };
        } catch (err) {
          return { ...s, error: err instanceof Error ? err.message : String(err) };
        }
      }),
    [update],
  );

  /**
   * Runs commands from an agent as one undo step and says what happened. Unlike run(), a bad command
   * throws (and nothing changes), so the agent hears about it.
   */
  const apply = useCallback(
    (input: unknown[]): ExecuteReply => {
      const s = stateRef.current;
      if (!s) throw new Error('Haku is still opening');
      const cmds: Command[] = [];
      const messages: string[] = [];
      const data: unknown[] = [];
      let project = s.history.present;
      for (const [i, raw] of input.entries()) {
        const parsed = CommandSchema.safeParse(raw);
        const where = input.length > 1 ? `Command ${i + 1}: ` : '';
        if (!parsed.success) {
          const issue = parsed.error.issues[0]!;
          throw new Error(`${where}Bad command: ${issue.path.join('.') || 'command'}: ${issue.message}`);
        }
        try {
          const r = execute(project, parsed.data);
          project = r.project;
          cmds.push(parsed.data);
          messages.push(r.message);
          data.push(r.data ?? null);
        } catch (err) {
          throw new Error(`${where}${err instanceof Error ? err.message : String(err)}`);
        }
      }
      const message = messages.length === 1 ? messages[0]! : `An agent ran ${messages.length} commands. ${messages.at(-1)}`;
      commit({ history: recordBatch(s.history, cmds, project), message, error: null });
      return { messages, data };
    },
    [commit],
  );

  const undo = useCallback(() => update((s) => (s.history.past.length ? { ...s, history: undoStep(s.history), message: 'Undid the last change.', error: null } : null)), [update]);
  const redo = useCallback(() => update((s) => (s.history.future.length ? { ...s, history: redoStep(s.history), message: 'Redid it.', error: null } : null)), [update]);

  /** Swap in another project. Its history starts fresh. */
  const open = useCallback((project: Project, message = `Opened "${project.name}".`) => commit(fresh(project, message)), [commit]);

  const newProject = useCallback(
    (mood: MoodId) => commit(fresh(createProject({ mood }), 'New loop. Draw on the canvas, then press play.')),
    [commit],
  );

  /** For status messages that don't come from a command, like an export finishing. */
  const notify = useCallback((message: string, isError = false) => update((s) => ({ ...s, message, error: isError ? message : null })), [update]);

  /** The project as of right now, including changes React hasn't rendered yet. */
  const current = useCallback(() => stateRef.current?.history.present ?? null, []);

  if (!state) return null;
  const project = state.history.present;
  return {
    project,
    scene: findScene(project),
    message: state.message,
    error: state.error,
    canUndo: state.history.past.length > 0,
    canRedo: state.history.future.length > 0,
    saveState,
    run,
    apply,
    current,
    undo,
    redo,
    open,
    newProject,
    notify,
  };
}

export type ProjectApi = NonNullable<ReturnType<typeof useProject>>;
