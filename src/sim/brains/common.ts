import { hasTag, prefab, type PrefabDef } from '../../content/defs';
import { dist } from '../../engine/math';
import type { Status } from '../../engine/bt';
import type { Game } from '../game';
import type { Entity } from '../types';
import { isAlive, isDead, setState, startAttack } from '../combat';
import { enterHome } from '../systems/world';

export interface BrainCtx {
  g: Game;
  e: Entity;
  def: PrefabDef;
  bb: Record<string, any>;
}

export const now = (c: BrainCtx) => c.g.time;

export function stop(c: BrainCtx): void {
  const l = c.e.locomotor;
  if (!l) return;
  l.dest = null;
  l.vx = l.vy = 0;
  if (c.e.state?.name === 'walk') setState(c.g, c.e, 'idle');
}

export function moveTo(c: BrainCtx, x: number, y: number, run = false): void {
  const l = c.e.locomotor!;
  l.running = run;
  l.dest = { x, y };
  if (c.e.state?.name === 'idle') setState(c.g, c.e, 'walk');
}

export function busy(c: BrainCtx): boolean {
  const s = c.e.state?.name;
  return s === 'attack' || s === 'hit' || s === 'dead' || s === 'eat';
}

/** Wander around an anchor point with pauses. */
export function wander(c: BrainCtx, ax: number, ay: number, radius: number): Status {
  const { g, e, bb } = c;
  const l = e.locomotor!;
  if (l.dest) return 'running';
  if ((bb.waitUntil ?? 0) > g.time) return 'running';
  if (bb.wandering) {
    bb.wandering = false;
    bb.waitUntil = g.time + g.rng.range(1.5, 5);
    if (e.state?.name === 'walk') setState(g, e, 'idle');
    return 'running';
  }
  for (let i = 0; i < 6; i++) {
    const a = g.rng.range(0, Math.PI * 2);
    const r = g.rng.range(radius * 0.2, radius);
    const x = ax + Math.cos(a) * r;
    const y = ay + Math.sin(a) * r;
    if (g.walkable(x, y)) {
      moveTo(c, x, y, false);
      bb.wandering = true;
      return 'running';
    }
  }
  return 'running';
}

export function flee(c: BrainCtx, from: Entity, distance = 8): Status {
  const { e, g } = c;
  const dx = e.x - from.x;
  const dy = e.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  let tx = e.x + (dx / d) * distance;
  let ty = e.y + (dy / d) * distance;
  if (!g.walkable(tx, ty)) {
    // try perpendicular
    tx = e.x - (dy / d) * distance;
    ty = e.y + (dx / d) * distance;
  }
  moveTo(c, tx, ty, true);
  return 'running';
}

/** Chase and attack the combat target. */
export function fight(c: BrainCtx, target: Entity): Status {
  const { g, e } = c;
  if (busy(c)) return 'running';
  const range = e.combat!.range + (prefab(target.prefab).radius ?? 0.3) * 0.8;
  const d = dist(e.x, e.y, target.x, target.y);
  if (d > range) {
    moveTo(c, target.x, target.y, true);
    return 'running';
  }
  stop(c);
  e.facing = target.x > e.x ? 1 : -1;
  if (g.time >= e.combat!.cooldownUntil) startAttack(g, e, target);
  else {
    // kite back a touch between attacks, like DS mobs
    if (g.time < e.combat!.cooldownUntil - 0.6 && e.prefab === 'hog') flee(c, target, 1.5);
  }
  return 'running';
}

export function currentTarget(c: BrainCtx, leash = 30): Entity | undefined {
  const { g, e } = c;
  const cb = e.combat;
  if (!cb?.target) return undefined;
  const t = g.world.get(cb.target);
  const expired = cb.aggroUntil !== undefined && g.time > cb.aggroUntil;
  if (!isAlive(g, t) || expired || dist(e.x, e.y, t.x, t.y) > leash || (t.shadow && !g.player.sanity?.insane) || (t.player && t.state?.name === 'dead')) {
    cb.target = undefined;
    return undefined;
  }
  return t;
}

export function findNear(c: BrainCtx, r: number, pred: (o: Entity) => boolean): Entity | undefined {
  return c.g.world.spatial.nearest(c.e.x, c.e.y, r, (o) => o !== c.e && !isDead(o) && pred(o));
}

export function setTarget(c: BrainCtx, t: Entity, aggro = 20): void {
  c.e.combat!.target = t.id;
  c.e.combat!.aggroUntil = c.g.time + aggro;
}

export function home(c: BrainCtx): Entity | undefined {
  return c.g.world.get(c.e.home?.id);
}

/** Walk home and disappear inside. */
export function goHome(c: BrainCtx, run = false): Status {
  const h = home(c);
  if (!h) return 'failure';
  const d = dist(c.e.x, c.e.y, h.x, h.y);
  if (d < (prefab(h.prefab).radius ?? 0.5) + 0.9) {
    enterHome(c.g, c.e);
    return 'success';
  }
  moveTo(c, h.x, h.y, run);
  return 'running';
}

export const isHostile = (o: Entity) => hasTag(prefab(o.prefab), 'hostile');
