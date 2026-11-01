// Moving weather drawn on a canvas over the window art: rain streaks, snow, drifting petals, and
// twinkling stars, plus droplets sliding down the glass whenever the rain sound is on. It draws
// inside one glass rectangle in whatever units the caller's canvas transform uses; the window's
// mullions are painted on top, so it doesn't need to know about panes.

import type { WindowScene } from '@haku/core';

export interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Particle counts were tuned for the old 292 x 166 glass; bigger glass gets proportionally more. */
const BASE_AREA = 292 * 166;

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

export class Weather {
  private readonly area: Area;
  private streaks: Particle[];
  private flakes: Particle[];
  private petals: Particle[];
  private stars: Particle[];
  private drops: Particle[];
  private t = 0;

  constructor(area: Area) {
    this.area = area;
    const k = Math.min(6, Math.max(1, (area.w * area.h) / BASE_AREA));
    const spawn = (count: number, make: () => Particle) => Array.from({ length: Math.round(count * k) }, make);
    const x = () => this.glassX();
    const y = () => this.glassY();
    this.streaks = spawn(70, () => ({ x: x(), y: y(), v: rand(220, 320), size: rand(7, 13), phase: 0 }));
    this.flakes = spawn(60, () => ({ x: x(), y: y(), v: rand(9, 24), size: rand(0.7, 2), phase: rand(0, Math.PI * 2) }));
    this.petals = spawn(7, () => ({ x: x(), y: y(), v: rand(10, 18), size: rand(2.2, 3.4), phase: rand(0, Math.PI * 2) }));
    this.stars = spawn(10, () => ({ x: x(), y: rand(area.y, area.y + area.h * 0.45), v: rand(0.8, 2), size: rand(0.8, 1.4), phase: rand(0, Math.PI * 2) }));
    this.drops = spawn(16, () => ({ x: x(), y: y(), v: rand(1, 6), size: rand(1.1, 2.6), phase: rand(0, 10) }));
  }

  private glassX() {
    return rand(this.area.x, this.area.x + this.area.w);
  }

  private glassY() {
    return rand(this.area.y, this.area.y + this.area.h);
  }

  private get bottom() {
    return this.area.y + this.area.h;
  }

  /** Advances by dt seconds and draws. ctx is already scaled to the area's units. */
  frame(ctx: CanvasRenderingContext2D, dt: number, state: WeatherState) {
    const { x, y, w, h } = this.area;
    const step = dt * state.speed;
    this.t += step;
    ctx.clearRect(x, y, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
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
      if (p.y > this.bottom + p.size) {
        p.y = this.area.y - p.size;
        p.x = this.glassX() + 20;
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
      if (p.y > this.bottom + 3) {
        p.y = this.area.y - 3;
        p.x = this.glassX();
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
      if (p.y > this.bottom + 5 || p.x > this.area.x + this.area.w + 5) {
        p.y = rand(this.area.y - 20, this.area.y);
        p.x = rand(this.area.x - 40, this.area.x + this.area.w * 0.7);
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
      if (p.y > this.bottom + 3) {
        p.y = this.area.y;
        p.x = this.glassX();
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
