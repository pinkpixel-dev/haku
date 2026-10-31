// Project state. Every change goes through execute() from @haku/protocol, the same as the CLI and
// agents, so the web app can't drift from what the command protocol does.

import { useCallback, useState } from 'react';
import { createProject, findScene, type Project } from '@haku/core';
import { execute, type Command } from '@haku/protocol';

interface ProjectState {
  project: Project;
  message: string;
  error: string | null;
}

export function useProject() {
  const [state, setState] = useState<ProjectState>(() => ({
    project: createProject({ name: 'Untitled loop', mood: 'rainy-study' }),
    message: 'New loop in Rainy study. Draw on the canvas, then press play.',
    error: null,
  }));

  const run = useCallback((cmd: Command) => {
    setState((s) => {
      try {
        const r = execute(s.project, cmd);
        return { project: r.project, message: r.message, error: null };
      } catch (err) {
        return { ...s, error: err instanceof Error ? err.message : String(err) };
      }
    });
  }, []);

  const scene = findScene(state.project);
  return { ...state, scene, run };
}
