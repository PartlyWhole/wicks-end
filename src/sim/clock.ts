import { T, type Season } from '../content/tuning';
import { clamp, lerp, smoothstep } from '../engine/math';

export type Phase = 'day' | 'dusk' | 'night';

export interface ClockState {
  /** 0-based day index */
  day: number;
  /** seconds into the current day */
  tod: number;
  /** 0..1 fraction of the day */
  frac: number;
  phase: Phase;
  segs: [number, number, number];
  season: Season;
  /** 0..1 progress through the season */
  seasonP: number;
  /** days remaining in season */
  seasonDaysLeft: number;
  /** ambient light 0 (black) .. 1 (full day) */
  light: number;
  /** 0..1 how "night" it is (for temperature) */
  nightness: number;
  /** ambient air temperature */
  ambient: number;
}

export function seasonAt(day: number, lengths: Record<string, number>): { season: Season; p: number; left: number } {
  const order = T.SEASONS;
  const year = order.reduce((s, k) => s + lengths[k], 0);
  let d = day % year;
  for (const s of order) {
    const len = lengths[s];
    if (d < len) return { season: s, p: (d + 0.5) / len, left: len - d };
    d -= len;
  }
  return { season: 'autumn', p: 0, left: lengths.autumn };
}

function blendSegs(season: Season, p: number): [number, number, number] {
  const order = T.SEASONS;
  const i = order.indexOf(season);
  const prev = T.SEASON_SEGS[order[(i + 3) % 4]];
  const cur = T.SEASON_SEGS[season];
  const next = T.SEASON_SEGS[order[(i + 1) % 4]];
  const [a, b, t] = p < 0.5 ? [prev, cur, 0.5 + p] : [cur, next, p - 0.5];
  const day = Math.round(lerp(a[0], b[0], t));
  const dusk = Math.round(lerp(a[1], b[1], t));
  const night = 16 - day - dusk;
  return [day, dusk, Math.max(1, night)];
}

function seasonTemp(season: Season, p: number): number {
  const [a, m, b] = T.SEASON_TEMP[season];
  return p < 0.5 ? lerp(a, m, p * 2) : lerp(m, b, (p - 0.5) * 2);
}

export function computeClock(time: number, lengths: Record<string, number>): ClockState {
  const day = Math.floor(time / T.DAY);
  const tod = time - day * T.DAY;
  const { season, p, left } = seasonAt(day, lengths);
  const segs = blendSegs(season, p);
  const dayEnd = segs[0] * T.SEG;
  const duskEnd = (segs[0] + segs[1]) * T.SEG;
  const phase: Phase = tod < dayEnd ? 'day' : tod < duskEnd ? 'dusk' : 'night';

  // Light curve: dawn ramp, day 1, dusk fades to ~0.45, night drops to 0 over 20 s.
  let light: number;
  if (phase === 'day') light = lerp(0.35, 1, smoothstep(0, 20, tod));
  else if (phase === 'dusk') light = lerp(1, 0.5, smoothstep(dayEnd, dayEnd + 25, tod));
  else light = Math.max(lerp(0.5, 0, smoothstep(duskEnd, duskEnd + 20, tod)), lerp(0, 0.35, smoothstep(T.DAY - 20, T.DAY, tod)));

  const nightness = phase === 'night' ? 1 : phase === 'dusk' ? 0.4 : clamp(1 - tod / 60, 0, 0.6);
  // warmest in the middle of the day segment
  const midday = phase === 'day' ? Math.sin(Math.min(1, tod / dayEnd) * Math.PI) * 4 : 0;
  const ambient = seasonTemp(season, p) - T.NIGHT_TEMP_DROP * nightness + midday;

  return { day, tod, frac: tod / T.DAY, phase, segs, season, seasonP: p, seasonDaysLeft: left, light, nightness, ambient };
}
