import { describe, expect, it } from 'vitest';
import { newGame, serialize, deserialize } from '../src/sim/create';
import { spawn } from '../src/sim/spawn';
import { countItem, giveItem, makeStack } from '../src/sim/inventory';
import { resolveCook } from '../src/content/cookpot';
import { T } from '../src/content/tuning';
import { TILE } from '../src/sim/tiles';
import type { Game } from '../src/sim/game';
import type { Entity } from '../src/sim/types';

const DT = 1 / T.SIM_HZ;
function run(g: Game, seconds: number): void {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) g.tick(DT);
}
function clearAround(g: Game, p: Entity, r = 12): void {
  for (const e of g.world.spatial.inRadius(p.x, p.y, r)) if (e !== p) g.world.remove(e);
}

describe('world generation', () => {
  const g = newGame('test-world');
  it('creates a walkable spawn with a varied island', () => {
    expect(g.walkable(g.player.x, g.player.y)).toBe(true);
    const counts = new Map<number, number>();
    for (const t of g.tiles) counts.set(t, (counts.get(t) ?? 0) + 1);
    for (const b of [TILE.MEADOW, TILE.PINEWOOD, TILE.PLAINS, TILE.ROCKY, TILE.MARSH]) expect(counts.get(b) ?? 0).toBeGreaterThan(50);
    expect(g.world.entities.size).toBeGreaterThan(2000);
  });
  it('places the basic resources near spawn', () => {
    const near = g.world.spatial.inRadius(g.player.x, g.player.y, 22);
    const has = (p: string) => near.some((e) => e.prefab === p || e.item?.id === p);
    for (const p of ['grass', 'sapling', 'flint', 'pine_tree', 'boulder', 'berrybush']) expect(has(p), p).toBe(true);
  });
  it('is deterministic for a seed', () => {
    const g2 = newGame('test-world');
    expect(g2.world.entities.size).toBe(g.world.entities.size);
    expect(Buffer.from(g2.tiles).equals(Buffer.from(g.tiles))).toBe(true);
  });
});

describe('gathering and crafting', () => {
  it('picks grass, crafts an axe, and chops a tree', () => {
    const g = newGame('craft');
    const p = g.player;
    clearAround(g, p);
    const grass = spawn(g, 'grass', p.x + 2, p.y);
    g.queue({ t: 'click', alt: false, target: grass.id, x: grass.x, y: grass.y });
    run(g, 2);
    expect(countItem(p.inventory!, 'cutgrass')).toBe(1);
    expect(grass.pickable!.ready).toBe(false);

    giveItem(p.inventory!, makeStack('twigs', 1));
    giveItem(p.inventory!, makeStack('flint', 1));
    g.queue({ t: 'craft', recipe: 'axe' });
    run(g, 0.1);
    expect(countItem(p.inventory!, 'axe')).toBe(1);
    expect(countItem(p.inventory!, 'flint')).toBe(0);

    const slot = p.inventory!.slots.findIndex((s) => s?.id === 'axe');
    g.queue({ t: 'useSlot', i: slot });
    run(g, 0.1);
    expect(p.inventory!.equip.hand?.id).toBe('axe');

    const tree = spawn(g, 'pine_tree', p.x - 2, p.y, { growable: { stage: 1 } });
    tree.workable!.left = 10;
    g.queue({ t: 'click', alt: false, target: tree.id, x: tree.x, y: tree.y });
    run(g, 12);
    expect(g.world.has(tree)).toBe(false);
    const logs = g.world.spatial.inRadius(tree.x, tree.y, 3, (e) => e.item?.id === 'log');
    expect(logs.length).toBeGreaterThan(0);
    expect(g.world.spatial.inRadius(tree.x, tree.y, 0.5, (e) => e.prefab === 'pine_stump').length).toBe(1);
  });

  it('requires a Tinker’s Bench to prototype, then remembers', () => {
    const g = newGame('proto');
    const p = g.player;
    clearAround(g, p);
    giveItem(p.inventory!, makeStack('cutgrass', 6));
    g.queue({ t: 'craft', recipe: 'rope' });
    run(g, 0.1);
    expect(countItem(p.inventory!, 'rope')).toBe(0);
    const bench = spawn(g, 'tinkers_bench', p.x + 2, p.y);
    p.sanity!.cur = 100;
    const s0 = p.sanity!.cur;
    g.queue({ t: 'craft', recipe: 'rope' });
    run(g, 0.1);
    expect(countItem(p.inventory!, 'rope')).toBe(1);
    expect(p.sanity!.cur).toBeGreaterThan(s0 + 10);
    g.world.remove(bench);
    g.queue({ t: 'craft', recipe: 'rope' });
    run(g, 0.1);
    expect(countItem(p.inventory!, 'rope')).toBe(2);
  });

  it('places a campfire through placement mode', () => {
    const g = newGame('place');
    const p = g.player;
    clearAround(g, p);
    giveItem(p.inventory!, makeStack('cutgrass', 3));
    giveItem(p.inventory!, makeStack('log', 2));
    g.queue({ t: 'craft', recipe: 'campfire' });
    run(g, 0.1);
    expect(p.player!.placing).toBe('campfire');
    g.queue({ t: 'place', x: p.x + 1.5, y: p.y });
    run(g, 2);
    expect([...g.world.query('fueled')].some((e) => e.prefab === 'campfire')).toBe(true);
    expect(countItem(p.inventory!, 'log')).toBe(0);
  });
});

describe('survival', () => {
  it('drains hunger at 75 per day and starves', () => {
    const g = newGame('hunger');
    const p = g.player;
    const h0 = p.hunger!.cur;
    run(g, 60);
    expect(h0 - p.hunger!.cur).toBeCloseTo(75 / 8, 0);
    p.hunger!.cur = 0;
    const hp = p.health!.cur;
    run(g, 4);
    expect(hp - p.health!.cur).toBeGreaterThan(4);
  });

  it('the Hush strikes in total darkness, but not near a fire', () => {
    const g = newGame('dark');
    const p = g.player;
    clearAround(g, p, 20);
    g.time = T.DAY - 60; // deep night in autumn
    run(g, 1);
    expect(g.clock.phase).toBe('night');
    const hp = p.health!.cur;
    run(g, 12);
    expect(p.health!.cur).toBeLessThanOrEqual(hp - 100);

    const g2 = newGame('dark2');
    const p2 = g2.player;
    clearAround(g2, p2, 20);
    spawn(g2, 'firepit', p2.x + 2, p2.y);
    g2.time = T.DAY - 60;
    run(g2, 12);
    expect(p2.health!.cur).toBe(p2.health!.max);
  });

  it('eating stale and spoiled food is worse', () => {
    const g = newGame('eat');
    const p = g.player;
    p.hunger!.cur = 50;
    giveItem(p.inventory!, makeStack('meat_cooked', 1));
    const i = p.inventory!.slots.findIndex((s) => s?.id === 'meat_cooked');
    g.queue({ t: 'useSlot', i });
    run(g, 0.1);
    expect(p.hunger!.cur).toBeCloseTo(75, 0);
    const spoiled = makeStack('meat_cooked', 1);
    spoiled.fresh = 0.1;
    giveItem(p.inventory!, spoiled);
    const s0 = p.sanity!.cur;
    run(g, 1);
    const j = p.inventory!.slots.findIndex((s) => s?.id === 'meat_cooked');
    g.queue({ t: 'useSlot', i: j });
    run(g, 0.1);
    expect(p.sanity!.cur).toBeLessThan(s0 - 5);
  });

  it('food spoils into rot', () => {
    const g = newGame('spoil');
    const p = g.player;
    giveItem(p.inventory!, makeStack('berries', 3));
    run(g, 6 * T.DAY * 0.02);
    const s = p.inventory!.slots.find((x) => x?.id === 'berries')!;
    s.fresh = 0.0001;
    run(g, 2);
    expect(countItem(p.inventory!, 'rot')).toBe(3);
  });

  it('freezes in deep winter without insulation', () => {
    const g = newGame('winter');
    const p = g.player;
    clearAround(g, p, 20);
    g.time = 28 * T.DAY + 100;
    g.player.temperature!.cur = 10;
    run(g, 30);
    expect(p.temperature!.cur).toBeLessThan(0);
  });
});

describe('cook pot', () => {
  it('matches recipes by tags and priority', () => {
    expect(resolveCook(['meat', 'berries', 'berries', 'berries']).id).toBe('meatballs');
    expect(resolveCook(['meat', 'meat', 'meat', 'carrot']).id).toBe('meatystew');
    expect(resolveCook(['monstermeat', 'monstermeat', 'carrot', 'carrot']).id).toBe('monsterlasagna');
    expect(resolveCook(['meat', 'twigs', 'carrot', 'carrot']).id).toBe('kabobs');
    expect(resolveCook(['carrot', 'carrot', 'berries', 'berries']).id).toBe('ratatouille');
    expect(resolveCook(['twigs', 'twigs', 'twigs', 'twigs']).id).toBe('wetgoop');
    expect(resolveCook(['berries', 'berries', 'berries', 'berries']).id).toBe('berryjam');
  });
});

describe('combat', () => {
  it('player kills a spider with a spear and gets loot', () => {
    const g = newGame('fight');
    const p = g.player;
    clearAround(g, p, 25);
    p.inventory!.equip.hand = makeStack('spear');
    const sp = spawn(g, 'spider', p.x + 2, p.y);
    g.queue({ t: 'autoAttack' });
    for (let i = 0; i < 20 && g.world.has(sp) && sp.health!.cur > 0; i++) {
      run(g, 0.5);
      if (!p.player!.pending) g.queue({ t: 'autoAttack' });
    }
    expect(sp.health!.cur).toBe(0);
    expect(p.health!.cur).toBeGreaterThan(0);
  });

  it('armor absorbs damage', () => {
    const g = newGame('armor');
    const p = g.player;
    p.inventory!.equip.body = makeStack('logsuit');
    const hound = spawn(g, 'hound', p.x + 1, p.y);
    const before = p.health!.cur;
    hound.combat!.target = p.id;
    // direct damage call through the combat module
    return import('../src/sim/combat').then(({ damage }) => {
      damage(g, p, 50, hound);
      expect(before - p.health!.cur).toBeCloseTo(10, 5);
      expect(p.inventory!.equip.body!.dur!).toBeLessThan(1);
    });
  });
});

describe('long run & persistence', () => {
  it('survives 10 headless days without exceptions, entity count bounded', () => {
    const g = newGame('long');
    const p = g.player;
    // keep the player alive to exercise systems
    const n0 = g.world.entities.size;
    for (let d = 0; d < 10; d++) {
      p.health!.cur = p.health!.max;
      p.hunger!.cur = p.hunger!.max;
      p.sanity!.cur = p.sanity!.max;
      p.temperature!.cur = 30;
      run(g, T.DAY);
    }
    expect(g.clock.day).toBe(10);
    expect(g.world.entities.size).toBeLessThan(n0 * 1.3);
  }, 120_000);

  it('round-trips a save', () => {
    const g = newGame('save');
    run(g, 30);
    giveItem(g.player.inventory!, makeStack('log', 7));
    const json = serialize(g);
    const g2 = deserialize(json);
    expect(g2.world.entities.size).toBe(g.world.entities.size);
    expect(countItem(g2.player.inventory!, 'log')).toBe(7);
    expect(g2.time).toBeCloseTo(g.time);
    run(g2, 5);
  });
});
