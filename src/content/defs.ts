import type { EquipSlot, WorkAction, Entity } from '../sim/types';

export type FoodType = 'meat' | 'veggie' | 'generic' | 'seeds' | 'monster' | 'raw';

export interface FoodDef {
  health: number;
  hunger: number;
  sanity: number;
  type: FoodType;
  /** body temperature effect: degrees delta for `tempTime` seconds */
  temp?: number;
  tempTime?: number;
}

/** Cook Pot ingredient values (DS "food tags") */
export type CookTag = 'meat' | 'monster' | 'veggie' | 'fruit' | 'egg' | 'sweet' | 'fish' | 'inedible' | 'frozen' | 'seed' | 'flower';

export interface ItemDef {
  id: string;
  name: string;
  stack: number;
  tags?: string[];
  food?: FoodDef;
  /** result when cooked on a fire */
  cooked?: string;
  /** result on a drying rack, and days to dry */
  dried?: string;
  dryDays?: number;
  /** total perish time in seconds */
  perish?: number;
  /** what this spoils into (default: rot) */
  spoilsTo?: string;
  /** fuel value in fire-pit seconds */
  fuel?: number;
  equip?: {
    slot: EquipSlot;
    insulation?: number; // winter
    summer?: number; // summer insulation
    waterproof?: number; // 0..1
    sanity?: number; // per minute
    speed?: number; // multiplier
    light?: number; // light radius while equipped
    heat?: number;
  };
  tool?: Partial<Record<WorkAction, number>>; // efficiency multiplier
  weapon?: { damage: number };
  armor?: { absorb: number; hp: number };
  /** number of uses (tools/weapons) */
  uses?: number;
  /** seconds of use for fueled equipment (torch) or wearables with finite time */
  time?: number;
  cook?: Partial<Record<CookTag, number>>;
  /** place into world as a prefab (seeds, pinecones, walls) */
  deploy?: string;
  heal?: number;
  /** can be given to hogfolk to befriend */
  hogTreat?: boolean;
  desc?: string;
}

export interface PrefabDef {
  id: string;
  name: string;
  tags?: string[];
  /** radius for collision (0 = walk through) */
  radius?: number;
  /** components copied onto the entity at spawn */
  components?: Partial<Entity>;
  /** Work action → loot on finish */
  workLoot?: LootEntry[];
  /** loot on death (mobs) */
  loot?: LootEntry[];
  /** pickable product */
  pick?: { item: string; n: number; regrow: number; sanity?: number; remove?: boolean };
  burnable?: { time: number; becomes?: string; loot?: LootEntry[] };
  sanityAura?: number; // per minute at close range
  light?: { radius: number; intensity: number; color?: string };
  heat?: number;
  /** combat hit reaction */
  hostile?: boolean;
  /** brain id */
  brain?: string;
  examine?: string;
  /** visual size in world units (sprite height) */
  size?: number;
  /** map icon color */
  mapColor?: string;
  /** called on spawn for custom setup */
  init?: (e: Entity) => void;
  /** number of work units initially */
  work?: { action: WorkAction; amount: number };
  container?: number;
  /** structures can be hammered */
  structure?: boolean;
  /** hammer loot fraction of recipe */
  hammerLoot?: LootEntry[];
}

export interface LootEntry {
  item: string;
  n?: number;
  chance?: number;
}

export type Tab = 'tools' | 'light' | 'survival' | 'food' | 'science' | 'fight' | 'structures' | 'refine' | 'dress';

export interface Recipe {
  id: string;
  tab: Tab;
  tech: number; // 0 hand, 1 tinker's bench, 2 alembic engine
  ingredients: [string, number][];
  /** item produced */
  item?: string;
  n?: number;
  /** prefab placed in world */
  place?: string;
  desc: string;
}

export const ITEMS = new Map<string, ItemDef>();
export const PREFABS = new Map<string, PrefabDef>();
export const RECIPES = new Map<string, Recipe>();

export function defineItems(list: ItemDef[]): void {
  for (const d of list) {
    // tools and weapons are held in the hand
    if (!d.equip && (d.tool || d.weapon)) d.equip = { slot: 'hand' };
    ITEMS.set(d.id, d);
  }
}
export function definePrefabs(list: PrefabDef[]): void {
  for (const d of list) PREFABS.set(d.id, d);
}
export function defineRecipes(list: Recipe[]): void {
  for (const d of list) RECIPES.set(d.id, d);
}

export function item(id: string): ItemDef {
  const d = ITEMS.get(id);
  if (!d) throw new Error(`unknown item '${id}'`);
  return d;
}
export function prefab(id: string): PrefabDef {
  const d = PREFABS.get(id);
  if (!d) throw new Error(`unknown prefab '${id}'`);
  return d;
}
export function hasTag(def: { tags?: string[] } | undefined, tag: string): boolean {
  return !!def?.tags?.includes(tag);
}
