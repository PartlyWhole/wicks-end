import { ITEMS, PREFABS } from '../../content/defs';
import { dropStack } from '../spawn';
import { updateEquipLight } from '../player';
import { T } from '../../content/tuning';
import { clamp } from '../../engine/math';
import type { Game, System } from '../game';
import type { Entity, Stack } from '../types';
import { addSanity, damage, hurt, isDead } from '../combat';
import { lightAt } from '../light';
import { fireLevel } from './fire';
import type { SayKey } from '../../content/strings';

function warnOnce(g: Game, p: Entity, key: SayKey, cooldown = 30): void {
  const w = (p.player!.warned ??= {});
  if ((w[key] ?? -999) + cooldown > g.time) return;
  w[key] = g.time;
  g.say(p, key);
}

function equipped(p: Entity): Stack[] {
  const e = p.inventory!.equip;
  return [e.hand, e.body, e.head].filter((s): s is Stack => !!s);
}

export function insulation(p: Entity): { winter: number; summer: number; waterproof: number; sanity: number } {
  let winter = 0;
  let summer = 0;
  let waterproof = 0;
  let sanity = 0;
  for (const s of equipped(p)) {
    const eq = ITEMS.get(s.id)?.equip;
    if (!eq) continue;
    winter += eq.insulation ?? 0;
    summer += eq.summer ?? 0;
    waterproof = Math.max(waterproof, eq.waterproof ?? 0);
    sanity += eq.sanity ?? 0;
  }
  return { winter, summer, waterproof, sanity };
}

/** Heat emitted at point by fires, torches, and a carried thermal stone. Returns [heat, cold] targets. */
export function heatAt(g: Game, p: Entity): { heat: number; cold: number } {
  let heat = -Infinity;
  let cold = Infinity;
  g.world.spatial.forEachInRadius(p.x, p.y, T.FIRE_HEAT_RADIUS, (e, d2) => {
    let h = 0;
    if (e.fueled) {
      const lvl = fireLevel(e);
      if (lvl < 0) return;
      h = T.FIRE_HEAT[lvl];
    } else if (e.burnable?.burning) h = 80;
    else return;
    const d = Math.sqrt(d2);
    const f = clamp(1 - d / T.FIRE_HEAT_RADIUS, 0, 1);
    heat = Math.max(heat, h * f + g.clock.ambient * (1 - f));
  });
  const hand = p.inventory!.equip.hand;
  if (hand) {
    const hh = ITEMS.get(hand.id)?.equip?.heat;
    if (hh) heat = Math.max(heat, g.clock.ambient + hh);
  }
  for (const s of p.inventory!.slots) {
    if (s?.temp === undefined) continue;
    if (s.temp > 30) heat = Math.max(heat, s.temp);
    if (s.temp < 20) cold = Math.min(cold, s.temp);
  }
  return { heat, cold };
}

/** Player survival stats: hunger, sanity, temperature, wetness, darkness. */
export const statsSystem: System = {
  name: 'stats',
  update(g, dt) {
    const p = g.player;
    if (isDead(p)) return;
    const pl = p.player!;
    const sleeping = p.state?.name === 'sleep';
    const c = g.clock;

    // ---- hunger
    const h = p.hunger!;
    h.cur = Math.max(0, h.cur - T.HUNGER_RATE * dt);
    if (h.cur <= 0) {
      hurt(g, p, T.STARVE_DAMAGE * dt, 'starvation');
      warnOnce(g, p, 'starving', 20);
    } else if (h.cur < h.max * 0.2) warnOnce(g, p, 'hungry', 90);

    // ---- light & the Hush
    const light = lightAt(g, p.x, p.y);
    pl.light = light;
    if (light < T.DARK_THRESHOLD && !sleeping) {
      if (pl.darkSince === null) {
        pl.darkSince = g.time;
        pl.nextHushAt = g.time + g.rng.range(T.HUSH_FIRST_MIN, T.HUSH_FIRST_MAX);
        warnOnce(g, p, 'darkWarn', 8);
        g.sfx('hush_warn', p.x, p.y);
      } else if (g.time >= (pl.nextHushAt ?? Infinity)) {
        pl.nextHushAt = g.time + g.rng.range(T.HUSH_NEXT_MIN, T.HUSH_NEXT_MAX);
        g.events.emit('fx', { kind: 'hush', x: p.x, y: p.y });
        g.sfx('hush', p.x, p.y);
        addSanity(p, T.HUSH_SANITY);
        damage(g, p, T.HUSH_DAMAGE, undefined, 'darkness');
        if (!isDead(p)) g.say(p, 'hushHit');
      }
    } else {
      pl.darkSince = null;
      pl.nextHushAt = null;
    }

    // ---- sanity
    const s = p.sanity!;
    const ins = insulation(p);
    let ds = 0;
    if (c.phase === 'dusk') ds += T.SANITY_DUSK;
    if (c.phase === 'night') ds += light < T.DARK_THRESHOLD ? T.SANITY_DARK : T.SANITY_NIGHT;
    ds += (ins.sanity / 60) * (sleeping ? 0 : 1);
    const wet = p.wetness!.cur;
    ds += T.SANITY_WET_MAX * (wet / 100) ** 1.5;
    ds += T.SANITY_RAIN_MAX * g.weather.precip * (1 - ins.waterproof);
    // auras
    g.world.spatial.forEachInRadius(p.x, p.y, 10, (e, d2) => {
      if (e === p) return;
      const aura = PREFABS.get(e.prefab)?.sanityAura;
      if (!aura || isDead(e)) return;
      if (e.shadow && !s.insane) return;
      if (aura < 0 && e.follower?.leader === p.id) return;
      const d = Math.sqrt(d2);
      const f = d < 2 ? 1 : clamp(1 - (d - 2) / 8, 0, 1);
      ds += (aura / 60) * f;
    });
    // friendly hog followers calm you
    for (const e of g.world.query('follower')) if (e.follower!.leader === p.id && !isDead(e)) ds += 25 / 60 / 4;
    if (!sleeping) s.cur = clamp(s.cur + ds * dt, 0, s.max);
    const frac = s.cur / s.max;
    if (!s.insane && frac <= T.INSANE_ENTER) {
      s.insane = true;
      g.say(p, 'insane');
      g.sfx('insane', p.x, p.y);
    } else if (s.insane && frac >= T.INSANE_EXIT) {
      s.insane = false;
      g.sfx('sane', p.x, p.y);
    } else if (frac < 0.4) warnOnce(g, p, 'lowSanity', 120);

    // ---- wetness
    const w = p.wetness!;
    if (g.weather.precip > 0 && !sheltered(g, p)) {
      w.cur = Math.min(T.WET_MAX, w.cur + g.weather.precip * T.WET_RATE_RAIN * (1 - ins.waterproof) * dt);
      if (w.cur > 60) warnOnce(g, p, 'wet', 200);
    } else {
      const heat = heatAt(g, p).heat;
      const dry = heat > c.ambient + 15 ? T.DRY_RATE_FIRE : T.DRY_RATE * (c.season === 'summer' ? 2 : 1);
      w.cur = Math.max(0, w.cur - dry * dt);
    }
    // wet tools slip
    if (w.cur > T.WET_SLIPPERY && p.inventory!.equip.hand && (p.state?.name === 'work' || p.state?.name === 'attack') && g.rng.chance(0.1 * (w.cur / 100) * dt)) {
      const tool = p.inventory!.equip.hand!;
      p.inventory!.equip.hand = null;
      updateEquipLight(g, p);
      dropStack(g, tool, p.x, p.y, 1.5);
      g.say(p, 'My tool slipped out of my wet hands!', true);
      g.events.emit('inv', {});
    }

    // ---- temperature
    const t = p.temperature!;
    const { heat, cold } = heatAt(g, p);
    let target = c.ambient - (w.cur / 100) * 10;
    if (heat > target) target = heat;
    if (cold < target && c.ambient > 25) target = cold;
    if (pl.foodTemp && g.time < pl.foodTemp.until) target += pl.foodTemp.delta;
    else pl.foodTemp = undefined;
    target = clamp(target, T.TEMP_MIN, T.TEMP_MAX);
    const diff = target - t.cur;
    let rate: number;
    if (diff < 0) rate = heat > -Infinity && heat > c.ambient ? 1 : 30 / (30 + ins.winter);
    else rate = heat > c.ambient ? 1.5 : 30 / (30 + ins.summer);
    if (sleeping) rate *= 0.5;
    const step = Math.min(Math.abs(diff), rate * dt) * Math.sign(diff);
    t.cur = clamp(t.cur + step, T.TEMP_MIN, T.TEMP_MAX);
    if (t.cur < T.FREEZE_AT) {
      hurt(g, p, T.FREEZE_DAMAGE * dt, 'freezing');
      warnOnce(g, p, 'freezing', 15);
    } else if (t.cur < T.WARN_COLD) warnOnce(g, p, 'cold', 60);
    if (t.cur > T.OVERHEAT_AT) {
      hurt(g, p, T.OVERHEAT_DAMAGE * dt, 'overheating');
      warnOnce(g, p, 'overheating', 15);
    } else if (t.cur > T.WARN_HOT) warnOnce(g, p, 'hot', 60);

    // explored map
    const tx = Math.floor(p.x / T.TILE);
    const ty = Math.floor(p.y / T.TILE);
    const R = 7;
    for (let y = ty - R; y <= ty + R; y++)
      for (let x = tx - R; x <= tx + R; x++) {
        if (x < 0 || y < 0 || x >= g.size || y >= g.size) continue;
        if ((x - tx) ** 2 + (y - ty) ** 2 <= R * R) g.explored[y * g.size + x] = 1;
      }
  },
};

function sheltered(g: Game, p: Entity): boolean {
  let yes = false;
  g.world.spatial.forEachInRadius(p.x, p.y, 3, (e) => {
    if (e.prefab === 'pine_tree' && (e.growable?.stage ?? 0) >= 1) yes = true;
  });
  return yes && g.weather.precip < 0.6;
}

