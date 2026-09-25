import type { BaseEntity } from '../engine/ecs';

/** An item stack living in an inventory/container. Becomes an `item` entity when dropped. */
export interface Stack {
  id: string;
  n: number;
  /** freshness 0..1 (perishables) */
  fresh?: number;
  /** durability 0..1 (tools, weapons, armor, fueled equipment) */
  dur?: number;
  /** stored temperature (thermal stone) */
  temp?: number;
}

export type EquipSlot = 'hand' | 'body' | 'head';
export type WorkAction = 'chop' | 'mine' | 'dig' | 'hammer';

export interface Inventory {
  slots: (Stack | null)[];
  equip: { hand: Stack | null; body: Stack | null; head: Stack | null };
  /** Extra slots when a backpack is worn */
  pack: (Stack | null)[] | null;
  /** stack held on the cursor (DS "active item") */
  cursor: Stack | null;
}

export type StateName =
  | 'idle'
  | 'walk'
  | 'work'
  | 'attack'
  | 'hit'
  | 'eat'
  | 'dead'
  | 'sleep'
  | 'pickup'
  | 'build';

export interface Entity extends BaseEntity {
  facing?: number; // -1 left, 1 right
  /** prefab variant (visual) */
  v?: number;

  health?: { cur: number; max: number; lastHit?: number; invulnUntil?: number };
  hunger?: { cur: number; max: number };
  sanity?: { cur: number; max: number; insane?: boolean };
  temperature?: { cur: number };
  wetness?: { cur: number };

  locomotor?: {
    walk: number;
    run: number;
    running?: boolean;
    vx: number;
    vy: number;
    dest?: { x: number; y: number } | null;
    /** preferred steering side when circling obstacles */
    side?: number;
  };

  combat?: {
    damage: number;
    period: number;
    range: number;
    target?: number;
    cooldownUntil: number;
    /** time until which the entity keeps aggro after being hit */
    aggroUntil?: number;
  };

  brain?: { id: string; bb: Record<string, any> };
  state?: { name: StateName; t0: number; until?: number; data?: any };

  inventory?: Inventory;
  container?: { slots: (Stack | null)[] };

  workable?: { action: WorkAction; left: number };
  pickable?: { ready: boolean; cycles?: number; barren?: boolean };
  growable?: { stage: number };
  burnable?: { burning: boolean; until?: number; smolderUntil?: number };
  fueled?: { fuel: number };
  light?: { radius: number; intensity: number; color?: string };

  item?: Stack;
  follower?: { leader: number; until: number };
  leader?: { followers: number[] };
  home?: { id: number };
  spawner?: { children: number[]; stock: number };

  cooker?: { result?: string; until?: number; ready?: boolean };
  dryer?: { item?: string; until?: number; ready?: boolean };
  farm?: { crop?: string; plantedAt?: number; ready?: boolean };
  shaveable?: { woolAt: number };
  trap?: { set: boolean; caught?: string };
  /** For hounds: part of a wave targeting the player */
  wave?: boolean;
  /** Only real (attackable, attacking) while player is insane */
  shadow?: boolean;
  /** despawn time for transient entities (dropped rot, ambient birds) */
  ttl?: number;
  /** player-only data */
  player?: PlayerData;
}

export interface PlayerData {
  name: string;
  known: string[];
  /** in darkness since (sim time) or null */
  darkSince: number | null;
  nextHushAt: number | null;
  /** queued action (walk-then-act) */
  pending: PendingAction | null;
  /** current placement preview recipe */
  placing: string | null;
  stats: { daysSurvived: number; crafted: number; killed: number; cause?: string };
  lastSay: number;
  /** keyboard movement direction */
  moveDx?: number;
  moveDy?: number;
  lastPos?: [number, number];
  stuck?: number;
  /** temporary body-temperature effect from hot/cold food */
  foodTemp?: { delta: number; until: number };
  /** phase of the last threshold warnings (avoid spam) */
  warned?: Record<string, number>;
  /** light level at the player's position (for UI/FX) */
  light?: number;
}

export interface PendingAction {
  action: string;
  target?: number;
  x?: number;
  y?: number;
  slot?: number;
  item?: string;
}
