import { ITEMS, hasTag, item, prefab } from '../content/defs';
import { T } from '../content/tuning';
import type { Game } from './game';
import type { Entity, StateName, Stack } from './types';
import { addSanity, isAlive, isDead, setState } from './combat';
import { dropLoot, dropStack, removeEntity, spawn, TREE_STAGES } from './spawn';
import { giveItem, makeStack } from './inventory';
import { ignite } from './systems/fire';
import { resolveCook } from '../content/cookpot';

export interface Ctx {
  g: Game;
  actor: Entity;
  target?: Entity;
  cursor: Stack | null;
}

export interface ActionDef {
  id: string;
  verb: string | ((c: Ctx) => string);
  /** reach beyond the target's radius */
  range: number;
  /** seconds the action takes (per repetition) */
  time: number;
  state: StateName;
  test(c: Ctx): boolean;
  /** perform; return true to repeat (chopping) */
  run(c: Ctx): boolean | void;
}

const hand = (e: Entity) => e.inventory?.equip.hand ?? null;
const toolFor = (e: Entity, action: string): number => {
  const h = hand(e);
  return (h && (ITEMS.get(h.id)?.tool as any)?.[action]) || 0;
};

/** Give an item to the actor, dropping at their feet when full. */
export function giveOrDrop(g: Game, e: Entity, s: Stack): void {
  const left = e.inventory ? giveItem(e.inventory, s) : s.n;
  if (left > 0) dropStack(g, { ...s, n: left }, e.x, e.y, 0.5);
  g.events.emit('inv', {});
}

function takeCursor(c: Ctx, n = 1): Stack {
  const inv = c.actor.inventory!;
  const s = inv.cursor!;
  const out = { ...s, n };
  s.n -= n;
  if (s.n <= 0) inv.cursor = null;
  c.g.events.emit('inv', {});
  return out;
}

function name(e: Entity): string {
  if (e.item) return item(e.item.id).name;
  return prefab(e.prefab).name;
}

// ------------------------------------------------------------------ work
function finishWork(g: Game, target: Entity, actor: Entity): void {
  const def = prefab(target.prefab);
  const action = target.workable!.action;
  if (target.prefab === 'pine_tree') {
    const stage = TREE_STAGES[target.growable?.stage ?? 1];
    dropLoot(g, stage.loot, target.x, target.y);
    g.events.emit('fx', { kind: 'treefall', x: target.x, y: target.y, data: { facing: actor.x < target.x ? 1 : -1, stage: target.growable?.stage } });
    g.sfx('treefall', target.x, target.y);
    removeEntity(g, target);
    if ((target.growable?.stage ?? 1) > 0) spawn(g, 'pine_stump', target.x, target.y);
    return;
  }
  if (action === 'hammer') {
    dropLoot(g, def.hammerLoot, target.x, target.y);
    if (target.container) for (const s of target.container.slots) if (s) dropStack(g, s, target.x, target.y, 1.4);
    if (target.dryer?.item) dropStack(g, makeStack(target.dryer.item), target.x, target.y);
    if (g.openContainer === target.id) {
      g.openContainer = null;
      g.events.emit('openContainer', { id: null });
    }
    g.events.emit('fx', { kind: 'collapse', x: target.x, y: target.y });
    g.sfx('collapse', target.x, target.y);
    removeEntity(g, target);
    return;
  }
  dropLoot(g, def.workLoot, target.x, target.y);
  if (target.prefab === 'grave_mound') addSanity(actor, -10);
  if (action === 'mine') g.events.emit('fx', { kind: 'rubble', x: target.x, y: target.y });
  if (target.prefab === 'rabbit_hole' || target.prefab === 'spider_den') {
    for (const id of target.spawner?.children ?? []) {
      const c = g.world.get(id);
      if (c?.home) c.home.id = 0;
    }
  }
  removeEntity(g, target);
}

const work = (id: 'chop' | 'mine' | 'dig' | 'hammer', verb: string): ActionDef => ({
  id,
  verb,
  range: 1.2,
  time: T.PLAYER_WORK_TIME,
  state: 'work',
  test: ({ actor, target, cursor }) =>
    !cursor && !!target?.workable && target.workable.action === id && toolFor(actor, id) > 0 && !target.burnable?.burning,
  run: ({ g, actor, target }) => {
    const t = target!;
    const eff = toolFor(actor, id);
    if (!eff) return false;
    t.workable!.left -= eff;
    const tool = hand(actor)!;
    const tdef = ITEMS.get(tool.id)!;
    if (tdef.uses && tool.dur !== undefined) {
      tool.dur -= 1 / tdef.uses;
      if (tool.dur <= 0.0001) {
        actor.inventory!.equip.hand = null;
        g.say(actor, 'toolBroke');
        g.events.emit('inv', {});
      }
    }
    g.sfx(id, t.x, t.y, t.id);
    g.events.emit('fx', { kind: id, x: t.x, y: t.y, data: { id: t.id } });
    if (t.workable!.left <= 0) {
      finishWork(g, t, actor);
      return false;
    }
    // chopping trees has a small chance to anger nothing yet; repeat
    return !!hand(actor);
  },
});

// ------------------------------------------------------------------ primary actions
export const ACTIONS: Record<string, ActionDef> = {
  give: {
    id: 'give',
    verb: 'Give',
    range: 1.2,
    time: 0.3,
    state: 'pickup',
    test: ({ g, target, cursor }) =>
      !!cursor && !!target && target.prefab === 'hog' && !!ITEMS.get(cursor.id)?.hogTreat && isAlive(g, target) && !(target.combat?.target === g.player.id),
    run: ({ g, actor, target, cursor }) => {
      const t = target!;
      const food = ITEMS.get(cursor!.id)!.food!;
      takeCursor({ g, actor, target, cursor });
      const now = Math.max(g.time, t.follower?.leader === actor.id ? t.follower.until : g.time);
      const until = Math.min(now + food.hunger * 19.2, g.time + 2.5 * T.DAY);
      g.world.set(t, 'follower', { leader: actor.id, until });
      if (t.brain) t.brain.bb.eatUntil = g.time + 1;
      g.sfx('eat', t.x, t.y);
      g.say(actor, 'hogFriend');
      g.say(t, g.rng.pick(['Friend!', 'Yum. Follow you.', 'Good meat!']), true);
    },
  },
  addfuel: {
    id: 'addfuel',
    verb: 'Add Fuel',
    range: 1.2,
    time: 0.25,
    state: 'pickup',
    test: ({ target, cursor }) => !!cursor && !!target?.fueled && !!ITEMS.get(cursor.id)?.fuel,
    run: (c) => {
      const t = c.target!;
      const fuel = ITEMS.get(c.cursor!.id)!.fuel!;
      const camp = t.prefab === 'campfire';
      const max = camp ? T.CAMPFIRE_MAX : T.FIREPIT_MAX;
      takeCursor(c);
      t.fueled!.fuel = Math.min(max, t.fueled!.fuel + fuel * (camp ? 0.5 : 1));
      c.g.sfx('fuel', t.x, t.y);
      c.g.events.emit('fx', { kind: 'flare', x: t.x, y: t.y });
    },
  },
  cookfire: {
    id: 'cookfire',
    verb: 'Cook',
    range: 1.2,
    time: 0.5,
    state: 'work',
    test: ({ target, cursor }) => !!cursor && !!target && hasTag(prefab(target.prefab), 'cookfire') && (target.fueled?.fuel ?? 0) > 0 && !!ITEMS.get(cursor.id)?.cooked,
    run: (c) => {
      const s = takeCursor(c);
      const out = makeStack(ITEMS.get(s.id)!.cooked!);
      if (s.fresh !== undefined && out.fresh !== undefined) out.fresh = Math.max(0.3, s.fresh);
      giveOrDrop(c.g, c.actor, out);
      c.g.sfx('cook', c.target!.x, c.target!.y);
    },
  },
  dry: {
    id: 'dry',
    verb: 'Hang',
    range: 1.2,
    time: 0.3,
    state: 'pickup',
    test: ({ target, cursor }) => !!cursor && !!target?.dryer && !target.dryer.item && !!ITEMS.get(cursor.id)?.dried,
    run: (c) => {
      const s = takeCursor(c);
      const d = ITEMS.get(s.id)!;
      c.target!.dryer = { item: d.dried, until: c.g.time + (d.dryDays ?? 1) * T.DAY, ready: false };
      c.g.sfx('pickup', c.target!.x, c.target!.y);
    },
  },
  plant: {
    id: 'plant',
    verb: 'Plant',
    range: 1.2,
    time: 0.4,
    state: 'pickup',
    test: ({ target, cursor }) => !!cursor && cursor.id === 'seeds' && !!target?.farm && !target.farm.crop,
    run: (c) => {
      takeCursor(c);
      const g = c.g;
      const crop = g.rng.weighted([
        ['carrot', 3],
        ['corn', 3],
        ['pumpkin', 2],
        ['eggplant', 2],
        ['watermelon', 2],
      ] as const);
      c.target!.farm = { crop, plantedAt: g.time, ready: false };
      g.sched.add(g.time + T.FARM_GROW * g.rng.range(0.85, 1.15), c.target!.id, 'farm');
      g.sfx('dig', c.target!.x, c.target!.y);
    },
  },
  fertilize: {
    id: 'fertilize',
    verb: 'Fertilize',
    range: 1.2,
    time: 0.4,
    state: 'pickup',
    test: ({ target, cursor }) => !!cursor && hasTag(ITEMS.get(cursor.id), 'fertilizer') && !!target?.pickable?.barren,
    run: (c) => {
      takeCursor(c);
      const p = c.target!.pickable!;
      p.barren = false;
      p.cycles = T.BERRY_CYCLES;
      c.g.sched.add(c.g.time + T.BERRY_REGROW * 0.5, c.target!.id, 'regrow');
      c.g.sfx('dig', c.target!.x, c.target!.y);
    },
  },
  shave: {
    id: 'shave',
    verb: 'Shave',
    range: 1.4,
    time: 0.8,
    state: 'work',
    test: ({ target, cursor }) => !!cursor && hasTag(ITEMS.get(cursor.id), 'razor') && !!target?.shaveable,
    run: ({ g, actor, target }) => {
      const t = target!;
      if (t.state?.name !== 'sleep') {
        g.say(actor, 'It won’t hold still while it’s awake.', true);
        return;
      }
      if (g.time < t.shaveable!.woolAt) {
        g.say(actor, 'Nothing left to shave. Poor thing.', true);
        return;
      }
      t.shaveable!.woolAt = g.time + T.WOOL_REGROW;
      dropStack(g, makeStack('wool', 3), t.x, t.y, 1.4);
      g.sfx('shave', t.x, t.y);
    },
  },
  harvest: {
    id: 'harvest',
    verb: 'Harvest',
    range: 1.2,
    time: 0.3,
    state: 'pickup',
    test: ({ target, cursor }) =>
      !cursor && !!target && (!!target.cooker?.ready || !!target.dryer?.ready || !!target.farm?.ready || !!target.trap?.caught),
    run: ({ g, actor, target }) => {
      const t = target!;
      if (t.cooker?.ready) {
        giveOrDrop(g, actor, makeStack(t.cooker.result!));
        t.cooker = {};
      } else if (t.dryer?.ready) {
        giveOrDrop(g, actor, makeStack(t.dryer.item!));
        t.dryer = {};
      } else if (t.farm?.ready) {
        giveOrDrop(g, actor, makeStack(t.farm.crop!));
        if (g.rng.chance(0.3)) giveOrDrop(g, actor, makeStack('seeds'));
        t.farm = {};
      } else if (t.trap?.caught) {
        giveOrDrop(g, actor, makeStack(t.trap.caught));
        t.trap = { set: true };
      }
      g.sfx('pickup', t.x, t.y);
    },
  },
  pickup: {
    id: 'pickup',
    verb: 'Pick up',
    range: 0.8,
    time: 0.15,
    state: 'pickup',
    test: ({ target, cursor }) => !cursor && !!target?.item,
    run: ({ g, actor, target }) => {
      const t = target!;
      const s = t.item!;
      const left = giveItem(actor.inventory!, { ...s });
      if (left >= s.n) {
        g.say(actor, 'full');
        return;
      }
      g.sfx('pickup', t.x, t.y);
      if (left > 0) s.n = left;
      else removeEntity(g, t);
      g.events.emit('inv', {});
    },
  },
  pick: {
    id: 'pick',
    verb: 'Pick',
    range: 1.1,
    time: 0.4,
    state: 'pickup',
    test: ({ target, cursor }) => !cursor && !!target?.pickable?.ready && !target.burnable?.burning,
    run: ({ g, actor, target }) => {
      const t = target!;
      const def = prefab(t.prefab);
      const pick = def.pick!;
      giveOrDrop(g, actor, makeStack(pick.item, pick.n));
      if (pick.sanity) addSanity(actor, pick.sanity);
      g.sfx('pick', t.x, t.y);
      if (pick.remove) {
        const respawn = t.prefab === 'carrot_plant' ? T.CARROT_RESPAWN : T.FLOWER_RESPAWN;
        g.sched.add(g.time + respawn * g.rng.range(0.7, 1.3), 0, `respawn|${t.prefab}|${t.x.toFixed(1)}|${t.y.toFixed(1)}`);
        removeEntity(g, t);
        return;
      }
      t.pickable!.ready = false;
      if (t.pickable!.cycles !== undefined) {
        t.pickable!.cycles--;
        if (t.pickable!.cycles <= 0) {
          t.pickable!.barren = true;
          return;
        }
      }
      g.sched.add(g.time + pick.regrow * g.rng.range(0.85, 1.15), t.id, 'regrow');
    },
  },
  chop: work('chop', 'Chop'),
  mine: work('mine', 'Mine'),
  dig: work('dig', 'Dig'),
  hammer: work('hammer', 'Hammer'),
  open: {
    id: 'open',
    verb: 'Open',
    range: 1.3,
    time: 0.1,
    state: 'pickup',
    test: ({ target, cursor }) => !cursor && !!target?.container && !target.cooker?.until,
    run: ({ g, target }) => {
      g.openContainer = target!.id;
      g.events.emit('openContainer', { id: target!.id });
      g.sfx('open', target!.x, target!.y);
    },
  },
  store: {
    id: 'store',
    verb: 'Store',
    range: 1.3,
    time: 0.1,
    state: 'pickup',
    test: ({ target, cursor }) => !!cursor && !!target?.container && !target.cooker?.until,
    run: ({ g, target }) => {
      g.openContainer = target!.id;
      g.events.emit('openContainer', { id: target!.id });
    },
  },
  sleep: {
    id: 'sleep',
    verb: 'Sleep',
    range: 1.5,
    time: 0.2,
    state: 'pickup',
    test: ({ target, cursor }) => !cursor && !!target && hasTag(prefab(target.prefab), 'bed'),
    run: ({ g, actor }) => {
      trySleep(g, actor, 'tent');
    },
  },
  attack: {
    id: 'attack',
    verb: 'Attack',
    range: 0,
    time: 0,
    state: 'attack',
    test: ({ g, actor, target, cursor }) => {
      if (cursor || !target || target === actor || !target.health || isDead(target)) return false;
      if (target.shadow && !g.player.sanity?.insane) return false;
      if (target.follower?.leader === actor.id) return false;
      if (hasTag(prefab(target.prefab), 'structure') || target.prefab === 'spider_den') return !!target.prefab.startsWith('spider');
      return true;
    },
    run: () => true,
  },
};

// ------------------------------------------------------------------ alternate (right-click) actions
export const ALT_ACTIONS: Record<string, ActionDef> = {
  light: {
    id: 'light',
    verb: 'Light',
    range: 1.4,
    time: 0.5,
    state: 'work',
    test: ({ actor, target }) => !!target?.burnable && !target.burnable.burning && hasTag(ITEMS.get(hand(actor)?.id ?? ''), 'lighter'),
    run: ({ g, target }) => ignite(g, target!),
  },
  extinguish: {
    id: 'extinguish',
    verb: 'Stamp Out',
    range: 1.2,
    time: 0.5,
    state: 'work',
    test: ({ target }) => !!target?.burnable && (!!target.burnable.smolderUntil || target.burnable.burning) && target.prefab !== 'campfire',
    run: ({ g, target }) => {
      const b = target!.burnable!;
      b.smolderUntil = undefined;
      if (b.burning && g.rng.chance(0.5)) {
        b.burning = false;
        b.until = undefined;
        if (target!.light && !prefab(target!.prefab).light) g.world.unset(target!, 'light');
      }
      g.sfx('stomp', target!.x, target!.y);
    },
  },
  examine: {
    id: 'examine',
    verb: 'Examine',
    range: 999,
    time: 0,
    state: 'idle',
    test: ({ target }) => !!target,
    run: ({ g, actor, target }) => {
      g.say(actor, examineText(g, target!), true);
      g.events.emit('discover', { id: target!.item ? target!.item.id : target!.prefab });
    },
  },
};

export function examineText(g: Game, t: Entity): string {
  if (t.item) return ITEMS.get(t.item.id)?.desc ?? `It's ${item(t.item.id).name}.`;
  const def = prefab(t.prefab);
  if (t.burnable?.burning) return 'It’s on fire! Obviously.';
  if (t.burnable?.smolderUntil) return 'It’s smoking. That’s bad.';
  if (t.pickable?.barren) return 'It needs some fertilizer.';
  if (t.pickable && !t.pickable.ready) return 'Picked clean. It’ll grow back.';
  if (t.fueled) {
    const f = t.fueled.fuel / (t.prefab === 'campfire' ? T.CAMPFIRE_MAX : T.FIREPIT_MAX);
    if (f <= 0) return 'Just cold ashes. It needs fuel.';
    if (f < 0.25) return 'The fire is dying. It needs more fuel.';
    if (f > 0.75) return 'Roaring! Toasty.';
  }
  if (t.follower?.leader === g.player.id) return 'My good friend. For now.';
  if (t.shaveable && t.state?.name === 'sleep') return g.time >= t.shaveable.woolAt ? 'Asleep. That wool looks shaveable.' : 'Sleeping, and freshly shorn.';
  if (t.cooker?.until) return 'Almost ready. Smells... interesting.';
  if (t.farm?.crop && !t.farm.ready) return 'Something is growing.';
  if (t.prefab === 'pine_tree' && t.growable) return ['Just a baby.', def.examine, 'A towering old pine.'][t.growable.stage] ?? def.examine!;
  return def.examine ?? `It's a ${def.name}.`;
}

export function trySleep(g: Game, actor: Entity, kind: 'tent' | 'roll'): boolean {
  if (g.clock.phase === 'day') {
    g.say(actor, 'cantSleepDay');
    return false;
  }
  if ((actor.hunger?.cur ?? 0) < 25) {
    g.say(actor, 'cantSleepHungry');
    return false;
  }
  let danger = false;
  g.world.spatial.forEachInRadius(actor.x, actor.y, 14, (o) => {
    if (o.combat?.target === actor.id || (hasTag(prefab(o.prefab), 'hostile') && !isDead(o) && !o.shadow)) danger = true;
  });
  if (danger) {
    g.say(actor, 'cantSleepDanger');
    return false;
  }
  setState(g, actor, 'sleep', undefined, { kind });
  actor.player!.pending = null;
  g.sfx('sleep', actor.x, actor.y);
  return true;
}

// ------------------------------------------------------------------ resolution
const PRIMARY_ORDER = ['give', 'addfuel', 'cookfire', 'dry', 'plant', 'fertilize', 'shave', 'store', 'harvest', 'pickup', 'pick', 'chop', 'mine', 'dig', 'hammer', 'open', 'sleep', 'attack'];
const ALT_ORDER = ['light', 'extinguish', 'examine'];

export function resolveAction(g: Game, actor: Entity, target: Entity | undefined, alt: boolean, force = false): ActionDef | null {
  const c: Ctx = { g, actor, target, cursor: actor.inventory?.cursor ?? null };
  if (force && ACTIONS.attack.test(c)) return ACTIONS.attack;
  const order = alt ? ALT_ORDER : PRIMARY_ORDER;
  const table = alt ? ALT_ACTIONS : ACTIONS;
  for (const id of order) {
    const a = table[id];
    if (!a.test(c)) continue;
    // plain clicks only attack things that are hostile, or anything when forced
    if (id === 'attack' && !force && !hasTag(prefab(target!.prefab), 'hostile') && target!.combat?.target !== actor.id) continue;
    return a;
  }
  return null;
}

export function actionById(id: string): ActionDef | undefined {
  return ACTIONS[id] ?? ALT_ACTIONS[id];
}

export function verbFor(a: ActionDef, g: Game, actor: Entity, target?: Entity): string {
  const v = typeof a.verb === 'function' ? a.verb({ g, actor, target, cursor: actor.inventory?.cursor ?? null }) : a.verb;
  return target ? `${v} ${name(target)}` : v;
}

/** Start cooking in a Cook Pot: consumes its 4 ingredients. */
export function startCooking(g: Game, pot: Entity): boolean {
  const slots = pot.container!.slots;
  if (slots.some((s) => !s)) return false;
  const ids = slots.map((s) => s!.id);
  const r = resolveCook(ids, () => g.rng.next());
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i]!;
    s.n--;
    if (s.n <= 0) slots[i] = null;
  }
  pot.cooker = { result: r.id, until: g.time + r.time, ready: false };
  g.world.set(pot, 'light', { radius: 2.6, intensity: 0.6, color: '#ffae5a' });
  if (g.openContainer === pot.id) {
    g.openContainer = null;
    g.events.emit('openContainer', { id: null });
  }
  g.sfx('cookpot', pot.x, pot.y);
  return true;
}

