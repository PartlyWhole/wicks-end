import { PREFABS, hasTag, prefab } from '../content/defs';
import { T } from '../content/tuning';
import { clamp, lerp } from '../engine/math';
import type { Game } from '../sim/game';
import type { Entity } from '../sim/types';
import { fireLevel } from '../sim/systems/fire';
import { isFullMoon } from '../sim/light';
import { canPlaceAt, placementPrefab, snapPlacement } from '../sim/player';
import { GroundRenderer, CHUNK_UNITS } from './ground';
import { Fx } from './fx';
import { getSprite, staticSprite, type Sprite } from './sprites/static';
import { drawActor } from './sprites/actors';
import { iconCanvas } from './icons';

const FLAT = new Set(['pond', 'rabbit_hole', 'farm_plot', 'grave_mound', 'campfire', 'firepit']);

interface Speech {
  id: number;
  text: string;
  until: number;
  born: number;
}

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  readonly ground: GroundRenderer;
  readonly fx = new Fx();
  cam = { x: 0, y: 0, view: 46 };
  scale = 20;
  W = 0;
  H = 0;
  dpr = 1;
  private light: HTMLCanvasElement;
  private lctx: CanvasRenderingContext2D;
  private prev = new Map<number, [number, number]>();
  private speech: Speech[] = [];
  private shakeUntil = new Map<number, number>();
  private flashUntil = new Map<number, number>();
  private rainDrops: { x: number; y: number; l: number }[] = [];
  private visible: Entity[] = [];
  private clockTime = 0;
  hoverId: number | null = null;
  mouseWorld: [number, number] | null = null;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly g: Game,
  ) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.ground = new GroundRenderer(g);
    this.light = document.createElement('canvas');
    this.lctx = this.light.getContext('2d')!;
    this.cam.x = g.player.x;
    this.cam.y = g.player.y;
    for (let i = 0; i < 260; i++) this.rainDrops.push({ x: Math.random(), y: Math.random(), l: 0.5 + Math.random() * 0.5 });
    this.bind();
    this.resize();
  }

  private bind(): void {
    const ev = this.g.events;
    ev.on('say', ({ id, text }) => {
      this.speech = this.speech.filter((s) => s.id !== id);
      this.speech.push({ id, text, born: this.clockTime, until: this.clockTime + 2.2 + text.length * 0.045 });
    });
    ev.on('hit', ({ id, dmg }) => {
      this.flashUntil.set(id, this.clockTime + 0.15);
      if (id === this.g.player.id && dmg > 0) {
        this.fx.hurt = Math.min(1, 0.4 + dmg / 60);
        this.fx.shake = Math.min(1, 0.3 + dmg / 80);
      }
      const e = this.g.world.get(id);
      if (e && dmg > 0) this.fx.emit('spark', e.x, e.y, 5, hasTag(prefab(e.prefab), 'shadow') ? '#000' : '#f4e6c8', { z: 1 });
    });
    ev.on('died', ({ x, y, prefab: p }) => {
      if (p !== 'player') this.fx.emit('smoke', x, y, 6, '#6a625a', { z: 0.4 });
    });
    ev.on('fx', ({ kind, x, y, data }) => this.onFx(kind, x, y, data));
  }

  private onFx(kind: string, x: number, y: number, data?: any): void {
    const f = this.fx;
    switch (kind) {
      case 'chop':
        f.emit('chip', x, y, 4, '#c9a26a', { z: 1.2 });
        f.emit('leaf', x, y, 2, '#3e5a34', { z: 3.5 });
        if (data?.id) this.shakeUntil.set(data.id, this.clockTime + 0.25);
        break;
      case 'mine':
        f.emit('chip', x, y, 5, '#9a978f', { z: 0.8 });
        if (data?.id) this.shakeUntil.set(data.id, this.clockTime + 0.2);
        break;
      case 'dig':
        f.emit('chip', x, y, 5, '#6a5a44', { z: 0.3 });
        break;
      case 'hammer':
        f.emit('chip', x, y, 4, '#8a6a44', { z: 1 });
        if (data?.id) this.shakeUntil.set(data.id, this.clockTime + 0.2);
        break;
      case 'treefall': {
        const stage = data?.stage ?? 1;
        f.falling.push({ key: `pine_tree:${stage}:0`, x, y, dir: data?.facing ?? 1, t: 0 });
        break;
      }
      case 'rubble':
      case 'collapse':
      case 'build':
        f.emit('dust', x, y, 8, '#b8ab94', { z: 0.3 });
        break;
      case 'flare':
        f.emit('ember', x, y, 10, '#ffb04a', { z: 0.8 });
        break;
      case 'hush':
        f.hush = 1;
        f.shake = 0.8;
        break;
      case 'quake':
        f.shake = Math.max(f.shake, 0.6);
        break;
      case 'slam':
        f.shake = 1;
        f.emit('dust', x, y, 14, '#dfe6ea', { z: 0.2 });
        f.emit('chip', x, y, 10, '#eef4f8', { z: 0.5 });
        break;
      case 'lightning':
        f.flash = 1;
        f.bolt = { x, y, t: 0 };
        f.shake = 0.5;
        break;
    }
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = Math.floor(this.canvas.clientWidth * this.dpr);
    this.H = Math.floor(this.canvas.clientHeight * this.dpr);
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.light.width = Math.ceil(this.W / 2);
    this.light.height = Math.ceil(this.H / 2);
  }

  zoom(delta: number): void {
    this.cam.view = clamp(this.cam.view * (delta > 0 ? 1.1 : 1 / 1.1), 34, 96);
  }

  /** Record positions before a sim step (for interpolation). */
  snapshot(): void {
    this.prev.clear();
    for (const e of this.g.world.query('locomotor')) this.prev.set(e.id, [e.x, e.y]);
  }

  private pos(e: Entity, alpha: number): [number, number] {
    const p = this.prev.get(e.id);
    if (!p) return [e.x, e.y];
    return [lerp(p[0], e.x, alpha), lerp(p[1], e.y, alpha)];
  }

  toScreen = (x: number, y: number): [number, number] => [(x - this.cam.x) * this.scale + this.W / 2, (y - this.cam.y) * this.scale + this.H / 2];

  toWorld(sx: number, sy: number): [number, number] {
    const x = (sx * this.dpr - this.W / 2) / this.scale + this.cam.x;
    const y = (sy * this.dpr - this.H / 2) / this.scale + this.cam.y;
    return [x, y];
  }

  // ---------------------------------------------------------------- sprite keys
  spriteKey(e: Entity): string | null {
    const g = this.g;
    const v = e.v ?? 0;
    switch (e.prefab) {
      case 'pine_tree':
        return `pine_tree:${e.growable?.stage ?? 1}:${v % 3}${g.weather.snowCover > 0.5 ? ':s' : ''}`;
      case 'grass':
      case 'sapling':
      case 'reeds':
        return `${e.prefab}:${e.pickable?.ready ? 1 : 0}:${v % 3}`;
      case 'berrybush':
        return `berrybush:${e.pickable?.barren ? 'barren' : e.pickable?.ready ? 'ready' : 'picked'}:${v % 2}`;
      case 'flower':
        return `flower:${v % 5}`;
      case 'boulder':
        return `boulder:${v % 3}`;
      case 'boulder_gold':
        return `boulder_gold:${v % 2}`;
      case 'drying_rack':
        return `drying_rack:${e.dryer?.item ?? ''}`;
      case 'farm_plot':
        return `farm_plot:${e.farm?.crop ?? ''}:${e.farm?.ready ? 1 : 0}`;
      case 'hog_house':
        return `hog_house:${g.clock.phase !== 'day' && (e.spawner?.stock ?? 0) > 0 ? 1 : 0}`;
      case 'trap':
        return `trap:${e.trap?.caught ? 1 : 0}`;
      case 'spider_den':
        return `spider_den:${e.growable?.stage ?? 0}`;
      case 'pond':
        return `pond:${g.clock.season === 'winter' ? 1 : 0}`;
      case 'gravestone':
        return `gravestone:${v % 2}`;
      default:
        return PREFABS.get(e.prefab)?.brain || e.prefab === 'player' || e.item ? null : e.prefab;
    }
  }

  private sprite(e: Entity): Sprite | null {
    const k = this.spriteKey(e);
    return k ? getSprite(k, () => staticSprite(k)) : null;
  }

  // ---------------------------------------------------------------- picking
  pick(sx: number, sy: number): Entity | null {
    const [wx, wy] = this.toWorld(sx, sy);
    let best: Entity | null = null;
    let bestScore = -Infinity;
    this.g.world.spatial.forEachInRadius(wx, wy, 8, (e) => {
      if (e.player || (e.shadow && !this.g.player.sanity?.insane) || e.state?.name === 'dead') return;
      let hit = false;
      let score = e.y;
      if (e.item) {
        hit = Math.abs(wx - e.x) < 0.6 && wy > e.y - 1 && wy < e.y + 0.3;
        score += 100; // items on top
      } else {
        const def = PREFABS.get(e.prefab)!;
        const spr = this.sprite(e);
        const size = def.size ?? 1.5;
        if (spr) {
          const [l, t, w, h] = spr.box;
          // tighten boxes: sprites include padding
          hit = wx > e.x + l * 0.7 && wx < e.x + (l + w) * 0.7 && wy > e.y + t * 0.85 && wy < e.y + (t + h) * 0.7;
        } else {
          hit = Math.abs(wx - e.x) < Math.max(0.6, size * 0.35) && wy > e.y - size * 0.9 && wy < e.y + 0.4;
        }
        if (FLAT.has(e.prefab)) score -= 50;
      }
      if (hit && score > bestScore) {
        best = e;
        bestScore = score;
      }
    });
    return best;
  }

  // ---------------------------------------------------------------- frame
  render(alpha: number, dt: number): void {
    const g = this.g;
    const ctx = this.ctx;
    this.clockTime += dt;
    this.fx.update(dt);
    const p = g.player;
    const [px, py] = this.pos(p, alpha);
    const k = 1 - Math.exp(-dt * 6);
    this.cam.x += (px - this.cam.x) * k;
    this.cam.y += (py - 1.5 - this.cam.y) * k;
    this.scale = this.W / this.cam.view;
    const shake = this.fx.shake;
    const S = this.scale;
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 10 * this.dpr, (Math.random() - 0.5) * shake * 10 * this.dpr);

    // ---- ground
    ctx.fillStyle = '#27414b';
    ctx.fillRect(-20, -20, this.W + 40, this.H + 40);
    const hw = this.W / 2 / S;
    const hh = this.H / 2 / S;
    const x0 = this.cam.x - hw;
    const y0 = this.cam.y - hh;
    const x1 = this.cam.x + hw;
    const y1 = this.cam.y + hh;
    const budget = { n: 1 };
    const chunkPx = CHUNK_UNITS * S;
    for (let cy = Math.floor(y0 / CHUNK_UNITS); cy <= Math.floor(y1 / CHUNK_UNITS); cy++)
      for (let cx = Math.floor(x0 / CHUNK_UNITS); cx <= Math.floor(x1 / CHUNK_UNITS); cx++) {
        if (cx < 0 || cy < 0 || cx * CHUNK_UNITS >= g.worldSize || cy * CHUNK_UNITS >= g.worldSize) continue;
        const c = this.ground.get(cx, cy, budget);
        const [sx, sy] = this.toScreen(cx * CHUNK_UNITS, cy * CHUNK_UNITS);
        if (c) ctx.drawImage(c, Math.floor(sx), Math.floor(sy), Math.ceil(chunkPx) + 1, Math.ceil(chunkPx) + 1);
      }
    this.prefetch(x0, y0, x1, y1);
    // snow cover
    if (g.weather.snowCover > 0.02) {
      ctx.fillStyle = `rgba(232,238,242,${g.weather.snowCover * 0.6})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }

    // ---- entities
    const vis = this.visible;
    vis.length = 0;
    g.world.spatial.forEachInRect(x0 - 4, y0 - 2, x1 + 4, y1 + 8, (e) => vis.push(e));
    const flat: Entity[] = [];
    const upright: Entity[] = [];
    for (const e of vis) (FLAT.has(e.prefab) ? flat : upright).push(e);
    const ypos = new Map<number, number>();
    for (const e of upright) ypos.set(e.id, this.pos(e, alpha)[1]);
    upright.sort((a, b) => ypos.get(a.id)! - ypos.get(b.id)!);
    for (const e of flat) this.drawEntity(e, alpha);
    this.drawPlacement();
    for (const e of upright) this.drawEntity(e, alpha);
    // falling trees
    for (const f of this.fx.falling) {
      const spr = getSprite(f.key, () => staticSprite(f.key));
      if (!spr) continue;
      const [sx, sy] = this.toScreen(f.x, f.y);
      const t = Math.min(1, f.t / 0.9);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(f.dir * t * t * (Math.PI / 2.1));
      ctx.globalAlpha = f.t > 0.9 ? Math.max(0, 1 - (f.t - 0.9) / 0.5) : 1;
      this.blitSprite(spr, 0, 0);
      ctx.restore();
      if (f.t > 0.85 && f.t < 0.9) this.fx.emit('dust', f.x + f.dir * 3, f.y, 6, '#b8ab94', { z: 0.2 });
    }
    this.fx.draw(ctx, this.toScreen, S);

    // ---- weather
    this.drawWeather(dt);

    // ---- lighting
    this.drawLighting(alpha);

    // ---- speech
    this.drawSpeech(alpha);
    ctx.restore();
  }

  private prefetching = false;
  /** Build chunks around the view during idle time so walking rarely hitches. */
  private prefetch(x0: number, y0: number, x1: number, y1: number): void {
    if (this.prefetching) return;
    const g = this.g;
    const want: [number, number][] = [];
    for (let cy = Math.floor(y0 / CHUNK_UNITS) - 1; cy <= Math.floor(y1 / CHUNK_UNITS) + 1; cy++)
      for (let cx = Math.floor(x0 / CHUNK_UNITS) - 1; cx <= Math.floor(x1 / CHUNK_UNITS) + 1; cx++)
        if (cx >= 0 && cy >= 0 && cx * CHUNK_UNITS < g.worldSize && cy * CHUNK_UNITS < g.worldSize && !this.ground.has(cx, cy)) want.push([cx, cy]);
    if (!want.length) return;
    this.prefetching = true;
    const idle = (window as any).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 50));
    idle(() => {
      const [cx, cy] = want[0];
      this.ground.get(cx, cy, { n: 1 });
      this.prefetching = false;
    });
  }

  private blitSprite(spr: Sprite, sx: number, sy: number, skew = 0): void {
    const [l, t, w, h] = spr.box;
    const ctx = this.ctx;
    const S = this.scale;
    if (skew) {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.transform(1, 0, skew, 1, 0, 0);
      ctx.drawImage(spr.canvas, l * S, t * S, w * S, h * S);
      ctx.restore();
    } else ctx.drawImage(spr.canvas, sx + l * S, sy + t * S, w * S, h * S);
  }

  private drawEntity(e: Entity, alpha: number): void {
    const g = this.g;
    const ctx = this.ctx;
    const S = this.scale;
    const [wx, wy] = this.pos(e, alpha);
    let [sx, sy] = this.toScreen(wx, wy);
    const hover = this.hoverId === e.id;
    const flash = (this.flashUntil.get(e.id) ?? 0) > this.clockTime;

    // item on the ground
    if (e.item) {
      const icon = iconCanvas(e.item.id, 48);
      const s = 0.95 * S;
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(sx, sy, s * 0.35, s * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.drawImage(icon, sx - s / 2, sy - s * 0.95, s, s);
      if (hover) this.highlight(icon, sx - s / 2, sy - s * 0.95, s, s);
      return;
    }

    const spr = this.sprite(e);
    if (spr) {
      const shakeT = (this.shakeUntil.get(e.id) ?? 0) - this.clockTime;
      if (shakeT > 0) sx += Math.sin(shakeT * 80) * 0.08 * S;
      let skew = 0;
      if (e.prefab === 'pine_tree' || e.prefab === 'grass' || e.prefab === 'sapling' || e.prefab === 'reeds') {
        const wind = 0.02 + g.weather.precip * 0.05;
        skew = Math.sin(this.clockTime * 1.3 + e.id * 0.7) * wind;
      }
      this.blitSprite(spr, sx, sy, skew);
      if (hover || flash) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = flash ? 0.5 : 0.18;
        this.blitSprite(spr, sx, sy, skew);
        ctx.restore();
      }
      // fires & burning
      if (e.fueled) {
        const lvl = fireLevel(e);
        if (lvl >= 0) this.drawFlame(sx, sy - 0.25 * S, 0.6 + lvl * 0.28, e.id);
        if (lvl >= 0 && Math.random() < 0.05 + lvl * 0.03) this.fx.emit('ember', e.x, e.y, 1, '#ffb04a', { z: 0.8 + lvl * 0.3 });
      }
      if (e.burnable?.burning) {
        const size = PREFABS.get(e.prefab)?.size ?? 2;
        this.drawFlame(sx, sy - size * 0.25 * S, 0.5 + size * 0.28, e.id);
        this.drawFlame(sx + 0.4 * S, sy - size * 0.5 * S, 0.3 + size * 0.2, e.id + 3);
        if (Math.random() < 0.3) this.fx.emit('smoke', e.x, e.y, 1, '#3a342e', { z: size * 0.9 });
      } else if (e.burnable?.smolderUntil && Math.random() < 0.2) this.fx.emit('smoke', e.x, e.y, 1, '#8a827a', { z: 0.6 });
      if (e.cooker?.until && Math.random() < 0.15) this.fx.emit('steam', e.x, e.y, 1, '#e8e4dc', { z: 1.8 });
      if (e.cooker?.ready) this.badge(sx, sy - 2.6 * S, e.cooker.result!);
      if (e.dryer?.ready) this.badge(sx, sy - 2.9 * S, e.dryer.item!);
      if (e.farm?.ready) this.badge(sx, sy - 1.9 * S, e.farm.crop!);
      return;
    }

    // animated actor
    const st = e.state?.name ?? 'idle';
    const loco = e.locomotor;
    const prev = this.prev.get(e.id);
    const moving = st === 'walk' || (!!prev && Math.hypot(e.x - prev[0], e.y - prev[1]) > 0.001);
    const speed = loco ? Math.hypot(loco.vx, loco.vy) : 0;
    const pose = { state: st, t: g.time - (e.state?.t0 ?? 0), time: this.clockTime + e.id, moving: moving && st !== 'attack', speed };
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(S * (e.facing ?? 1), S);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (st === 'dead') ctx.globalAlpha = clamp(1 - (g.time - (e.state?.t0 ?? 0)) / T.CORPSE_TIME, 0, 1) * (e.player ? 1 : 1);
    if (e.ttl && e.prefab !== 'crow') ctx.globalAlpha *= clamp((e.ttl - g.time) / 2, 0, 1);
    drawActor(ctx, e, pose, !!g.player.sanity?.insane, g.time);
    ctx.restore();
    if (flash || hover) {
      // cheap flash: overlay a translucent white ellipse
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = flash ? 0.35 : 0.1;
      ctx.fillStyle = flash ? '#ff8a7a' : '#ffffff';
      const size = (PREFABS.get(e.prefab)?.size ?? 2) * S;
      ctx.beginPath();
      ctx.ellipse(sx, sy - size * 0.45, size * 0.4, size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (st === 'sleep' && Math.random() < 0.02) this.fx.emit('zzz', e.x + 0.4, e.y, 1, '#f4efe4', { z: 1.6 });
  }

  private badge(sx: number, sy: number, item: string): void {
    const ctx = this.ctx;
    const S = this.scale;
    const bob = Math.sin(this.clockTime * 3) * 0.08 * S;
    ctx.save();
    ctx.fillStyle = 'rgba(240,230,210,0.9)';
    ctx.strokeStyle = '#1a1410';
    ctx.lineWidth = 0.06 * S;
    ctx.beginPath();
    ctx.arc(sx, sy + bob, 0.55 * S, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.drawImage(iconCanvas(item, 48), sx - 0.45 * S, sy + bob - 0.45 * S, 0.9 * S, 0.9 * S);
    ctx.restore();
  }

  private highlight(img: CanvasImageSource, x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.25;
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
  }

  private drawFlame(sx: number, sy: number, size: number, seed: number): void {
    const ctx = this.ctx;
    const S = this.scale * size;
    const t = this.clockTime * 9 + seed;
    ctx.save();
    const layers: [string, number][] = [
      ['#c2381e', 1],
      ['#f07a26', 0.75],
      ['#ffd25a', 0.45],
    ];
    for (const [col, k] of layers) {
      const w = 0.55 * k * S;
      const h = (1.6 + Math.sin(t) * 0.15 + Math.sin(t * 2.3) * 0.1) * k * S;
      const lean = Math.sin(t * 0.7) * 0.15 * S;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(sx - w, sy);
      ctx.quadraticCurveTo(sx - w * 1.1, sy - h * 0.5, sx + lean, sy - h);
      ctx.quadraticCurveTo(sx + w * 1.1, sy - h * 0.5, sx + w, sy);
      ctx.quadraticCurveTo(sx, sy + w * 0.3, sx - w, sy);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawPlacement(): void {
    const g = this.g;
    const pre = placementPrefab(g.player);
    if (!pre || !this.mouseWorld) return;
    const [x, y] = snapPlacement(pre, this.mouseWorld[0], this.mouseWorld[1]);
    const ok = canPlaceAt(g, pre, x, y);
    const key = pre === 'pine_sapling' ? 'pine_sapling' : this.spriteKey({ id: 0, prefab: pre, x, y, v: 0 } as Entity) ?? pre;
    const spr = getSprite(key, () => staticSprite(key));
    const [sx, sy] = this.toScreen(x, y);
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.55;
    if (spr) this.blitSprite(spr, sx, sy);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = ok ? 'rgba(140,230,140,0.9)' : 'rgba(240,90,80,0.9)';
    ctx.lineWidth = 2 * this.dpr;
    ctx.setLineDash([6 * this.dpr, 5 * this.dpr]);
    ctx.beginPath();
    const r = Math.max(prefab(pre).radius ?? 0.5, 0.5) * this.scale;
    ctx.ellipse(sx, sy, r * 1.2, r * 0.6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawWeather(dt: number): void {
    const g = this.g;
    const ctx = this.ctx;
    const p = g.weather.precip;
    if (p <= 0.01) return;
    const snow = g.clock.season === 'winter';
    const n = Math.floor(this.rainDrops.length * p);
    ctx.save();
    if (snow) {
      ctx.fillStyle = 'rgba(245,248,250,0.85)';
      for (let i = 0; i < n; i++) {
        const d = this.rainDrops[i];
        d.y += dt * 0.12 * d.l;
        d.x += dt * 0.02 * Math.sin(this.clockTime + i);
        if (d.y > 1) d.y -= 1;
        ctx.beginPath();
        ctx.arc(((d.x % 1) + 1) % 1 * this.W, d.y * this.H, (1.5 + d.l * 2) * this.dpr, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.strokeStyle = 'rgba(190,210,225,0.45)';
      ctx.lineWidth = 1.2 * this.dpr;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const d = this.rainDrops[i];
        d.y += dt * 1.6 * d.l;
        if (d.y > 1) {
          d.y -= 1;
          d.x = Math.random();
        }
        const x = d.x * this.W;
        const y = d.y * this.H;
        ctx.moveTo(x, y);
        ctx.lineTo(x - 4 * this.dpr, y + 18 * d.l * this.dpr);
      }
      ctx.stroke();
      ctx.fillStyle = `rgba(40,60,80,${p * 0.18})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }
    ctx.restore();
  }

  private drawLighting(alpha: number): void {
    const g = this.g;
    const c = g.clock;
    const ctx = this.ctx;
    let amb = c.light;
    if (c.phase === 'night' && isFullMoon(c.day)) amb = Math.max(amb, 0.22);
    amb = Math.min(1, amb + this.fx.flash);
    // color grading by phase / season
    const grade: Record<string, string> = { winter: 'rgba(120,150,200,0.12)', summer: 'rgba(230,170,80,0.10)', spring: 'rgba(120,180,110,0.06)', autumn: 'rgba(200,140,80,0.06)' };
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = grade[c.season];
    ctx.fillRect(0, 0, this.W, this.H);
    if (c.phase === 'dusk') {
      ctx.fillStyle = 'rgba(190,120,110,0.25)';
      ctx.fillRect(0, 0, this.W, this.H);
    }
    ctx.restore();
    const dark = 1 - amb;
    if (dark <= 0.01) return;
    const l = this.lctx;
    const lw = this.light.width;
    const lh = this.light.height;
    l.globalCompositeOperation = 'source-over';
    l.clearRect(0, 0, lw, lh);
    l.fillStyle = c.phase === 'dusk' ? `rgba(30,20,40,${dark * 0.9})` : `rgba(4,5,12,${Math.min(1, dark * 1.02)})`;
    l.fillRect(0, 0, lw, lh);
    l.globalCompositeOperation = 'destination-out';
    const S = this.scale / 2;
    const lights: [number, number, number, number, string][] = [];
    for (const e of this.visible) {
      if (!e.light) continue;
      const [wx, wy] = this.pos(e, alpha);
      const [sx, sy] = this.toScreen(wx, wy);
      const r = e.light.radius * 1.45 * S;
      lights.push([sx / 2, sy / 2 - 0.6 * S, r, e.light.intensity, e.light.color ?? '#ffb866']);
    }
    for (const [x, y, r, i] of lights) {
      const grad = l.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(0,0,0,${Math.min(1, i)})`);
      grad.addColorStop(0.55, `rgba(0,0,0,${Math.min(1, i) * 0.85})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = grad;
      l.beginPath();
      l.arc(x, y, r, 0, Math.PI * 2);
      l.fill();
    }
    ctx.drawImage(this.light, 0, 0, this.W, this.H);
    // warm glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [x, y, r, i, col] of lights) {
      const grad = ctx.createRadialGradient(x * 2, y * 2, 0, x * 2, y * 2, r * 2);
      grad.addColorStop(0, hexA(col, 0.22 * i * dark));
      grad.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x * 2, y * 2, r * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawSpeech(alpha: number): void {
    const ctx = this.ctx;
    this.speech = this.speech.filter((s) => s.until > this.clockTime);
    for (const s of this.speech) {
      const e = this.g.world.get(s.id);
      if (!e) continue;
      const [wx, wy] = this.pos(e, alpha);
      const size = PREFABS.get(e.prefab)?.size ?? 2;
      const [sx, sy] = this.toScreen(wx, wy - size - 0.6);
      const fade = clamp((s.until - this.clockTime) / 0.4, 0, 1) * clamp((this.clockTime - s.born) / 0.15, 0, 1);
      ctx.save();
      ctx.globalAlpha = fade;
      const fs = Math.round(clamp(this.scale * 0.62, 13 * this.dpr, 22 * this.dpr));
      ctx.font = `${fs}px "IM Fell English", Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const lines = wrap(ctx, s.text, 320 * this.dpr);
      lines.forEach((ln, i) => {
        const y = sy - (lines.length - 1 - i) * fs * 1.15;
        ctx.lineWidth = 4 * this.dpr;
        ctx.strokeStyle = 'rgba(12,9,6,0.9)';
        ctx.strokeText(ln, sx, y);
        ctx.fillStyle = e.player ? '#f6efe2' : '#f0d8a8';
        ctx.fillText(ln, sx, y);
      });
      ctx.restore();
    }
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(' ');
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > max && cur) {
      out.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) out.push(cur);
  return out;
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

