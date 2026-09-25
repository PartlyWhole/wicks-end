import { prefab, type LootEntry } from '../content/defs';
import { T } from '../content/tuning';
import type { Game } from './game';
import type { Entity, Stack } from './types';
import { makeStack, maxStack, newInventory } from './inventory';

const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

/** Pine tree stages: work amount and loot per growth stage (KB 06). */
export const TREE_STAGES = [
  { work: 5, loot: [{ item: 'log' }] as LootEntry[], size: 3 },
  { work: 10, loot: [{ item: 'log', n: 2 }, { item: 'pinecone' }] as LootEntry[], size: 5 },
  { work: 15, loot: [{ item: 'log', n: 3 }, { item: 'pinecone', n: 2 }] as LootEntry[], size: 6.5 },
];

/** Create an entity from a prefab definition and add it to the world. */
export function spawn(g: Game, id: string, x: number, y: number, extra?: Partial<Entity>): Entity {
  const def = prefab(id);
  const e: Entity = { id: 0, prefab: id, x, y, facing: g.rng.chance(0.5) ? 1 : -1, v: g.rng.int(0, 7) };
  if (def.components) Object.assign(e, clone(def.components));
  if (def.work) e.workable = { action: def.work.action, left: def.work.amount };
  else if (def.structure) e.workable = { action: 'hammer', left: 4 };
  if (def.pick) e.pickable = { ready: true, cycles: id === 'berrybush' ? T.BERRY_CYCLES : undefined };
  if (def.burnable) e.burnable = { burning: false };
  if (def.light) e.light = { ...def.light };
  if (def.container) e.container = { slots: Array(def.container).fill(null) };
  if (def.brain) e.brain = { id: def.brain, bb: {} };
  if (e.locomotor || e.combat) e.state = { name: 'idle', t0: g.time };
  if (id === 'shagbeast') e.shaveable = { woolAt: 0 };
  if (id === 'player') {
    e.inventory = newInventory();
    e.player = {
      name: 'Silas',
      known: [],
      darkSince: null,
      nextHushAt: null,
      pending: null,
      placing: null,
      stats: { daysSurvived: 0, crafted: 0, killed: 0 },
      lastSay: -99,
    };
  }
  if (extra) Object.assign(e, extra);
  if (id === 'pine_tree') {
    const st = TREE_STAGES[e.growable!.stage];
    e.workable!.left = st.work;
  }
  g.world.add(e);
  def.init?.(e);
  return e;
}

export function removeEntity(g: Game, e: Entity): void {
  g.world.remove(e);
}

/** Drop a stack as a world item near (x,y), splitting into max-size stacks. */
export function dropStack(g: Game, s: Stack, x: number, y: number, scatter = 0.8): Entity[] {
  const out: Entity[] = [];
  let n = s.n;
  const max = maxStack(s.id);
  while (n > 0) {
    const k = Math.min(n, max);
    n -= k;
    const a = g.rng.next() * Math.PI * 2;
    const r = scatter * Math.sqrt(g.rng.next());
    let px = x + Math.cos(a) * r;
    let py = y + Math.sin(a) * r;
    if (!g.walkable(px, py)) {
      px = x;
      py = y;
    }
    const e = spawn(g, 'item', px, py, { item: { ...s, n: k } });
    e.v = 0;
    out.push(e);
  }
  return out;
}

export function rollLoot(g: Game, table: LootEntry[] | undefined): Stack[] {
  const out: Stack[] = [];
  if (!table) return out;
  for (const l of table) {
    if (l.chance !== undefined && !g.rng.chance(l.chance)) continue;
    out.push(makeStack(l.item, l.n ?? 1));
  }
  return out;
}

export function dropLoot(g: Game, table: LootEntry[] | undefined, x: number, y: number): void {
  for (const s of rollLoot(g, table)) dropStack(g, s, x, y, 1.2);
}

export function dropItemId(g: Game, id: string, n: number, x: number, y: number): void {
  dropStack(g, makeStack(id, n), x, y);
}
