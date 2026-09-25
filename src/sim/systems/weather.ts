import { T } from '../../content/tuning';
import { clamp } from '../../engine/math';
import type { System } from '../game';
import { ignite } from './fire';
import { damage } from '../combat';

/**
 * Weather: a simple rain state machine per season (rain spells with a sine intensity),
 * snow cover in winter, lightning in spring storms.
 */
export const weatherSystem: System = {
  name: 'weather',
  interval: 0.5,
  update(g, dt) {
    const w = g.weather;
    const season = g.clock.season;
    if (g.time >= w.nextRoll && !w.raining) {
      w.nextRoll = g.time + g.rng.range(60, 150);
      if (g.time > T.DAY * 1.2 && g.rng.chance(T.RAIN_CHANCE[season] * 0.35)) {
        w.raining = true;
        w.rainStart = g.time;
        const len = season === 'spring' ? g.rng.range(180, 420) : g.rng.range(90, 240);
        w.rainEnd = g.time + len;
        g.sfx('rain_start', 0, 0);
      }
    }
    if (w.raining) {
      const s = w.rainStart;
      const e = w.rainEnd;
      const t = clamp((g.time - s) / (e - s), 0, 1);
      const peak = season === 'spring' ? 1 : season === 'summer' ? 0.5 : 0.75;
      w.precip = Math.sin(t * Math.PI) ** 0.6 * peak;
      if (g.time >= e) {
        w.raining = false;
        w.precip = 0;
        w.nextRoll = g.time + g.rng.range(120, 300);
      }
    } else w.precip = Math.max(0, w.precip - dt * 0.05);

    // snow cover builds in winter, melts otherwise
    const snowing = season === 'winter' && w.precip > 0.1;
    w.snowCover = clamp(w.snowCover + (snowing ? 0.004 : season === 'winter' ? 0.0002 : -0.004) * dt, 0, 1);
    if (season === 'winter' && g.clock.seasonP > 0.15) w.snowCover = Math.max(w.snowCover, Math.min(1, (g.clock.seasonP - 0.15) * 3));

    // lightning in spring/autumn storms
    if (w.precip > 0.6 && season !== 'winter' && g.time >= w.lightningAt) {
      w.lightningAt = g.time + g.rng.range(20, 70);
      const p = g.player;
      const a = g.rng.range(0, Math.PI * 2);
      const r = g.rng.range(4, 22);
      const x = p.x + Math.cos(a) * r;
      const y = p.y + Math.sin(a) * r;
      g.events.emit('fx', { kind: 'lightning', x, y });
      g.sfx('thunder', x, y);
      const near = g.world.spatial.nearest(x, y, 3, (o) => !!o.burnable && !o.burnable.burning);
      if (near) ignite(g, near);
      if (Math.hypot(p.x - x, p.y - y) < 1.5) damage(g, p, 10, undefined, 'lightning');
    }
  },
};
