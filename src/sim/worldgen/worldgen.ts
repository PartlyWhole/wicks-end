import { T } from '../../content/tuning';
import { fbm, valueNoise } from '../../engine/noise';
import { Rng, hashString } from '../../engine/rng';
import type { Game } from '../game';
import { TILE } from '../tiles';
import { spawn, TREE_STAGES } from '../spawn';

type Density = [prefab: string, perTile: number][];

/** Content per biome (expected count per 4x4-unit tile). */
const BIOME_CONTENT: Record<number, Density> = {
  [TILE.MEADOW]: [
    ['grass', 0.12], ['sapling', 0.07], ['flower', 0.07], ['berrybush', 0.04], ['carrot_plant', 0.03],
    ['rabbit_hole', 0.012], ['pine_tree', 0.03], ['boulder', 0.006], ['item:flint', 0.01],
  ],
  [TILE.PLAINS]: [
    ['grass', 0.22], ['rabbit_hole', 0.02], ['sapling', 0.02], ['boulder', 0.008], ['item:flint', 0.008],
  ],
  [TILE.PINEWOOD]: [
    ['pine_tree', 0.42], ['sapling', 0.06], ['grass', 0.03], ['boulder', 0.01], ['spider_den', 0.0035],
    ['berrybush', 0.012], ['item:flint', 0.01], ['item:pinecone', 0.02],
  ],
  [TILE.ROCKY]: [
    ['boulder', 0.12], ['boulder_gold', 0.035], ['item:flint', 0.04], ['item:rocks', 0.02], ['grass', 0.02], ['sapling', 0.012],
  ],
  [TILE.MARSH]: [
    ['reeds', 0.07], ['pond', 0.009], ['spider_den', 0.005], ['burnt_tree', 0.02], ['grass', 0.02], ['sapling', 0.015],
  ],
  [TILE.GRAVE]: [
    ['grave', 0.025], ['burnt_tree', 0.05], ['pine_tree', 0.03], ['sapling', 0.03], ['grass', 0.025], ['berrybush', 0.015], ['boulder', 0.01],
  ],
};

interface Site {
  x: number;
  y: number;
  biome: number;
  d: number;
}

export function generateWorld(g: Game): { spawnX: number; spawnY: number } {
  const N = g.size;
  const seed = hashString(g.seed);
  const rng = new Rng(g.seed + ':world');
  const cx = N / 2;
  const cy = N / 2;

  // ---------- island mask
  const land = new Uint8Array(N * N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const dx = (x - cx) / (N / 2);
      const dy = (y - cy) / (N / 2);
      const r = Math.sqrt(dx * dx + dy * dy);
      const n = fbm(x / 22, y / 22, seed, 4);
      const edge = 0.62 + (n - 0.5) * 0.55;
      land[y * N + x] = r < edge && x > 2 && y > 2 && x < N - 3 && y < N - 3 ? 1 : 0;
    }
  // keep only the component connected to the center
  const keep = new Uint8Array(N * N);
  const stack = [Math.floor(cy) * N + Math.floor(cx)];
  land[stack[0]] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    if (keep[i] || !land[i]) continue;
    keep[i] = 1;
    const x = i % N;
    const y = (i / N) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < N - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - N);
    if (y < N - 1) stack.push(i + N);
  }

  // ---------- biome sites
  const sites: Site[] = [];
  const tries = 900;
  const minD = N / 9;
  for (let i = 0; i < tries && sites.length < 46; i++) {
    const x = rng.range(4, N - 4);
    const y = rng.range(4, N - 4);
    if (!keep[Math.floor(y) * N + Math.floor(x)]) continue;
    if (sites.some((s) => (s.x - x) ** 2 + (s.y - y) ** 2 < minD * minD)) continue;
    sites.push({ x, y, biome: 0, d: Math.hypot(x - cx, y - cy) });
  }
  sites.sort((a, b) => a.d - b.d);
  // spawn site is meadow; neighbors friendly; far ones harsher
  const pool = (d: number): [number, number][] => {
    const f = d / (N / 2);
    return [
      [TILE.MEADOW, 3 - f * 2],
      [TILE.PINEWOOD, 3],
      [TILE.PLAINS, 2.2],
      [TILE.ROCKY, 0.8 + f * 1.6],
      [TILE.MARSH, 0.4 + f * 2],
      [TILE.GRAVE, 0.2 + f * 1.2],
    ];
  };
  sites.forEach((s, i) => {
    if (i === 0) s.biome = TILE.MEADOW;
    else if (i === 1) s.biome = TILE.PINEWOOD;
    else if (i === 2) s.biome = TILE.PLAINS;
    else s.biome = rng.weighted(pool(s.d).map(([b, w]) => [b, Math.max(0.05, w)] as [number, number]));
  });
  // guarantee every biome exists at least twice
  const need = [TILE.ROCKY, TILE.MARSH, TILE.GRAVE, TILE.PLAINS, TILE.PINEWOOD, TILE.ROCKY, TILE.MARSH];
  for (const b of need) {
    const count = sites.filter((s) => s.biome === b).length;
    if (count >= 2) continue;
    const cand = sites.slice(4).filter((s) => sites.filter((t) => t.biome === s.biome).length > 3);
    if (cand.length) rng.pick(cand).biome = b;
  }

  // ---------- tiles: nearest site with warped coordinates for organic borders
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      if (!keep[i]) {
        g.tiles[i] = TILE.OCEAN;
        continue;
      }
      const wx = x + (valueNoise(x / 7, y / 7, seed + 7) - 0.5) * 12;
      const wy = y + (valueNoise(x / 7, y / 7, seed + 13) - 0.5) * 12;
      let best = sites[0];
      let bd = Infinity;
      for (const s of sites) {
        const d = (s.x - wx) ** 2 + (s.y - wy) ** 2;
        if (d < bd) {
          bd = d;
          best = s;
        }
      }
      g.tiles[i] = best.biome;
    }
  // shallows around coast
  for (let y = 1; y < N - 1; y++)
    for (let x = 1; x < N - 1; x++) {
      const i = y * N + x;
      if (g.tiles[i] !== TILE.OCEAN) continue;
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const t = g.tiles[(y + dy) * N + x + dx];
          if (t !== TILE.OCEAN && t !== TILE.SHALLOW) {
            near = true;
            break;
          }
        }
      if (near) g.tiles[i] = TILE.SHALLOW;
    }

  // ---------- roads: from spawn toward a few distant sites
  const spawnSite = sites[0];
  const far = sites.slice(3).sort(() => rng.next() - 0.5).slice(0, 3);
  for (const s of far) carveRoad(g, spawnSite.x, spawnSite.y, s.x, s.y, rng);

  // ---------- content
  const spawnX = spawnSite.x * T.TILE;
  const spawnY = spawnSite.y * T.TILE;
  const clear = 7;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const tile = g.tiles[y * N + x];
      if (tile === TILE.ROAD) continue;
      const table = BIOME_CONTENT[tile];
      if (!table) continue;
      // density modulation: patches and clearings
      const patch = fbm(x / 9, y / 9, seed + 99, 3);
      for (const [pre, rate] of table) {
        const mult = pre === 'pine_tree' ? (patch > 0.55 ? 1.6 : patch < 0.38 ? 0.25 : 1) : pre === 'grass' || pre === 'sapling' ? 0.6 + patch : 1;
        let expected = rate * mult;
        while (expected > 0) {
          const p = Math.min(1, expected);
          expected -= 1;
          if (!rng.chance(p)) continue;
          const px = (x + rng.range(0.1, 0.9)) * T.TILE;
          const py = (y + rng.range(0.1, 0.9)) * T.TILE;
          if (Math.hypot(px - spawnX, py - spawnY) < clear) continue;
          place(g, pre, px, py, rng);
        }
      }
    }

  // ---------- set pieces
  spawn(g, 'sign_start', spawnX, spawnY - 2.5);
  starterKit(g, spawnX, spawnY, rng);
  const bySite = (b: number) => sites.filter((s) => s.biome === b && s !== spawnSite);
  for (const s of bySite(TILE.PLAINS)) herd(g, s.x * T.TILE, s.y * T.TILE, rng);
  const villageSites = [...bySite(TILE.MEADOW), ...bySite(TILE.PINEWOOD)].sort((a, b) => a.d - b.d).slice(1, 3);
  for (const s of villageSites) hogVillage(g, s.x * T.TILE, s.y * T.TILE, rng);
  for (const s of sites.filter((s) => s.biome === TILE.GRAVE).slice(0, 3)) {
    const pt = freeSpot(g, s.x * T.TILE, s.y * T.TILE, 4, rng);
    if (pt) spawn(g, 'hollow_obelisk', pt[0], pt[1]);
  }

  return { spawnX, spawnY };
}

function carveRoad(g: Game, x0: number, y0: number, x1: number, y1: number, rng: Rng): void {
  const N = g.size;
  let x = x0;
  let y = y0;
  let ang = Math.atan2(y1 - y0, x1 - x0);
  for (let step = 0; step < 400; step++) {
    const want = Math.atan2(y1 - y, x1 - x);
    let da = want - ang;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    ang += da * 0.15 + rng.range(-0.25, 0.25);
    x += Math.cos(ang) * 0.7;
    y += Math.sin(ang) * 0.7;
    const i = Math.floor(y) * N + Math.floor(x);
    const t = g.tiles[i];
    if (t === TILE.OCEAN || t === TILE.SHALLOW) break;
    if (t !== TILE.MARSH) g.tiles[i] = TILE.ROAD;
    if (Math.hypot(x1 - x, y1 - y) < 2) break;
  }
}

function place(g: Game, pre: string, x: number, y: number, rng: Rng): void {
  if (!g.walkable(x, y)) return;
  if (pre.startsWith('item:')) {
    spawn(g, 'item', x, y, { item: { id: pre.slice(5), n: 1 } });
    return;
  }
  if (pre === 'grave') {
    spawn(g, 'gravestone', x, y - 0.6);
    spawn(g, 'grave_mound', x, y + 0.4);
    return;
  }
  if (pre === 'pond') {
    if (g.world.spatial.nearest(x, y, 4)) return;
    spawn(g, 'pond', x, y);
    return;
  }
  if (pre === 'spider_den') {
    if (g.world.spatial.nearest(x, y, 12, (e) => e.prefab === 'spider_den')) return;
    const e = spawn(g, 'spider_den', x, y);
    const stage = rng.chance(0.3) ? 1 : 0;
    e.growable!.stage = stage;
    e.spawner!.stock = [2, 3, 5][stage];
    g.sched.add(g.time + T.SPIDER_DEN_GROW * rng.range(0.6, 1.4), e.id, 'dengrow');
    return;
  }
  if (pre === 'pine_tree') {
    const stage = rng.weighted([[0, 1], [1, 3], [2, 2]] as [number, number][]);
    const e = spawn(g, 'pine_tree', x, y, { growable: { stage } });
    e.workable!.left = TREE_STAGES[stage].work;
    if (stage < 2) g.sched.add(T.TREE_STAGE_TIME[stage] * rng.range(0.3, 1.2), e.id, 'grow');
    return;
  }
  spawn(g, pre, x, y);
}

function freeSpot(g: Game, x: number, y: number, r: number, rng: Rng): [number, number] | null {
  for (let i = 0; i < 30; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(0, r);
    const px = x + Math.cos(a) * d;
    const py = y + Math.sin(a) * d;
    if (!g.walkable(px, py)) continue;
    if (g.world.spatial.nearest(px, py, 1.3, (e) => !e.item)) continue;
    return [px, py];
  }
  return null;
}

function starterKit(g: Game, x: number, y: number, rng: Rng): void {
  const kit: [string, number, number, number][] = [
    ['grass', 4, 5, 11],
    ['sapling', 4, 5, 11],
    ['item:flint', 3, 4, 9],
    ['berrybush', 2, 8, 14],
    ['carrot_plant', 2, 6, 12],
    ['flower', 3, 5, 10],
    ['boulder', 2, 12, 20],
    ['pine_tree', 5, 10, 18],
  ];
  for (const [pre, n, r0, r1] of kit)
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 20; k++) {
        const a = rng.range(0, Math.PI * 2);
        const d = rng.range(r0, r1);
        const px = x + Math.cos(a) * d;
        const py = y + Math.sin(a) * d;
        if (!g.walkable(px, py) || g.world.spatial.nearest(px, py, 1.2, (e) => !e.item)) continue;
        place(g, pre, px, py, rng);
        break;
      }
    }
}

function herd(g: Game, x: number, y: number, rng: Rng): void {
  const n = rng.int(3, 6);
  for (let i = 0; i < n; i++) {
    const pt = freeSpot(g, x, y, 8, rng);
    if (!pt) continue;
    const e = spawn(g, 'shagbeast', pt[0], pt[1]);
    e.brain!.bb.ax = x;
    e.brain!.bb.ay = y;
    g.sched.add(T.DAY * rng.range(0.3, 1.5), e.id, 'poop');
  }
}

function hogVillage(g: Game, x: number, y: number, rng: Rng): void {
  // clear a little space
  for (const e of g.world.spatial.inRadius(x, y, 7, (e) => e.prefab === 'pine_tree' || e.prefab === 'boulder')) g.world.remove(e);
  const n = rng.int(3, 5);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const px = x + Math.cos(a) * 5.5;
    const py = y + Math.sin(a) * 4.5;
    if (!g.walkable(px, py)) continue;
    spawn(g, 'hog_house', px, py);
  }
  spawn(g, 'hollow_obelisk', x, y);
}
