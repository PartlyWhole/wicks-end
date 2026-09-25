import { ITEMS, RECIPES, hasTag, item, prefab } from '../content/defs';
import { T } from '../content/tuning';
import { dist } from '../engine/math';
import type { Game } from './game';
import type { Command, SlotRef } from './commands';
import type { Entity, Stack, EquipSlot } from './types';
import { ACTIONS, actionById, giveOrDrop, resolveAction, startCooking, trySleep, type ActionDef } from './actions';
import { addHealth, addHunger, addSanity, isAlive, isDead, setState, startAttack } from './combat';
import { PACK_SLOTS, giveItem, hasItems, makeStack, maxStack, takeItem } from './inventory';
import { dropStack, spawn } from './spawn';

// ------------------------------------------------------------------ tech & crafting
export function techAt(g: Game, x: number, y: number): number {
  let tech = 0;
  g.world.spatial.forEachInRadius(x, y, T.PROTOTYPER_RANGE, (e) => {
    if (e.prefab === 'tinkers_bench') tech = Math.max(tech, 1);
    if (e.prefab === 'alembic') tech = Math.max(tech, 2);
  });
  return tech;
}

export type CraftStatus = 'ok' | 'prototype' | 'missing' | 'locked';

export function craftStatus(g: Game, p: Entity, recipeId: string): CraftStatus {
  const r = RECIPES.get(recipeId)!;
  const known = r.tech === 0 || p.player!.known.includes(r.id);
  const tech = techAt(g, p.x, p.y);
  if (!known && tech < r.tech) return 'locked';
  if (!hasItems(p.inventory!, r.ingredients)) return 'missing';
  return known ? 'ok' : 'prototype';
}

function craft(g: Game, p: Entity, recipeId: string): void {
  const r = RECIPES.get(recipeId);
  if (!r) return;
  const st = craftStatus(g, p, recipeId);
  if (st === 'locked' || st === 'missing') {
    g.say(p, 'cantCraft');
    return;
  }
  if (r.place) {
    p.player!.placing = r.id;
    g.events.emit('inv', {});
    return;
  }
  for (const [id, n] of r.ingredients) takeItem(p.inventory!, id, n);
  learn(g, p, r.id);
  giveOrDrop(g, p, makeStack(r.item!, r.n ?? 1));
  p.player!.stats.crafted++;
  g.events.emit('crafted', { recipe: r.id, prototyped: st === 'prototype' });
  g.sfx('craft', p.x, p.y);
}

function learn(g: Game, p: Entity, id: string): void {
  const r = RECIPES.get(id)!;
  if (r.tech === 0 || p.player!.known.includes(id)) return;
  p.player!.known.push(id);
  addSanity(p, T.SANITY_PROTOTYPE);
  g.say(p, 'prototype');
  g.sfx('prototype', p.x, p.y);
}

export function canPlaceAt(g: Game, prefabId: string, x: number, y: number): boolean {
  const def = prefab(prefabId);
  const r = Math.max(def.radius ?? 0.4, 0.4);
  const pts = [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]];
  for (const [dx, dy] of pts) if (!g.walkable(x + dx, y + dy)) return false;
  let blocked = false;
  g.world.spatial.forEachInRadius(x, y, r + 2, (e, d2) => {
    if (e.player || e.item || e.locomotor) return;
    const er = prefab(e.prefab).radius ?? 0;
    const need = hasTag(def, 'wall') && hasTag(prefab(e.prefab), 'wall') ? 0.9 : r + Math.max(er, 0.35);
    if (d2 < need * need) {
      blocked = true;
      return true;
    }
  });
  return !blocked;
}

export function snapPlacement(prefabId: string, x: number, y: number): [number, number] {
  if (hasTag(prefab(prefabId), 'wall')) return [Math.floor(x) + 0.5, Math.floor(y) + 0.5];
  return [x, y];
}

/** Prefab to be placed by current placement mode (recipe or deployable cursor item). */
export function placementPrefab(p: Entity): string | null {
  const pl = p.player!;
  if (pl.placing) return RECIPES.get(pl.placing)?.place ?? null;
  const cur = p.inventory?.cursor;
  if (cur) return ITEMS.get(cur.id)?.deploy ?? null;
  return null;
}

function build(g: Game, p: Entity, x: number, y: number): void {
  const pl = p.player!;
  const pre = placementPrefab(p);
  if (!pre) return;
  [x, y] = snapPlacement(pre, x, y);
  if (!canPlaceAt(g, pre, x, y)) {
    g.say(p, 'cantPlace');
    return;
  }
  if (pl.placing) {
    const r = RECIPES.get(pl.placing)!;
    if (!hasItems(p.inventory!, r.ingredients)) {
      pl.placing = null;
      g.say(p, 'cantCraft');
      return;
    }
    const proto = craftStatus(g, p, r.id) === 'prototype';
    for (const [id, n] of r.ingredients) takeItem(p.inventory!, id, n);
    learn(g, p, r.id);
    pl.stats.crafted++;
    g.events.emit('crafted', { recipe: r.id, prototyped: proto });
    pl.placing = null;
  } else {
    const cur = p.inventory!.cursor!;
    cur.n--;
    if (cur.n <= 0) p.inventory!.cursor = null;
  }
  const e = spawn(g, pre, x, y);
  e.facing = 1;
  if (pre === 'pine_sapling') g.sched.add(g.time + T.PINECONE_GROW, e.id, 'grow');
  g.events.emit('fx', { kind: 'build', x, y });
  g.sfx('build', x, y);
  g.events.emit('inv', {});
}

// ------------------------------------------------------------------ inventory slots
function slotGet(g: Game, p: Entity, ref: SlotRef): Stack | null {
  const inv = p.inventory!;
  switch (ref.where) {
    case 'inv':
      return inv.slots[ref.i];
    case 'pack':
      return inv.pack?.[ref.i] ?? null;
    case 'equip':
      return inv.equip[ref.slot];
    case 'container':
      return g.world.get(ref.id)?.container?.slots[ref.i] ?? null;
  }
}

function slotSet(g: Game, p: Entity, ref: SlotRef, s: Stack | null): void {
  const inv = p.inventory!;
  switch (ref.where) {
    case 'inv':
      inv.slots[ref.i] = s;
      break;
    case 'pack':
      if (inv.pack) inv.pack[ref.i] = s;
      break;
    case 'equip':
      inv.equip[ref.slot] = s;
      break;
    case 'container': {
      const c = g.world.get(ref.id)?.container;
      if (c) c.slots[ref.i] = s;
    }
  }
}

function slotMax(g: Game, ref: SlotRef, id: string): number {
  if (ref.where === 'container' && g.world.get(ref.id)?.cooker) return 1;
  return maxStack(id);
}

function slotAccepts(g: Game, ref: SlotRef, s: Stack): boolean {
  if (ref.where === 'equip') return ITEMS.get(s.id)?.equip?.slot === ref.slot;
  if (ref.where === 'container') {
    const c = g.world.get(ref.id);
    if (c?.cooker) return !!ITEMS.get(s.id)?.cook && !c.cooker.until;
  }
  if (ref.where === 'pack' || ref.where === 'inv') return !(s.id === 'backpack' && ref.where === 'pack');
  return true;
}

function clickSlot(g: Game, p: Entity, ref: SlotRef, alt: boolean, split?: boolean): void {
  const inv = p.inventory!;
  const s = slotGet(g, p, ref);
  const cur = inv.cursor;
  if (alt) {
    if (!cur && s) useStack(g, p, ref, s);
    return;
  }
  if (ref.where === 'equip') {
    if (cur) {
      if (slotAccepts(g, ref, cur)) equipFromCursor(g, p, ref.slot);
    } else if (s) {
      unequip(g, p, ref.slot, true);
    }
    g.events.emit('inv', {});
    return;
  }
  if (!cur) {
    if (!s) return;
    if (split && s.n > 1) {
      const half = Math.ceil(s.n / 2);
      inv.cursor = { ...s, n: half };
      s.n -= half;
    } else {
      inv.cursor = s;
      slotSet(g, p, ref, null);
    }
  } else if (!slotAccepts(g, ref, cur)) {
    return;
  } else if (!s) {
    const max = slotMax(g, ref, cur.id);
    if (cur.n > max) {
      slotSet(g, p, ref, { ...cur, n: max });
      cur.n -= max;
    } else {
      slotSet(g, p, ref, cur);
      inv.cursor = null;
    }
  } else if (s.id === cur.id && slotMax(g, ref, s.id) > 1) {
    const max = slotMax(g, ref, s.id);
    const moved = Math.min(max - s.n, cur.n);
    if (s.fresh !== undefined && cur.fresh !== undefined && moved > 0) s.fresh = (s.fresh * s.n + cur.fresh * moved) / (s.n + moved);
    s.n += moved;
    cur.n -= moved;
    if (cur.n <= 0) inv.cursor = null;
  } else if (cur.n <= slotMax(g, ref, cur.id)) {
    slotSet(g, p, ref, cur);
    inv.cursor = s;
  }
  g.events.emit('inv', {});
}

function equipFromCursor(g: Game, p: Entity, slot: EquipSlot): void {
  const inv = p.inventory!;
  const cur = inv.cursor!;
  const prev = inv.equip[slot];
  if (prev) unequip(g, p, slot, false);
  inv.equip[slot] = cur;
  inv.cursor = prev;
  onEquip(g, p, slot);
  g.sfx('equip', p.x, p.y);
}

export function equip(g: Game, p: Entity, ref: SlotRef): void {
  const s = slotGet(g, p, ref);
  if (!s) return;
  const slot = ITEMS.get(s.id)?.equip?.slot;
  if (!slot) return;
  const inv = p.inventory!;
  slotSet(g, p, ref, null);
  const prev = inv.equip[slot];
  if (prev) {
    unequip(g, p, slot, false);
    // put previous where the new one came from if possible
    if (!slotGet(g, p, ref) && prev.id !== 'backpack') slotSet(g, p, ref, prev);
    else if (giveItem(inv, prev) > 0) dropStack(g, prev, p.x, p.y, 0.5);
  }
  inv.equip[slot] = s;
  onEquip(g, p, slot);
  g.sfx('equip', p.x, p.y);
  g.events.emit('inv', {});
}

function onEquip(g: Game, p: Entity, slot: EquipSlot): void {
  const inv = p.inventory!;
  const s = inv.equip[slot];
  if (slot === 'body' && s?.id === 'backpack') {
    const anyS = s as Stack & { contents?: (Stack | null)[] };
    anyS.contents ??= Array(PACK_SLOTS).fill(null);
    inv.pack = anyS.contents;
  }
  updateEquipLight(g, p);
}

/** Unequip into inventory (or cursor when toCursor). */
export function unequip(g: Game, p: Entity, slot: EquipSlot, toCursor: boolean): void {
  const inv = p.inventory!;
  const s = inv.equip[slot];
  if (!s) return;
  inv.equip[slot] = null;
  if (slot === 'body' && s.id === 'backpack') inv.pack = null;
  if (toCursor) inv.cursor = s;
  updateEquipLight(g, p);
  g.events.emit('inv', {});
}

export function updateEquipLight(g: Game, p: Entity): void {
  const h = p.inventory?.equip.hand;
  const r = h ? ITEMS.get(h.id)?.equip?.light : undefined;
  if (r) g.world.set(p, 'light', { radius: r, intensity: 1, color: '#ffb866' });
  else if (p.light) g.world.unset(p, 'light');
}

function useStack(g: Game, p: Entity, ref: SlotRef, s: Stack): void {
  const def = ITEMS.get(s.id)!;
  if (ref.where === 'equip') {
    unequip(g, p, ref.slot, false);
    const s2 = { ...s };
    if (giveItem(p.inventory!, s2) > 0) dropStack(g, s, p.x, p.y, 0.5);
    g.events.emit('inv', {});
    return;
  }
  if (ref.where === 'container') {
    // move to inventory
    const left = giveItem(p.inventory!, { ...s });
    if (left <= 0) slotSet(g, p, ref, null);
    else s.n = left;
    g.events.emit('inv', {});
    return;
  }
  if (def.equip) return equip(g, p, ref);
  if (def.food) return eat(g, p, ref, s);
  if (def.heal) {
    addHealth(p, def.heal);
    consume(g, p, ref, s);
    g.sfx('heal', p.x, p.y);
    return;
  }
  if (hasTag(def, 'bedroll')) {
    if (trySleep(g, p, 'roll')) consume(g, p, ref, s);
    return;
  }
  if (s.id === 'rabbit') {
    consume(g, p, ref, s);
    giveOrDrop(g, p, makeStack('morsel'));
    g.sfx('hit', p.x, p.y);
    return;
  }
}

function consume(g: Game, p: Entity, ref: SlotRef, s: Stack): void {
  s.n--;
  if (s.n <= 0) slotSet(g, p, ref, null);
  g.events.emit('inv', {});
}

export function foodValues(s: Stack): { health: number; hunger: number; sanity: number } {
  const f = ITEMS.get(s.id)!.food!;
  const fresh = s.fresh ?? 1;
  let { health, hunger, sanity } = f;
  if (fresh < T.SPOILED_AT) {
    hunger *= 0.5;
    health = 0;
    sanity = T.SANITY_SPOILED_FOOD;
  } else if (fresh < T.STALE_AT) {
    hunger *= 0.667;
    if (health > 0) health *= 0.333;
    if (sanity > 0) sanity = 0;
  }
  return { health, hunger, sanity };
}

function eat(g: Game, p: Entity, ref: SlotRef, s: Stack): void {
  if (p.state?.name === 'eat') return;
  const v = foodValues(s);
  const def = ITEMS.get(s.id)!.food!;
  addHealth(p, v.health);
  addHunger(p, v.hunger);
  addSanity(p, v.sanity);
  if (def.temp && p.temperature) {
    p.player!.pending = null;
    p.player!.foodTemp = { delta: def.temp, until: g.time + (def.tempTime ?? 5) };
  }
  if ((s.fresh ?? 1) < T.SPOILED_AT) g.say(p, 'spoiled');
  consume(g, p, ref, s);
  setState(g, p, 'eat', 0.6);
  if (p.locomotor) p.locomotor.vx = p.locomotor.vy = 0;
  g.events.emit('ate', { item: s.id });
  g.sfx('eat', p.x, p.y);
}

// ------------------------------------------------------------------ commands
export function handleCommand(g: Game, p: Entity, cmd: Command): void {
  const pl = p.player!;
  if (isDead(p)) return;
  const asleep = p.state?.name === 'sleep';
  switch (cmd.t) {
    case 'move':
      pl.moveDx = cmd.dx;
      pl.moveDy = cmd.dy;
      if (asleep && (cmd.dx || cmd.dy)) wake(g, p);
      if (cmd.dx || cmd.dy) pl.pending = null;
      break;
    case 'stop':
      pl.pending = null;
      break;
    case 'click': {
      if (asleep) return wake(g, p);
      const target = g.world.get(cmd.target);
      // placement mode
      if (placementPrefab(p) && !target?.item && (pl.placing || !target || !resolveAction(g, p, target, false))) {
        if (cmd.alt) {
          pl.placing = null;
          if (p.inventory!.cursor) returnCursor(g, p);
          return;
        }
        pl.pending = { action: 'build', x: cmd.x, y: cmd.y };
        return;
      }
      if (target) {
        const a = resolveAction(g, p, target, cmd.alt, cmd.force);
        if (!a) {
          if (!cmd.alt && p.inventory!.cursor) pl.pending = { action: 'drop', x: cmd.x, y: cmd.y };
          else if (!cmd.alt) pl.pending = { action: 'walk', x: cmd.x, y: cmd.y };
          return;
        }
        if (a.id === 'examine') return void a.run({ g, actor: p, target, cursor: null });
        pl.pending = { action: a.id, target: target.id };
        return;
      }
      if (cmd.alt) {
        if (p.inventory!.cursor) returnCursor(g, p);
        return;
      }
      if (p.inventory!.cursor) pl.pending = { action: 'drop', x: cmd.x, y: cmd.y };
      else pl.pending = { action: 'walk', x: cmd.x, y: cmd.y };
      return;
    }
    case 'autoAct':
      if (asleep) return;
      if (!pl.pending) autoAct(g, p);
      return;
    case 'autoAttack': {
      if (asleep) return;
      const t = g.world.spatial.nearest(p.x, p.y, 10, (e) => ACTIONS.attack.test({ g, actor: p, target: e, cursor: null }) && (hasTag(prefab(e.prefab), 'hostile') || e.combat?.target === p.id));
      if (t) pl.pending = { action: 'attack', target: t.id };
      return;
    }
    case 'craft':
      return craft(g, p, cmd.recipe);
    case 'place':
      pl.pending = { action: 'build', x: cmd.x, y: cmd.y };
      return;
    case 'cancelPlace':
      pl.placing = null;
      if (p.inventory!.cursor && ITEMS.get(p.inventory!.cursor.id)?.deploy) returnCursor(g, p);
      return;
    case 'slot':
      return clickSlot(g, p, cmd.ref, cmd.alt, cmd.split);
    case 'useSlot': {
      const s = p.inventory!.slots[cmd.i];
      if (s) useStack(g, p, { where: 'inv', i: cmd.i }, s);
      return;
    }
    case 'dropCursor':
      pl.pending = { action: 'drop', x: cmd.x, y: cmd.y };
      return;
    case 'returnCursor':
      return returnCursor(g, p);
    case 'closeContainer':
      g.openContainer = null;
      g.events.emit('openContainer', { id: null });
      return;
    case 'cook': {
      const pot = g.world.get(cmd.id);
      if (pot?.cooker && dist(pot.x, pot.y, p.x, p.y) < 4) startCooking(g, pot);
      return;
    }
  }
}

export function returnCursor(g: Game, p: Entity): void {
  const inv = p.inventory!;
  const cur = inv.cursor;
  if (!cur) return;
  const left = giveItem(inv, { ...cur });
  if (left > 0) dropStack(g, { ...cur, n: left }, p.x, p.y, 0.5);
  inv.cursor = null;
  g.events.emit('inv', {});
}

function wake(g: Game, p: Entity): void {
  if (p.state?.name === 'sleep') setState(g, p, 'idle');
}

/** Space bar: find something nearby worth doing. */
function autoAct(g: Game, p: Entity): void {
  const pl = p.player!;
  let best: Entity | undefined;
  let bestA: ActionDef | undefined;
  let bestD = Infinity;
  const order = ['pickup', 'pick', 'harvest', 'chop', 'mine', 'dig'];
  g.world.spatial.forEachInRadius(p.x, p.y, 9, (e, d2) => {
    if (e === p || d2 >= bestD) return;
    const a = resolveAction(g, p, e, false);
    if (!a || !order.includes(a.id)) return;
    if (a.id === 'dig' && e.prefab === 'grave_mound') return;
    best = e;
    bestA = a;
    bestD = d2;
  });
  if (best && bestA) pl.pending = { action: bestA.id, target: best.id };
}

// ------------------------------------------------------------------ per-tick controller
export function updatePlayer(g: Game, p: Entity, dt: number): void {
  const pl = p.player!;
  const loco = p.locomotor!;
  const st = p.state!;
  if (st.name === 'dead') {
    loco.vx = loco.vy = 0;
    return;
  }
  if (st.name === 'sleep') {
    loco.vx = loco.vy = 0;
    const kind = st.data?.kind;
    addHunger(p, -T.HUNGER_RATE * dt); // extra hunger cost while asleep
    addSanity(p, (kind === 'tent' ? 1 : 0.5) * dt);
    if (kind === 'tent') addHealth(p, 0.2 * dt);
    if (g.clock.phase === 'day' || (p.hunger?.cur ?? 0) <= 0) setState(g, p, 'idle');
    return;
  }
  // timed states: work/pickup/eat/build/hit
  if (st.until !== undefined && g.time < st.until && st.name !== 'walk' && st.name !== 'idle') {
    loco.vx = loco.vy = 0;
    // allow WASD to interrupt work
    if ((pl.moveDx || pl.moveDy) && (st.name === 'work' || st.name === 'pickup')) setState(g, p, 'idle');
    else return;
  }
  if (st.until !== undefined && g.time >= st.until && st.name !== 'idle' && st.name !== 'walk') {
    const doneAction = st.name === 'work' || st.name === 'pickup' || st.name === 'build' ? st.data?.action : null;
    setState(g, p, 'idle');
    if (doneAction && pl.pending) completeAction(g, p, doneAction);
  }

  const speed = loco.walk * speedMult(g, p);
  // keyboard movement has priority
  if (pl.moveDx || pl.moveDy) {
    const len = Math.hypot(pl.moveDx!, pl.moveDy!) || 1;
    loco.dest = null;
    loco.vx = (pl.moveDx! / len) * speed;
    loco.vy = (pl.moveDy! / len) * speed;
    if (loco.vx) p.facing = loco.vx > 0 ? 1 : -1;
    if (p.state!.name !== 'walk') setState(g, p, 'walk');
    return;
  }
  const pend = pl.pending;
  if (!pend) {
    loco.vx = loco.vy = 0;
    loco.dest = null;
    if (p.state!.name === 'walk') setState(g, p, 'idle');
    return;
  }

  // resolve target position & range
  let tx = pend.x ?? p.x;
  let ty = pend.y ?? p.y;
  let range = 0.3;
  let target: Entity | undefined;
  let action: ActionDef | undefined;
  if (pend.target !== undefined) {
    target = g.world.get(pend.target);
    action = actionById(pend.action);
    if (!target || !action || (!action.test({ g, actor: p, target, cursor: p.inventory!.cursor }) && pend.action !== 'attack') || (pend.action === 'attack' && !isAlive(g, target))) {
      pl.pending = null;
      return;
    }
    tx = target.x;
    ty = target.y;
    const tr = prefab(target.prefab).radius ?? 0.3;
    range = pend.action === 'attack' ? (p.combat!.range + tr) * 0.95 : action.range + tr + 0.2;
  } else if (pend.action === 'build') {
    range = 2.2;
  } else if (pend.action === 'drop') {
    range = 1;
  }

  const d = dist(p.x, p.y, tx, ty);
  if (d > range) {
    const dx = (tx - p.x) / d;
    const dy = (ty - p.y) / d;
    loco.vx = dx * speed;
    loco.vy = dy * speed;
    if (Math.abs(dx) > 0.1) p.facing = dx > 0 ? 1 : -1;
    if (p.state!.name !== 'walk') setState(g, p, 'walk');
    // give up on unreachable points (stuck)
    const moved = pl.lastPos ? dist(pl.lastPos[0], pl.lastPos[1], p.x, p.y) : 1;
    pl.stuck = moved < speed * dt * 0.2 ? (pl.stuck ?? 0) + dt : 0;
    pl.lastPos = [p.x, p.y];
    if ((pl.stuck ?? 0) > 1.2) {
      pl.pending = null;
      pl.stuck = 0;
    }
    return;
  }
  loco.vx = loco.vy = 0;
  if (p.state!.name === 'walk') setState(g, p, 'idle');
  if (target) p.facing = target.x >= p.x ? 1 : -1;

  switch (pend.action) {
    case 'walk':
      pl.pending = null;
      return;
    case 'drop': {
      const cur = p.inventory!.cursor;
      if (cur) {
        dropStack(g, cur, tx, ty, 0.1);
        p.inventory!.cursor = null;
        g.sfx('drop', tx, ty);
        g.events.emit('inv', {});
      }
      pl.pending = null;
      return;
    }
    case 'build':
      setState(g, p, 'build', 0.5, { action: 'build' });
      return;
    case 'attack':
      if (target) startAttack(g, p, target);
      return;
  }
  if (action && target) {
    if (action.time <= 0) {
      action.run({ g, actor: p, target, cursor: p.inventory!.cursor });
      pl.pending = null;
      return;
    }
    setState(g, p, action.state, action.time, { action: action.id, target: target.id });
  }
}

function completeAction(g: Game, p: Entity, actionId: string): void {
  const pl = p.player!;
  const pend = pl.pending!;
  if (actionId === 'build') {
    build(g, p, pend.x!, pend.y!);
    pl.pending = null;
    return;
  }
  const target = g.world.get(pend.target);
  const a = actionById(actionId);
  if (!a || !target) {
    pl.pending = null;
    return;
  }
  if (!a.test({ g, actor: p, target, cursor: p.inventory!.cursor })) {
    pl.pending = null;
    return;
  }
  const again = a.run({ g, actor: p, target, cursor: p.inventory!.cursor });
  if (!again || !g.world.has(target)) pl.pending = null;
}

export function speedMult(g: Game, p: Entity): number {
  let m = 1;
  const tile = g.tileAt(p.x, p.y);
  if (tile === 8) m *= 1.3; // road
  if (tile === 5) m *= 0.85; // marsh
  const eq = p.inventory?.equip;
  for (const s of [eq?.hand, eq?.body, eq?.head]) {
    const sp = s ? ITEMS.get(s.id)?.equip?.speed : undefined;
    if (sp) m *= sp;
  }
  return m;
}

export function itemName(id: string): string {
  return item(id).name;
}
