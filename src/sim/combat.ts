import { ITEMS, hasTag, prefab } from '../content/defs';
import { T } from '../content/tuning';
import { dist } from '../engine/math';
import type { Game } from './game';
import { dropLoot, dropStack } from './spawn';
import { allSlots } from './inventory';
import type { Entity, StateName } from './types';

export function setState(g: Game, e: Entity, name: StateName, duration?: number, data?: any): void {
  if (!e.state) g.world.set(e, 'state', { name, t0: g.time });
  const s = e.state!;
  s.name = name;
  s.t0 = g.time;
  s.until = duration !== undefined ? g.time + duration : undefined;
  s.data = data;
}

export const isDead = (e: Entity | undefined): boolean => !e || e.state?.name === 'dead' || (!!e.health && e.health.cur <= 0);

export function isAlive(g: Game, e: Entity | undefined): e is Entity {
  return !!e && g.world.has(e) && !isDead(e);
}

/** Attack damage for an attacker (player uses weapon in hand). */
export function attackDamage(e: Entity): number {
  if (e.inventory) {
    const hand = e.inventory.equip.hand;
    const w = hand ? ITEMS.get(hand.id)?.weapon : undefined;
    return w ? w.damage : T.PLAYER_DAMAGE;
  }
  return e.combat?.damage ?? 0;
}

/** Wind-up before the hit lands, and total attack state length. */
export function attackTiming(e: Entity): { hit: number; total: number } {
  if (e.player) return { hit: 0.18, total: 0.42 };
  const period = e.combat?.period ?? 2;
  return { hit: 0.45, total: Math.min(0.9, period) };
}

export function canAttack(g: Game, e: Entity): boolean {
  const s = e.state?.name;
  return !!e.combat && g.time >= e.combat.cooldownUntil && s !== 'attack' && s !== 'hit' && s !== 'dead' && s !== 'sleep';
}

export function startAttack(g: Game, e: Entity, target: Entity): boolean {
  if (!canAttack(g, e)) return false;
  const c = e.combat!;
  c.target = target.id;
  c.cooldownUntil = g.time + c.period;
  if (e.locomotor) {
    e.locomotor.vx = 0;
    e.locomotor.vy = 0;
    e.locomotor.dest = null;
  }
  e.facing = target.x >= e.x ? 1 : -1;
  setState(g, e, 'attack', attackTiming(e).total, { target: target.id, hit: false });
  g.sfx(e.player ? 'swing' : `attack_${e.prefab}`, e.x, e.y, e.id);
  return true;
}

/** Called every tick for entities in the attack state: lands the hit at the right moment. */
export function updateAttack(g: Game, e: Entity): void {
  const s = e.state!;
  if (s.data?.hit) return;
  if (g.time - s.t0 < attackTiming(e).hit) return;
  s.data.hit = true;
  const target = g.world.get(s.data.target);
  if (hasTag(prefab(e.prefab), 'giant')) return giantSlam(g, e, target);
  if (!isAlive(g, target)) return;
  const reach = (e.combat?.range ?? 1) + (prefab(target.prefab).radius ?? 0.3) + 0.6;
  if (dist(e.x, e.y, target.x, target.y) > reach) {
    g.sfx('miss', e.x, e.y);
    return;
  }
  const dmg = attackDamage(e);
  // weapon durability
  if (e.inventory?.equip.hand) {
    const hand = e.inventory.equip.hand;
    const def = ITEMS.get(hand.id)!;
    if (def.uses && hand.dur !== undefined) {
      hand.dur -= 1 / def.uses;
      if (hand.dur <= 0.0001) {
        e.inventory.equip.hand = null;
        g.say(e, 'toolBroke');
        g.events.emit('inv', {});
      }
    }
  }
  damage(g, target, dmg, e);
}

/** Giants hit everything in an arc in front of them and flatten structures. */
function giantSlam(g: Game, e: Entity, target: Entity | undefined): void {
  const fx = e.x + (e.facing ?? 1) * 2.2;
  const fy = e.y;
  g.events.emit('fx', { kind: 'slam', x: fx, y: fy });
  g.sfx('slam', fx, fy);
  const victims = g.world.spatial.inRadius(fx, fy, 3.2, (o) => o !== e && !o.item && (!!o.health || hasTag(prefab(o.prefab), 'structure')));
  if (target && !victims.includes(target) && dist(e.x, e.y, target.x, target.y) < 4.5) victims.push(target);
  for (const o of victims) {
    const def = prefab(o.prefab);
    if (def.structure && !o.locomotor) {
      // collapse like a hammer blow
      dropLoot(g, def.hammerLoot, o.x, o.y);
      if (o.container) for (const st of o.container.slots) if (st) dropStack(g, st, o.x, o.y, 1.4);
      g.events.emit('fx', { kind: 'collapse', x: o.x, y: o.y });
      g.world.remove(o);
      continue;
    }
    if (o.health && !isDead(o)) damage(g, o, attackDamage(e) * (o.player ? 1 : 2), e);
  }
}

/** Apply damage with armor absorption, hit reactions, aggro and death. */
export function damage(g: Game, target: Entity, amount: number, attacker?: Entity, cause?: string): void {
  const h = target.health;
  if (!h || h.cur <= 0) return;
  if (target.shadow && !g.player.sanity?.insane && attacker?.player) return;
  if (h.invulnUntil && g.time < h.invulnUntil && attacker) return;
  let dmg = amount;
  if (target.inventory) dmg = absorbArmor(g, target, dmg);
  h.cur = Math.max(0, h.cur - dmg);
  h.lastHit = g.time;
  if (target.player) h.invulnUntil = g.time + T.INVULN_AFTER_HIT;
  g.events.emit('hit', { id: target.id, by: attacker?.id, dmg });
  g.sfx(target.player ? 'hurt' : 'hit', target.x, target.y, target.id);
  if (h.cur <= 0) {
    kill(g, target, cause ?? attacker?.prefab ?? 'unknown', attacker);
    return;
  }
  // hit reaction (interrupts non-attack states; big beasts shrug it off)
  const big = hasTag(prefab(target.prefab), 'large');
  if (target.state && target.state.name !== 'dead' && !big && target.state.name !== 'attack') setState(g, target, 'hit', target.player ? 0.3 : T.HIT_STUN);
  if (target.state?.name === 'sleep') setState(g, target, 'idle');
  if (attacker && !attacker.shadow) onAttacked(g, target, attacker);
}

function absorbArmor(g: Game, e: Entity, dmg: number): number {
  const eq = e.inventory!.equip;
  const pieces = [eq.body, eq.head].filter((s) => s && ITEMS.get(s.id)?.armor);
  if (!pieces.length) return dmg;
  // DST rule: the highest absorption counts; durability loss is split between pieces.
  let best = 0;
  for (const p of pieces) best = Math.max(best, ITEMS.get(p!.id)!.armor!.absorb);
  const absorbed = dmg * best;
  const share = absorbed / pieces.length;
  for (const p of pieces) {
    const a = ITEMS.get(p!.id)!.armor!;
    p!.dur = (p!.dur ?? 1) - share / a.hp;
    if (p!.dur <= 0) {
      if (eq.body === p) eq.body = null;
      if (eq.head === p) eq.head = null;
      g.say(e, 'My armor broke!', true);
    }
  }
  g.events.emit('inv', {});
  return dmg - absorbed;
}

/** Aggro and call for help. */
function onAttacked(g: Game, target: Entity, attacker: Entity): void {
  if (target.player || !target.combat) {
    if (target.brain) target.brain.bb.fleeFrom = attacker.id;
    if (target.brain) target.brain.bb.fleeUntil = g.time + 6;
    return;
  }
  target.combat.target = attacker.id;
  target.combat.aggroUntil = g.time + 20;
  const def = prefab(target.prefab);
  const group = hasTag(def, 'herd') ? 'herd' : hasTag(def, 'hog') ? 'hog' : hasTag(def, 'spider') ? 'spider' : hasTag(def, 'hound') ? 'hound' : null;
  if (!group) return;
  // followers of the attacker don't get drawn into fights with their leader
  g.world.spatial.forEachInRadius(target.x, target.y, 14, (o) => {
    if (o === target || !o.combat || isDead(o) || o.id === attacker.id) return;
    if (!hasTag(prefab(o.prefab), group)) return;
    if (o.follower && o.follower.leader === attacker.id) return;
    if (!o.combat.target || !isAlive(g, g.world.get(o.combat.target))) {
      o.combat.target = attacker.id;
      o.combat.aggroUntil = g.time + 20;
      if (o.state?.name === 'sleep') setState(g, o, 'idle');
    }
  });
}

export function kill(g: Game, e: Entity, cause: string, killer?: Entity): void {
  if (e.state?.name === 'dead') return;
  if (e.health) e.health.cur = 0;
  setState(g, e, 'dead', e.player ? undefined : T.CORPSE_TIME);
  if (e.locomotor) {
    e.locomotor.vx = e.locomotor.vy = 0;
    e.locomotor.dest = null;
  }
  const def = prefab(e.prefab);
  g.events.emit('died', { id: e.id, prefab: e.prefab, x: e.x, y: e.y });
  g.sfx(`death_${e.prefab}`, e.x, e.y, e.id);
  if (e.player) {
    e.player.stats.cause = cause;
    // drop everything, like DS
    const inv = e.inventory!;
    for (const arr of allSlots(inv)) for (let i = 0; i < arr.length; i++) if (arr[i]) (dropStack(g, arr[i]!, e.x, e.y, 2), (arr[i] = null));
    g.events.emit('playerDied', { cause });
    return;
  }
  dropLoot(g, def.loot, e.x, e.y);
  if (e.container) for (const s of e.container.slots) if (s) dropStack(g, s, e.x, e.y, 1.5);
  if (killer?.player) {
    killer.player.stats.killed++;
    if (e.prefab === 'crawling_dread') addSanity(killer, 15);
    if (e.prefab === 'dread_beak') addSanity(killer, 33);
  }
  // release home / spawner bookkeeping
  const home = g.world.get(e.home?.id);
  if (home?.spawner) {
    home.spawner.children = home.spawner.children.filter((c) => c !== e.id);
    const regen = e.prefab === 'hog' ? T.HOG_HOUSE_REGEN : e.prefab === 'rabbit' ? T.RABBIT_HOLE_REGEN : T.SPIDER_DEN_REGEN;
    g.sched.add(g.time + regen, home.id, 'regen');
  }
}

export function addSanity(e: Entity, v: number): void {
  if (e.sanity) e.sanity.cur = Math.max(0, Math.min(e.sanity.max, e.sanity.cur + v));
}
export function addHealth(e: Entity, v: number): void {
  if (e.health && e.health.cur > 0) e.health.cur = Math.max(0, Math.min(e.health.max, e.health.cur + v));
}
export function addHunger(e: Entity, v: number): void {
  if (e.hunger) e.hunger.cur = Math.max(0, Math.min(e.hunger.max, e.hunger.cur + v));
}

/** Damage over time (starving, freezing, fire): no hit reaction or aggro. */
export function hurt(g: Game, e: Entity, amount: number, cause: string): void {
  const h = e.health;
  if (!h || h.cur <= 0) return;
  h.cur = Math.max(0, h.cur - amount);
  if (h.cur <= 0) kill(g, e, cause);
}
