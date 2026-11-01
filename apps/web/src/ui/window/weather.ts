// Moving weather drawn on a canvas over the window art: rain streaks, snow, drifting petals, and
// twinkling stars, plus droplets sliding down the glass whenever the rain sound is on. It runs in
// the art's coordinates (320 x 206) and only inside the four panes.

import type { WindowScene } from '@haku/core';
import { GLASS } from './scenes.tsx';

const PANES: [number, number, number, number][] = [
  [GLASS.x, GLASS.y, 157 - GLASS.x, 88 - GLASS.y],
  [163, GLASS.y, GLASS.x + GLASS.w - 163, 88 - GLASS.y],
  [GLASS.x, 94, 157 - GLASS.x, GLASS.y + GLASS.h - 94],
  [163, 94, GLASS.x + GLASS.w - 163, GLASS.y + GLASS.h - 94],
];

interface Particle {
  x: number;
  y: number;
  /** Speed in art units per second. */
  v: number;
  size: number;
  phase: number;
}

export interface WeatherState {
  scene: WindowScene;
  /** Rain sound is on, so the glass gets droplets whatever the scene. */
  wetGlass: boolean;
  /** 1 while music plays, slower when it doesn't. */
  speed: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const glassX = () => rand(GLASS.x, GLASS.x + GLASS.w);
const glassY = () => rand(GLASS.y, GLASS.y + GLASS.h);

function spawn(count: number, make: () => Particle) {
  return Array.from({ length: count }, make);
}

export class Weather {
  private streaks = spawn(70, () => ({ x: glassX(), y: glassY(), v: rand(220, 320), size: rand(7, 13), phase: 0 }));
  private flakes = spawn(60, () => ({ x: glassX(), y: glassY(), v: rand(9, 24), size: rand(0.7, 2), phase: rand(0, Math.PI * 2) }));
  private petals = spawn(7, () => ({ x: glassX(), y: glassY(), v: rand(10, 18), size: rand(2.2, 3.4), phase: rand(0, Math.PI * 2) }));
  private stars = spawn(10, () => ({ x: glassX(), y: rand(GLASS.y, GLASS.y + 60), v: rand(0.8, 2), size: rand(0.8, 1.4), phase: rand(0, Math.PI * 2) }));
  private drops = spawn(16, () => ({ x: glassX(), y: glassY(), v: rand(1, 6), size: rand(1.1, 2.6), phase: rand(0, 10) }));
  private t = 0;

  /** Advances by dt seconds and draws. ctx is already scaled to art units. */
  frame(ctx: CanvasRenderingContext2D, dt: number, state: WeatherState) {
    const step = dt * state.speed;
    this.t += step;
    ctx.clearRect(0, 0, 320, 206);
    ctx.save();
    ctx.beginPath();
    for (const [x, y, w, h] of PANES) ctx.rect(x, y, w, h);
    ctx.clip();

    switch (state.scene) {
      case 'rain':
        this.drawRain(ctx, step);
        break;
      case 'snow':
        this.drawSnow(ctx, step);
        break;
      case 'sunny':
      case 'dusk':
        this.drawPetals(ctx, step, state.scene === 'dusk' ? '#d98f9b' : '#e8897a');
        break;
      case 'night-city':
        this.drawStars(ctx);
        break;
    }
    if (state.wetGlass) this.drawDrops(ctx, step);
    ctx.restore();
  }

  private drawRain(ctx: CanvasRenderingContext2D, step: number) {
    ctx.strokeStyle = 'rgba(205, 218, 232, 0.32)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (const p of this.streaks) {
      p.y += p.v * step;
      p.x -= p.v * 0.12 * step;
      if (p.y > GLASS.y + GLASS.h + p.size) {
        p.y = GLASS.y - p.size;
        p.x = glassX() + 20;
      }
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.size * 0.12, p.y - p.size);
    }
    ctx.stroke();
  }

  private drawSnow(ctx: CanvasRenderingContext2D, step: number) {
    ctx.fillStyle = 'rgba(250, 251, 253, 0.85)';
    for (const p of this.flakes) {
      p.y += p.v * step;
      p.phase += step * 1.3;
      if (p.y > GLASS.y + GLASS.h + 3) {
        p.y = GLASS.y - 3;
        p.x = glassX();
      }
      ctx.beginPath();
      ctx.arc(p.x + Math.sin(p.phase) * 5, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawPetals(ctx: CanvasRenderingContext2D, step: number, color: string) {
    ctx.fillStyle = color;
    for (const p of this.petals) {
      p.y += p.v * step;
      p.x += p.v * 0.6 * step;
      p.phase += step * 1.6;
      if (p.y > GLASS.y + GLASS.h + 5 || p.x > GLASS.x + GLASS.w + 5) {
        p.y = rand(GLASS.y - 20, GLASS.y);
        p.x = rand(GLASS.x - 40, GLASS.x + GLASS.w * 0.7);
      }
      ctx.save();
      ctx.translate(p.x + Math.sin(p.phase) * 4, p.y);
      ctx.rotate(p.phase);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawStars(ctx: CanvasRenderingContext2D) {
    for (const p of this.stars) {
      const a = 0.25 + 0.6 * (0.5 + 0.5 * Math.sin(this.t * p.v + p.phase));
      ctx.fillStyle = `rgba(239, 230, 207, ${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Drops cling to the glass, then every so often let go and slide down. */
  private drawDrops(ctx: CanvasRenderingContext2D, step: number) {
    for (const p of this.drops) {
      p.phase -= step;
      const sliding = p.phase < 0;
      if (sliding) p.y += p.v * 6 * step;
      if (p.phase < -1.5) p.phase = rand(2, 9);
      if (p.y > GLASS.y + GLASS.h + 3) {
        p.y = GLASS.y;
        p.x = glassX();
      }
      ctx.fillStyle = 'rgba(226, 234, 242, 0.32)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.size * 0.8, p.size, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.arc(p.x - p.size * 0.25, p.y - p.size * 0.35, p.size * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
