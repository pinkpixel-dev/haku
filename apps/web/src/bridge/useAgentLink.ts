// Answers agent requests in the tab: reading and changing the project (through the same apply path
// as everything else, so it lands in undo and autosave), opening projects, and the transport.

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { findScene, parseProject } from '@haku/core';
import type { TabOp, TabStatus } from '@haku/protocol';
import { engine } from '../audio/engine.ts';
import type { ProjectApi } from '../state/useProject.ts';
import { agentLink } from './link.ts';

const NEEDS_CLICK = "The browser won't let the Haku tab play sound until someone clicks in it once. Click anywhere in the tab, then try again.";

function status(api: ProjectApi): TabStatus {
  const project = api.current() ?? api.project;
  const scene = findScene(project);
  return {
    projectId: project.id,
    projectName: project.name,
    sceneId: scene.id,
    sceneName: scene.name,
    playing: engine.playing,
    mode: engine.mode,
    engine: engine.status.state,
  };
}

async function handle(op: TabOp, api: ProjectApi): Promise<unknown> {
  switch (op.op) {
    case 'get_project':
      return api.current();
    case 'execute':
      return api.apply(op.commands);
    case 'open_project': {
      const project = parseProject(op.project);
      engine.stop();
      api.open(project, `An agent opened "${project.name}".`);
      return status(api);
    }
    case 'play': {
      if (op.scene) api.apply([{ type: 'select_scene', scene: op.scene }]);
      if (op.mode) engine.setMode(op.mode);
      // Schedule the right scene now rather than waiting for React to re-render.
      engine.update(api.current()!);
      // Autoplay rules: a page can only start audio after the person has interacted with it.
      if (navigator.userActivation && !navigator.userActivation.hasBeenActive) throw new Error(NEEDS_CLICK);
      await Promise.race([engine.play(), new Promise((r) => setTimeout(r, 15_000))]);
      if (!engine.playing) throw new Error(engine.status.state === 'error' ? engine.status.message : NEEDS_CLICK);
      return status(api);
    }
    case 'stop':
      engine.stop();
      return status(api);
    case 'status':
      return status(api);
  }
}

export function useAgentLink(api: ProjectApi) {
  const apiRef = useRef(api);
  useEffect(() => {
    apiRef.current = api;
  });
  useEffect(() => {
    agentLink.handler = (op) => handle(op, apiRef.current);
    agentLink.start();
    return () => void (agentLink.handler = null);
  }, []);
  return useSyncExternalStore(agentLink.subscribe, () => agentLink.state);
}
