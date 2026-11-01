// Project state. Every change goes through execute() from @haku/protocol, the same as the CLI and
// agents, so the web app can't drift from what the command protocol does. On top of that: undo and
// redo, autosave to IndexedDB, and opening or creating projects.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createProject, findScene, type MoodId, type Project } from '@haku/core';
import { execute, type Command } from '@haku/protocol';
import { initHistory, record, redo as redoStep, undo as undoStep, type History } from './history.ts';
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
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const lastSaved = useRef<Project | null>(null);

  // Open whatever you had last, or start a new loop.
  useEffect(() => {
    let cancelled = false;
    loadLastProject().then((last) => {
      if (cancelled) return;
      if (last) {
        lastSaved.current = last;
        setState(fresh(last, `Opened "${last.name}".`));
      } else {
        setState(fresh(createProject({ mood: 'rainy-study' }), 'New loop in Rainy study. Draw on the canvas, then press play.'));
      }
    });
    return () => void (cancelled = true);
  }, []);

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

  const run = useCallback((cmd: Command) => {
    setState((s) => {
      if (!s) return s;
      try {
        const r = execute(s.history.present, cmd);
        return { history: record(s.history, cmd, r.project), message: r.message, error: null };
      } catch (err) {
        return { ...s, error: err instanceof Error ? err.message : String(err) };
      }
    });
  }, []);

  const undo = useCallback(() => setState((s) => (s && s.history.past.length ? { ...s, history: undoStep(s.history), message: 'Undid the last change.', error: null } : s)), []);
  const redo = useCallback(() => setState((s) => (s && s.history.future.length ? { ...s, history: redoStep(s.history), message: 'Redid it.', error: null } : s)), []);

  /** Swap in another project. Its history starts fresh. */
  const open = useCallback((project: Project, message = `Opened "${project.name}".`) => setState(fresh(project, message)), []);

  const newProject = useCallback((mood: MoodId) => {
    const project = createProject({ mood });
    setState(fresh(project, 'New loop. Draw on the canvas, then press play.'));
  }, []);

  /** For status messages that don't come from a command, like an export finishing. */
  const notify = useCallback((message: string, isError = false) => setState((s) => (s ? { ...s, message, error: isError ? message : null } : s)), []);

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
    undo,
    redo,
    open,
    newProject,
    notify,
  };
}

export type ProjectApi = NonNullable<ReturnType<typeof useProject>>;
