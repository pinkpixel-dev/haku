// The window at the top of the right column. The scene follows the project's `window` setting,
// the weather moves faster while music plays, and the plant sways once per bar.

import { useEffect, useRef } from 'react';
import { WINDOW_SCENES, type Project } from '@haku/core';
import type { Command } from '@haku/protocol';
import { Select } from '../controls.tsx';
import { SCENES } from './scenes.tsx';
import { Weather, type WeatherState } from './weather.ts';
import { WindowArt } from './WindowArt.tsx';

interface Props {
  project: Project;
  playing: boolean;
  run: (cmd: Command) => void;
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function WindowPanel({ project, playing, run }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef<WeatherState>({ scene: project.window, wetGlass: false, speed: 0.45 });
  state.current = { scene: project.window, wetGlass: project.mix.rain.enabled, speed: playing ? 1 : 0.45 };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const weather = new Weather();
    let frame = 0;
    let last = performance.now();

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform((width * dpr) / 320, 0, 0, (height * dpr) / 206, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const loop = (now: number) => {
      // Cap the step so a background tab doesn't dump a minute of rain at once.
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      weather.frame(ctx, reducedMotion() ? 0 : dt, state.current);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, []);

  return (
    <section className="panel window-panel" aria-labelledby="window-title">
      <div className="panel__head">
        <h2 id="window-title" className="panel__title">
          Window
        </h2>
        <Select
          label="View outside"
          hideLabel
          className="field--compact"
          value={project.window}
          options={WINDOW_SCENES.map((w) => ({ value: w, label: SCENES[w].label }))}
          onChange={(view) => run({ type: 'set_project', window: view })}
        />
      </div>
      <div className="window-frame">
        <WindowArt scene={project.window} swaySeconds={(60 / project.bpm) * 4} swaying={playing} />
        <canvas ref={canvasRef} className="window-weather" aria-hidden="true" />
      </div>
    </section>
  );
}
