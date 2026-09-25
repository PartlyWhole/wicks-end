import type { Game } from './game';

/** Is it a full-moon night? (moon cycle of 20 days, full on day 11 of each cycle) */
export function moonPhase(day: number): number {
  return (day % 20) / 20;
}

export function isFullMoon(day: number): boolean {
  const d = day % 20;
  return d === 10;
}

/** Light level at a point: ambient + all light sources within range (0..1+). */
export function lightAt(g: Game, x: number, y: number): number {
  let l = g.clock.light;
  if (g.clock.phase === 'night' && isFullMoon(g.clock.day)) l = Math.max(l, 0.22);
  if (l >= 1) return l;
  g.world.spatial.forEachInRadius(x, y, 14, (e, d2) => {
    const li = e.light;
    if (!li) return;
    const d = Math.sqrt(d2);
    if (d >= li.radius) return;
    const inner = li.radius * 0.6;
    const f = d <= inner ? 1 : 1 - (d - inner) / (li.radius - inner);
    l += li.intensity * f;
  });
  return l;
}
