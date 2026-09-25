import { PREFABS } from '../../content/defs';
import type { Game, System } from '../game';
import type { Entity } from '../types';

const radiusOf = (e: Entity) => PREFABS.get(e.prefab)?.radius ?? 0;

/** Integrates velocity, steers toward `dest`, and resolves collisions against water and static obstacles. */
export const locomotionSystem: System = {
  name: 'locomotion',
  update(g, dt) {
    for (const e of g.world.query('locomotor')) {
      const l = e.locomotor!;
      if (!e.player && !g.inAwakeRange(e)) continue;
      if (l.dest && !e.player) {
        const dx = l.dest.x - e.x;
        const dy = l.dest.y - e.y;
        const d = Math.hypot(dx, dy);
        if (d < 0.25) {
          l.dest = null;
          l.vx = l.vy = 0;
        } else {
          const sp = l.running ? l.run : l.walk;
          l.vx = (dx / d) * sp;
          l.vy = (dy / d) * sp;
        }
      }
      if (!l.vx && !l.vy) continue;
      if (e.state && (e.state.name === 'dead' || e.state.name === 'sleep')) {
        l.vx = l.vy = 0;
        continue;
      }
      if (l.vx) e.facing = l.vx > 0 ? 1 : -1;
      move(g, e, l.vx * dt, l.vy * dt);
    }
  },
};

export function move(g: Game, e: Entity, mx: number, my: number): void {
  const r = Math.max(radiusOf(e), 0.3);
  const flying = e.prefab === 'crow';
  let nx = e.x + mx;
  let ny = e.y + my;
  if (!flying) {
    // water: slide along coast by trying each axis separately
    if (!walkableR(g, nx, ny, r)) {
      if (walkableR(g, nx, e.y, r)) ny = e.y;
      else if (walkableR(g, e.x, ny, r)) nx = e.x;
      else {
        nx = e.x;
        ny = e.y;
      }
    }
    // static obstacles: push out
    if (!e.shadow) {
      g.world.spatial.forEachInRadius(nx, ny, r + 2.6, (o) => {
        if (o === e || o.locomotor || o.item) return;
        const orad = radiusOf(o);
        if (orad <= 0) return;
        const minD = orad + r * 0.8;
        const dx = nx - o.x;
        const dy = ny - o.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= minD * minD) return;
        const d = Math.sqrt(d2) || 0.001;
        const push = minD - d;
        nx += (dx / d) * push;
        ny += (dy / d) * push;
      });
      if (!walkableR(g, nx, ny, r)) {
        nx = e.x;
        ny = e.y;
      }
    }
  }
  e.x = nx;
  e.y = ny;
  g.world.moved(e);
}

function walkableR(g: Game, x: number, y: number, r: number): boolean {
  return g.walkable(x, y) && g.walkable(x + r, y) && g.walkable(x - r, y) && g.walkable(x, y + r) && g.walkable(x, y - r);
}
