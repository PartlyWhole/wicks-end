/** Dev-only helpers for playtesting from the console (`dbg.*`). Not included in production builds. */
import type { Game } from './sim/game';
import { giveItem, makeStack } from './sim/inventory';
import { spawn } from './sim/spawn';
import { T } from './content/tuning';

export function installDebug(getGame: () => Game | null, cam: () => { x: number; y: number } | null): void {
  const g = () => getGame()!;
  const api = {
    give(id: string, n = 1) {
      giveItem(g().player.inventory!, makeStack(id, n));
      g().events.emit('inv', {});
    },
    tp(prefabId: string) {
      const G = g();
      const p = G.player;
      let best = null;
      let bd = Infinity;
      for (const e of G.world.entities.values()) {
        if (e.prefab !== prefabId) continue;
        const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      if (!best) return 'none';
      p.x = best.x + 4;
      p.y = best.y + 3;
      G.world.moved(p);
      const c = cam();
      if (c) {
        c.x = p.x;
        c.y = p.y;
      }
      return best.id;
    },
    spawn(prefabId: string, dx = 3, dy = 0) {
      const p = g().player;
      return spawn(g(), prefabId, p.x + dx, p.y + dy).id;
    },
    /** jump to a phase of the current day: 'day' | 'dusk' | 'night' */
    phase(ph: string, day?: number) {
      const G = g();
      const d = day ?? G.clock.day;
      const [a, b] = G.clock.segs;
      const tod = ph === 'day' ? 30 : ph === 'dusk' ? a * T.SEG + 5 : (a + b) * T.SEG + 25;
      G.time = d * T.DAY + tod;
    },
    day(n: number) {
      g().time = n * T.DAY + 30;
    },
    god() {
      const p = g().player;
      p.health!.cur = p.health!.max;
      p.hunger!.cur = p.hunger!.max;
      p.sanity!.cur = p.sanity!.max;
    },
    near(r = 12) {
      const G = g();
      const p = G.player;
      return G.world.spatial.inRadius(p.x, p.y, r).map((e) => `${e.prefab}#${e.id} d=${Math.hypot(e.x - p.x, e.y - p.y).toFixed(1)} ${e.state?.name ?? ''}`);
    },
  };
  (window as any).dbg = api;
}
