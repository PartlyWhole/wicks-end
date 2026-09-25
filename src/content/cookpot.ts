import { ITEMS, type CookTag } from './defs';

export type Tags = Partial<Record<CookTag, number>>;

export interface CookRecipe {
  id: string;
  priority: number;
  /** cook time in seconds */
  time: number;
  test: (t: Tags, names: Record<string, number>) => boolean;
}

const has = (t: Tags, k: CookTag) => (t[k] ?? 0) > 0;
const v = (t: Tags, k: CookTag) => t[k] ?? 0;

/** Cook Pot recipes (priorities and requirements from KB 04, adapted to our ingredients). */
export const COOK_RECIPES: CookRecipe[] = [
  { id: 'monsterlasagna', priority: 10, time: 10, test: (t) => v(t, 'monster') >= 2 && !has(t, 'inedible') },
  { id: 'kabobs', priority: 5, time: 40, test: (t, n) => has(t, 'meat') && (n.twigs ?? 0) === 1 && v(t, 'monster') <= 1 && v(t, 'inedible') <= 1 },
  { id: 'pumpkinstew', priority: 10, time: 20, test: (t, n) => (n.pumpkin ?? 0) + (n.pumpkin_cooked ?? 0) >= 1 && v(t, 'veggie') >= 2 && !has(t, 'meat') && !has(t, 'inedible') },
  { id: 'frogbun', priority: 1, time: 40, test: (t, n) => (n.froglegs ?? 0) + (n.froglegs_cooked ?? 0) >= 1 && v(t, 'veggie') >= 0.5 },
  { id: 'stuffedeggplant', priority: 1, time: 40, test: (t, n) => (n.eggplant ?? 0) + (n.eggplant_cooked ?? 0) >= 1 && v(t, 'veggie') >= 1.5 && !has(t, 'meat') },
  { id: 'meatystew', priority: 0, time: 15, test: (t) => v(t, 'meat') >= 3 && !has(t, 'inedible') },
  { id: 'meatballs', priority: -1, time: 15, test: (t) => has(t, 'meat') && !has(t, 'inedible') },
  { id: 'fruitmedley', priority: 0, time: 10, test: (t) => v(t, 'fruit') >= 3 && !has(t, 'meat') && !has(t, 'veggie') },
  { id: 'berryjam', priority: 0, time: 10, test: (t) => v(t, 'fruit') >= 0.5 && !has(t, 'meat') && !has(t, 'veggie') && !has(t, 'inedible') },
  { id: 'ratatouille', priority: 0, time: 20, test: (t) => v(t, 'veggie') >= 0.5 && !has(t, 'meat') && !has(t, 'inedible') },
];

export const FALLBACK = { id: 'wetgoop', time: 5 };

export function isCookable(id: string): boolean {
  return !!ITEMS.get(id)?.cook;
}

export function sumTags(ingredients: string[]): { tags: Tags; names: Record<string, number> } {
  const tags: Tags = {};
  const names: Record<string, number> = {};
  for (const id of ingredients) {
    names[id] = (names[id] ?? 0) + 1;
    const c = ITEMS.get(id)?.cook;
    if (!c) continue;
    for (const [k, val] of Object.entries(c) as [CookTag, number][]) tags[k] = (tags[k] ?? 0) + val;
  }
  return { tags, names };
}

/**
 * Resolve 4 ingredients into a dish. Highest-priority matching recipes win;
 * ties are broken by `rand` (like DS, which picks randomly among equal priorities).
 */
export function resolveCook(ingredients: string[], rand: () => number = Math.random): { id: string; time: number } {
  const { tags, names } = sumTags(ingredients);
  const matches = COOK_RECIPES.filter((r) => r.test(tags, names));
  if (!matches.length) return FALLBACK;
  const top = Math.max(...matches.map((m) => m.priority));
  const best = matches.filter((m) => m.priority === top);
  const pick = best[Math.floor(rand() * best.length)];
  return { id: pick.id, time: pick.time };
}
