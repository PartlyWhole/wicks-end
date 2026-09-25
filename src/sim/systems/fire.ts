import { PREFABS, hasTag, prefab } from '../../content/defs';
import { T } from '../../content/tuning';
import type { Game, System } from '../game';
import type { Entity } from '../types';
import { dropLoot, dropStack, removeEntity, spawn } from '../spawn';
import { hurt } from '../combat';
import { makeStack } from '../inventory';

export function fireLevel(e: Entity): number {
  const max = e.prefab === 'campfire' ? T.CAMPFIRE_MAX : T.FIREPIT_MAX;
  const f = (e.fueled?.fuel ?? 0) / max;
  if (f <= 0) return -1;
  return f < 0.25 ? 0 : f < 0.5 ? 1 : f < 0.75 ? 2 : 3;
}

export function ignite(g: Game, e: Entity): void {
  if (!e.burnable || e.burnable.burning) return;
  const def = prefab(e.prefab);
  const time = def.burnable?.time ?? T.BURN_TIME_SMALL;
  e.burnable.burning = true;
  e.burnable.smolderUntil = undefined;
  e.burnable.until = g.time + time * g.rng.range(0.8, 1.2);
  if (!e.light) g.world.set(e, 'light', { radius: 5, intensity: 0.9, color: '#ff9a3c' });
  g.world.set(e, 'burnable', e.burnable);
  g.sfx('ignite', e.x, e.y);
}

function burnOut(g: Game, e: Entity): void {
  const def = prefab(e.prefab);
  const b = def.burnable!;
  if (e.container) for (const s of e.container.slots) if (s) dropStack(g, s, e.x, e.y, 1);
  dropLoot(g, b.loot, e.x, e.y);
  const becomes = b.becomes;
  const { x, y } = e;
  removeEntity(g, e);
  if (becomes) spawn(g, becomes, x, y);
  else if (!b.loot && hasTag(def, 'plant') && def.id !== 'flower') dropStack(g, makeStack('ash'), x, y, 0.3);
}

/** Fire: fuel burn, light levels, burning & spreading, fire damage, summer smoldering. */
export const fireSystem: System = {
  name: 'fire',
  interval: 0.1,
  update(g, dt) {
    const rain = g.weather.precip;
    // --- fueled fires
    for (const e of g.world.query('fueled')) {
      const f = e.fueled!;
      if (f.fuel <= 0) continue;
      const rate = 1 + rain * (T.RAIN_FIRE_MULT - 1);
      f.fuel -= rate * dt;
      if (f.fuel <= 0) {
        f.fuel = 0;
        g.sfx('fireout', e.x, e.y);
        if (e.prefab === 'campfire') {
          const { x, y } = e;
          removeEntity(g, e);
          dropStack(g, makeStack('ash'), x, y, 0.2);
          continue;
        }
      }
      const lvl = fireLevel(e);
      if (lvl < 0) {
        if (e.light) g.world.unset(e, 'light');
      } else {
        const radius = T.FIRE_LIGHT_RADII[lvl] * (0.9 + 0.1 * Math.sin(g.time * 7 + e.id));
        if (!e.light) g.world.set(e, 'light', { radius, intensity: 1, color: '#ffab4a' });
        else e.light.radius = radius;
      }
    }
    // --- burning things
    const burning: Entity[] = [];
    for (const e of g.world.query('burnable')) {
      const b = e.burnable!;
      if (b.smolderUntil && g.time >= b.smolderUntil) ignite(g, e);
      if (b.burning) burning.push(e);
    }
    for (const e of burning) {
      const b = e.burnable!;
      if (g.time >= (b.until ?? 0)) {
        burnOut(g, e);
        continue;
      }
      // rain may douse
      if (rain > 0.3 && g.rng.chance(0.02 * rain)) {
        b.burning = false;
        b.until = undefined;
        if (e.light && !PREFABS.get(e.prefab)?.light) g.world.unset(e, 'light');
        continue;
      }
      if (e.light) e.light.radius = 4.5 + Math.sin(g.time * 9 + e.id) * 0.5;
      // spread
      const spreadR = T.FIRE_SPREAD_RADIUS * (g.clock.season === 'spring' ? 0.5 : 1);
      g.world.spatial.forEachInRadius(e.x, e.y, spreadR, (o) => {
        if (o === e || !o.burnable || o.burnable.burning) return;
        if (g.rng.chance(T.FIRE_SPREAD_CHANCE * dt * (1 - rain))) ignite(g, o);
      });
      // fire damage to things standing in it
      g.world.spatial.forEachInRadius(e.x, e.y, 1.3, (o) => {
        if (!o.health || o === e || hasTag(prefab(o.prefab), 'structure')) return;
        hurt(g, o, T.FIRE_DAMAGE * dt, 'fire');
        if (o.player && g.rng.chance(dt * 2)) g.events.emit('hit', { id: o.id, dmg: 0 });
      });
    }
    // standing inside a lit fire pit/campfire hurts too
    const p = g.player;
    for (const e of g.world.query('fueled')) {
      if ((e.fueled!.fuel ?? 0) <= 0) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      if (dx * dx + dy * dy < 0.5) hurt(g, p, T.FIRE_DAMAGE * dt, 'fire');
    }
    // summer smoldering (wildfires)
    if (g.clock.season === 'summer' && g.clock.phase === 'day' && rain < 0.05 && g.clock.ambient > 55) {
      if (g.rng.chance(0.004 * dt * 10)) {
        const cands = g.world.spatial.inRadius(p.x, p.y, 28, (o) => !!o.burnable && !o.burnable.burning && !o.burnable.smolderUntil && hasTag(prefab(o.prefab), 'plant'));
        if (cands.length) {
          const c = g.rng.pick(cands);
          c.burnable!.smolderUntil = g.time + T.SMOLDER_TIME;
          g.sfx('smolder', c.x, c.y);
        }
      }
    }
  },
};
