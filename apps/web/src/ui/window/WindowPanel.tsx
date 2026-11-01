// The big window across the top of the room. The view follows the project's `window` setting
// (sliced from the same SVG scenes the mood thumbnails use), the weather moves faster while music
// plays, and wooden mullions split it into panes. Purely decorative, so it's hidden from readers.

import { useEffect, useRef } from 'react';
import type { Project } from '@haku/core';
import { GLASS, SCENES } from './scenes.tsx';
import { Weather, type WeatherState } from './weather.ts';

interface Props {
  project: Project;
  playing: boolean;
}

/** Weather units per CSS pixel. Above 1 so drops and petals read at this size. */
const WEATHER_SCALE = 1.4;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function WindowPanel({ project, playing }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef<WeatherState>({ scene: project.window, wetGlass: false, speed: 0.45 });
  state.current = { scene: project.window, wetGlass: project.mix.rain.enabled, speed: playing ? 1 : 0.45 };
  const Art = SCENES[project.window].art;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let weather: Weather | null = null;
    let frame = 0;
    let last = performance.now();

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr * WEATHER_SCALE, 0, 0, dpr * WEATHER_SCALE, 0, 0);
      weather = new Weather({ x: 0, y: 0, w: width / WEATHER_SCALE, h: height / WEATHER_SCALE });
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const loop = (now: number) => {
      // Cap the step so a background tab doesn't dump a minute of rain at once.
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      weather?.frame(ctx, reducedMotion() ? 0 : dt, state.current);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="room-window" aria-hidden="true">
      <div className="room-window__glass">
        <svg className="room-window__view" viewBox={`${GLASS.x} ${GLASS.y} ${GLASS.w} ${GLASS.h}`} preserveAspectRatio="xMidYMax slice">
          <Art />
        </svg>
        <canvas ref={canvasRef} className="room-window__weather" />
        <div className="room-window__panes" />
      </div>
    </div>
  );
}
