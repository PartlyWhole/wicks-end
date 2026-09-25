import { T } from '../../content/tuning';
import type { Game, System } from '../game';
import { spawn } from '../spawn';
import { isDead } from '../combat';
import { TILE } from '../tiles';

/** Hound waves: scale with days survived (KB 01 §18), warned by growls. */
function houndInterval(g: Game): [number, number] {
  const d = g.clock.day + 1;
  if (d <= 10) return [5, 8];
  if (d <= 25) return [5, 10];
  if (d <= 50) return [7, 12];
  return [9, 14];
}

function houndCount(g: Game): number {
  const d = g.clock.day + 1;
  const base = d <= 10 ? 2 : d <= 25 ? g.rng.int(3, 4) : d <= 50 ? g.rng.int(4, 6) : g.rng.int(5, 7);
  return Math.max(1, base + (g.settings.difficulty - 1));
}

function spawnPointNear(g: Game, x: number, y: number, dist: number): [number, number] | null {
  for (let i = 0; i < 20; i++) {
    const a = g.rng.range(0, Math.PI * 2);
    const px = x + Math.cos(a) * dist;
    const py = y + Math.sin(a) * dist;
    if (g.walkable(px, py)) return [px, py];
  }
  return null;
}

export const threatSystem: System = {
  name: 'threats',
  interval: 0.5,
  update(g) {
    const p = g.player;
    if (isDead(p)) return;
    const h = g.hounds;

    // ---------------- hounds
    if (!h.nextAt) h.nextAt = (T.HOUND_FIRST_DAY + g.rng.range(0, 2)) * T.DAY + g.rng.range(0, T.DAY);
    const warnLen = g.clock.day < 10 ? 90 : T.HOUND_WARN;
    if (!h.toSpawn && g.time >= h.nextAt - warnLen && g.time < h.nextAt) {
      if (g.time - h.warned > (h.nextAt - g.time < 20 ? 6 : 14)) {
        h.warned = g.time;
        const loud = 1 - (h.nextAt - g.time) / warnLen;
        g.sfx('growl', p.x, p.y, Math.round(loud * 100));
        if (loud < 0.4 && g.rng.chance(0.6)) g.say(p, 'houndWarn');
      }
    }
    if (!h.toSpawn && g.time >= h.nextAt) {
      h.toSpawn = houndCount(g);
      h.spawnAt = g.time;
      const [a, b] = houndInterval(g);
      h.nextAt = g.time + g.rng.range(a, b) * T.DAY;
      g.say(p, 'houndClose');
    }
    if (h.toSpawn && g.time >= h.spawnAt) {
      const pt = spawnPointNear(g, p.x, p.y, T.HOUND_SPAWN_DIST * 0.7);
      if (pt) {
        const e = spawn(g, 'hound', pt[0], pt[1], { wave: true });
        e.combat!.target = p.id;
        e.combat!.aggroUntil = g.time + 9999;
      }
      h.toSpawn--;
      h.spawnAt = g.time + g.rng.range(3, 8);
    }

    // ---------------- Frostmaw: once per winter, mid-season, telegraphed by roars
    const G = g.giant;
    const year = Math.floor(g.clock.day / Object.values(g.settings.seasonLengths).reduce((a, b) => a + b, 0));
    if (g.clock.season === 'winter' && G.year !== year && g.clock.seasonP > 0.3 && g.clock.seasonP < 0.7 && g.clock.phase === 'day') {
      if (!G.warnAt) {
        G.warnAt = g.time;
        G.spawnAt = g.time + 50;
        G.warned = 0;
      }
      if (g.time - G.warned > 12 && g.time < G.spawnAt) {
        G.warned = g.time;
        g.sfx('roar', p.x, p.y, Math.round((1 - (G.spawnAt - g.time) / 50) * 100));
        g.events.emit('fx', { kind: 'quake', x: p.x, y: p.y });
        g.say(p, 'giantWarn');
      }
      if (g.time >= G.spawnAt) {
        const pt = spawnPointNear(g, p.x, p.y, 22);
        if (pt) {
          const e = spawn(g, 'frostmaw', pt[0], pt[1], { ttl: g.time + T.DAY * 1.5 });
          G.id = e.id;
          G.year = year;
          G.warnAt = 0;
          g.say(p, 'giantHere');
          g.sfx('roar', pt[0], pt[1], 100);
        }
      }
    }
    // the giant leaves when winter ends
    if (g.clock.season !== 'winter' && G.id) {
      const e = g.world.get(G.id);
      if (e && !e.ttl) g.world.set(e, 'ttl', g.time + 3);
      G.id = 0;
    }

    // ---------------- shadow creatures while insane
    const s = p.sanity!;
    const shadows = [...g.world.query('shadow')];
    if (s.insane) {
      const frac = s.cur / s.max;
      const max = frac < 0.1 ? 2 : 1;
      const alive = shadows.filter((e) => !isDead(e));
      if (alive.length < max && g.rng.chance(0.08)) {
        const pt = spawnPointNear(g, p.x, p.y, g.rng.range(12, 18));
        if (pt) spawn(g, frac < 0.1 && g.rng.chance(0.5) ? 'dread_beak' : 'crawling_dread', pt[0], pt[1]);
      }
    } else {
      // fade away when you regain your wits
      for (const e of shadows) if (!e.ttl) g.world.set(e, 'ttl', g.time + 2);
    }

    // ---------------- ambient birds by day
    if (g.clock.phase === 'day' && g.weather.precip < 0.5 && g.rng.chance(0.03)) {
      let birds = 0;
      g.world.spatial.forEachInRadius(p.x, p.y, 20, (e) => {
        if (e.prefab === 'crow') birds++;
      });
      if (birds < 3) {
        const pt = spawnPointNear(g, p.x, p.y, g.rng.range(7, 14));
        if (pt) {
          const tile = g.tileAt(pt[0], pt[1]);
          if (tile !== TILE.MARSH) {
            const b = spawn(g, 'crow', pt[0], pt[1], { ttl: g.time + g.rng.range(40, 90) });
            b.brain!.bb.landing = g.time;
          }
        }
      }
    }
  },
};
