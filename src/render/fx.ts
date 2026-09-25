import { Rng } from '../engine/rng';

export interface Particle {
  x: number;
  y: number;
  z: number; // height above ground (units)
  vx: number;
  vy: number;
  vz: number;
  g: number; // gravity on z
  life: number;
  max: number;
  size: number;
  color: string;
  kind: 'chip' | 'smoke' | 'spark' | 'leaf' | 'dust' | 'zzz' | 'steam' | 'ember';
  rot: number;
  vr: number;
}

export interface FallingTree {
  key: string;
  x: number;
  y: number;
  dir: number;
  t: number;
}

/** Visual-only particles and transient effects. Never affects the simulation. */
export class Fx {
  particles: Particle[] = [];
  falling: FallingTree[] = [];
  flash = 0; // lightning flash 0..1
  bolt: { x: number; y: number; t: number } | null = null;
  hush = 0; // darkness-strike vignette 0..1
  hurt = 0; // red damage vignette
  shake = 0;
  private rng = new Rng(99);

  emit(kind: Particle['kind'], x: number, y: number, n: number, color: string, opts: Partial<Particle> = {}): void {
    const r = this.rng;
    for (let i = 0; i < n; i++) {
      const base: Particle = {
        x,
        y,
        z: opts.z ?? 0.8,
        vx: r.range(-2, 2),
        vy: r.range(-1, 1),
        vz: r.range(2, 5),
        g: 14,
        life: 0,
        max: r.range(0.5, 0.9),
        size: r.range(0.08, 0.18),
        color,
        kind,
        rot: r.range(0, 6),
        vr: r.range(-8, 8),
      };
      if (kind === 'smoke' || kind === 'steam' || kind === 'dust') {
        base.vz = r.range(0.6, 1.4);
        base.g = -0.2;
        base.vx = r.range(-0.4, 0.4);
        base.vy = r.range(-0.2, 0.2);
        base.max = r.range(1.2, 2.2);
        base.size = r.range(0.25, 0.5);
      }
      if (kind === 'zzz') {
        base.vz = 0.6;
        base.g = 0;
        base.vx = 0.3;
        base.vy = 0;
        base.max = 2;
        base.size = 0.35;
      }
      if (kind === 'ember') {
        base.vz = r.range(1, 2.5);
        base.g = -0.5;
        base.vx = r.range(-0.3, 0.3);
        base.max = r.range(0.6, 1.4);
        base.size = r.range(0.04, 0.08);
      }
      if (kind === 'leaf') {
        base.g = 2;
        base.vz = r.range(0.5, 2);
        base.max = r.range(1, 1.6);
      }
      this.particles.push({ ...base, ...opts, life: 0 });
    }
  }

  update(dt: number): void {
    const ps = this.particles;
    let w = 0;
    for (const p of ps) {
      p.life += dt;
      if (p.life >= p.max) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vz -= p.g * dt;
      p.z += p.vz * dt;
      p.rot += p.vr * dt;
      if (p.z < 0 && (p.kind === 'chip' || p.kind === 'spark')) {
        p.z = 0;
        p.vz *= -0.3;
        p.vx *= 0.5;
        p.vy *= 0.5;
      }
      if (p.kind === 'leaf') {
        p.vx += Math.sin(p.life * 6) * dt * 3;
        if (p.z < 0) p.z = 0;
      }
      ps[w++] = p;
    }
    ps.length = w;
    for (const f of this.falling) f.t += dt;
    this.falling = this.falling.filter((f) => f.t < 1.4);
    this.flash = Math.max(0, this.flash - dt * 3);
    this.hush = Math.max(0, this.hush - dt * 1.2);
    this.hurt = Math.max(0, this.hurt - dt * 2);
    this.shake = Math.max(0, this.shake - dt * 3);
    if (this.bolt) {
      this.bolt.t += dt;
      if (this.bolt.t > 0.35) this.bolt = null;
    }
  }

  draw(ctx: CanvasRenderingContext2D, toScreen: (x: number, y: number) => [number, number], scale: number): void {
    for (const p of this.particles) {
      const [sx, sy] = toScreen(p.x, p.y);
      const y = sy - p.z * scale;
      const k = p.life / p.max;
      ctx.globalAlpha = p.kind === 'smoke' || p.kind === 'steam' || p.kind === 'dust' ? (1 - k) * 0.45 : 1 - k * k;
      ctx.fillStyle = p.color;
      const s = p.size * scale * (p.kind === 'smoke' || p.kind === 'dust' || p.kind === 'steam' ? 1 + k * 1.5 : 1);
      if (p.kind === 'zzz') {
        ctx.font = `bold ${Math.round(s)}px Georgia, serif`;
        ctx.fillText('z', sx, y);
        continue;
      }
      if (p.kind === 'chip' || p.kind === 'leaf') {
        ctx.save();
        ctx.translate(sx, y);
        ctx.rotate(p.rot);
        ctx.fillRect(-s, -s * 0.5, s * 2, s);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(sx, y, s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
