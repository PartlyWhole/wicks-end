import { prefab } from '../../content/defs';
import { T } from '../../content/tuning';
import { dist2 } from '../../engine/math';
import type { Game, System } from '../game';
import type { Entity } from '../types';
import { removeEntity, spawn, TREE_STAGES, dropStack } from '../spawn';
import { isAlive, isDead } from '../combat';
import { makeStack } from '../inventory';

const WINTER_DORMANT = new Set(['grass', 'sapling', 'berrybush', 'reeds']);

/** Scheduled world events: regrowth, tree growth, respawns, spawner regen. */
function handle(g: Game, id: number, ev: string): void {
  if (ev.startsWith('respawn|')) {
    const [, pre, xs, ys] = ev.split('|');
    const x = +xs + g.rng.range(-3, 3);
    const y = +ys + g.rng.range(-3, 3);
    if (!g.walkable(x, y)) return;
    if (g.world.spatial.nearest(x, y, 0.8)) return void g.sched.add(g.time + T.DAY, 0, ev);
    spawn(g, pre, x, y);
    return;
  }
  const e = g.world.get(id);
  if (!e) return;
  switch (ev) {
    case 'regrow':
      if (!e.pickable) return;
      if (g.clock.season === 'winter' && WINTER_DORMANT.has(e.prefab)) return void g.sched.add(g.time + T.DAY, id, ev);
      e.pickable.ready = true;
      return;
    case 'grow':
      if (e.prefab === 'pine_sapling') {
        const { x, y } = e;
        removeEntity(g, e);
        const t = spawn(g, 'pine_tree', x, y, { growable: { stage: 0 } });
        t.workable!.left = TREE_STAGES[0].work;
        g.sched.add(g.time + T.TREE_STAGE_TIME[0] * g.rng.range(0.8, 1.2), t.id, 'grow');
      } else if (e.prefab === 'pine_tree' && e.growable && e.growable.stage < 2) {
        e.growable.stage++;
        e.workable!.left = TREE_STAGES[e.growable.stage].work;
        if (e.growable.stage < 2) g.sched.add(g.time + T.TREE_STAGE_TIME[e.growable.stage] * g.rng.range(0.8, 1.2), id, 'grow');
      }
      return;
    case 'regen':
      if (e.spawner) e.spawner.stock = Math.min(maxStock(e), e.spawner.stock + 1);
      return;
    case 'dengrow':
      if (e.growable && e.growable.stage < 2) {
        e.growable.stage++;
        if (e.health) e.health.max = e.health.cur = [250, 400, 600][e.growable.stage];
        e.spawner!.stock = maxStock(e);
        if (e.growable.stage < 2) g.sched.add(g.time + T.SPIDER_DEN_GROW, id, 'dengrow');
      }
      return;
    case 'farm':
      if (!e.farm?.crop) return;
      if (g.clock.season === 'winter') return void g.sched.add(g.time + T.DAY, id, ev);
      e.farm.ready = true;
      return;
    case 'poop':
      if (!isDead(e)) {
        if (g.inAwakeRange(e)) dropStack(g, makeStack('manure'), e.x, e.y, 0.5);
        g.sched.add(g.time + T.DAY * g.rng.range(0.8, 1.6), id, 'poop');
      }
      return;
  }
}

export function maxStock(e: Entity): number {
  switch (e.prefab) {
    case 'spider_den':
      return [2, 3, 5][e.growable?.stage ?? 0];
    case 'pond':
      return 3;
    default:
      return 1;
  }
}

function aliveChildren(g: Game, s: Entity): number {
  const sp = s.spawner!;
  sp.children = sp.children.filter((c) => isAlive(g, g.world.get(c)));
  return sp.children.length;
}

export function releaseChild(g: Game, home: Entity, pre: string): Entity {
  const a = g.rng.range(0, Math.PI * 2);
  const r = (prefab(home.prefab).radius ?? 0.5) + 0.8;
  const c = spawn(g, pre, home.x + Math.cos(a) * r, home.y + Math.sin(a) * r, { home: { id: home.id } });
  home.spawner!.children.push(c.id);
  home.spawner!.stock--;
  return c;
}

/** A child returns home: removed from world, stock restored. */
export function enterHome(g: Game, e: Entity): void {
  const home = g.world.get(e.home?.id);
  if (home?.spawner) {
    home.spawner.children = home.spawner.children.filter((c) => c !== e.id);
    home.spawner.stock = Math.min(maxStock(home) + 2, home.spawner.stock + 1);
  }
  removeEntity(g, e);
}

export const worldSystem: System = {
  name: 'world',
  interval: 0.5,
  update(g, dt) {
    g.sched.drain(g.time, (s) => handle(g, s.id, s.ev));
    const c = g.clock;
    const p = g.player;
    const R2 = (T.AWAKE_RADIUS + 10) ** 2;

    // spawners near the player
    for (const e of g.world.query('spawner')) {
      if (dist2(e.x, e.y, p.x, p.y) > R2) continue;
      const sp = e.spawner!;
      if (sp.stock <= 0) continue;
      const n = aliveChildren(g, e);
      switch (e.prefab) {
        case 'rabbit_hole':
          if (c.phase === 'day' && n < 1 && g.rng.chance(0.2)) releaseChild(g, e, 'rabbit');
          break;
        case 'hog_house':
          if (c.phase === 'day' && n < 1 && c.tod > 10) releaseChild(g, e, 'hog');
          break;
        case 'spider_den': {
          const hunt = c.phase === 'night' || (c.phase === 'dusk' && c.tod > (c.segs[0] + c.segs[1] * 0.6) * T.SEG);
          if (hunt && g.rng.chance(0.15)) {
            const warrior = (e.growable?.stage ?? 0) >= 1 && g.rng.chance(0.25);
            releaseChild(g, e, warrior ? 'spider_warrior' : 'spider');
          }
          break;
        }
        case 'pond':
          if (c.season !== 'winter' && c.phase !== 'night' && n < 2 && g.rng.chance(0.05)) releaseChild(g, e, 'frog');
          break;
      }
    }

    // cooking, drying, traps, ttl
    for (const e of g.world.query('cooker')) {
      const ck = e.cooker!;
      if (ck.until && !ck.ready && g.time >= ck.until) {
        ck.ready = true;
        ck.until = undefined;
        if (e.light) g.world.unset(e, 'light');
        g.sfx('cooked', e.x, e.y);
      }
    }
    for (const e of g.world.query('dryer')) {
      const d = e.dryer!;
      if (!d.item || d.ready) continue;
      if (g.weather.precip > 0.1) d.until! += dt;
      else if (g.time >= d.until!) d.ready = true;
    }
    for (const e of g.world.query('trap')) {
      const t = e.trap!;
      if (!t.set || t.caught) continue;
      const prey = g.world.spatial.nearest(e.x, e.y, 0.9, (o) => o.prefab === 'rabbit' && !isDead(o));
      if (prey) {
        t.caught = 'rabbit';
        const home = g.world.get(prey.home?.id);
        if (home?.spawner) {
          home.spawner.children = home.spawner.children.filter((x) => x !== prey.id);
          g.sched.add(g.time + T.RABBIT_HOLE_REGEN, home.id, 'regen');
        }
        removeEntity(g, prey);
        g.sfx('trap', e.x, e.y);
      }
    }
    for (const e of g.world.query('ttl')) if (g.time >= e.ttl!) removeEntity(g, e);

    // corpses
    for (const e of g.world.query('state')) {
      const s = e.state!;
      if (s.name === 'dead' && !e.player && s.until !== undefined && g.time >= s.until) removeEntity(g, e);
    }
  },
};
