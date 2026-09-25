/**
 * Every tunable number lives here. Values follow Don't Starve (Together) where the
 * knowledge base documents them (see ../../knowledge-base/01, 04, 05); others are our own.
 * Units: seconds, world units (1 tile = 4 units), per-second rates.
 */
const SEG = 30;
const DAY = 16 * SEG; // 480 s

export const T = {
  SEG,
  DAY,
  TILE: 4,
  SIM_HZ: 30,

  // --- Player base stats (Wilson-like) ---
  PLAYER_HEALTH: 150,
  PLAYER_HUNGER: 150,
  PLAYER_SANITY: 200,
  PLAYER_WALK: 6,
  PLAYER_DAMAGE: 10,
  PLAYER_ATTACK_PERIOD: 0.4,
  PLAYER_ATTACK_RANGE: 2,
  PLAYER_WORK_TIME: 0.55, // seconds per chop/mine swing
  INTERACT_RANGE: 1.6,

  // --- Stats ---
  HUNGER_RATE: 75 / DAY, // 0.15625/s
  STARVE_DAMAGE: 1.25, // hp/s
  FREEZE_DAMAGE: 1.25,
  OVERHEAT_DAMAGE: 1.25,
  SANITY_NIGHT: -5 / 60,
  SANITY_DUSK: -5 / 60,
  SANITY_DARK: -50 / 60,
  SANITY_WET_MAX: -3.3 / 60,
  SANITY_RAIN_MAX: -3.3 / 60,
  INSANE_ENTER: 0.15,
  INSANE_EXIT: 0.175,
  SANITY_PROTOTYPE: 15,
  SANITY_PICK_FLOWER: 5,
  SANITY_SPOILED_FOOD: -10,

  // --- Darkness (the Hush) ---
  HUSH_FIRST_MIN: 5,
  HUSH_FIRST_MAX: 10,
  HUSH_NEXT_MIN: 5,
  HUSH_NEXT_MAX: 11,
  HUSH_DAMAGE: 100,
  HUSH_SANITY: -20,
  /** light level below which the player counts as "in the dark" */
  DARK_THRESHOLD: 0.08,

  // --- Temperature ---
  TEMP_MIN: -20,
  TEMP_MAX: 90,
  TEMP_START: 30,
  FREEZE_AT: 0,
  OVERHEAT_AT: 70,
  WARN_COLD: 5,
  WARN_HOT: 65,
  WET_TEMP_PENALTY: 30, // at wetness 100 (scaled)

  // --- Wetness ---
  WET_MAX: 100,
  WET_RATE_RAIN: 1, // per second at full precipitation
  DRY_RATE: 0.5,
  DRY_RATE_FIRE: 1.5,
  WET_SLIPPERY: 35,

  // --- Fire ---
  CAMPFIRE_MAX: 270,
  CAMPFIRE_START: 135,
  FIREPIT_MAX: 360,
  FIREPIT_START: 180,
  CAMPFIRE_RATE: 1, // fuel units are "fire pit seconds"; campfire burns 2x (items give half)
  FIRE_LIGHT_RADII: [3.2, 4.8, 6.4, 8],
  FIRE_HEAT: [30, 50, 70, 90], // max emitted heat by level
  FIRE_HEAT_RADIUS: 8,
  FIRE_DAMAGE: 4, // hp/s standing inside
  RAIN_FIRE_MULT: 2.5,
  TORCH_TIME: 75,
  TORCH_RADIUS: 5,
  BURN_TIME_SMALL: 6,
  BURN_TIME_TREE: 20,
  FIRE_SPREAD_RADIUS: 4.6,
  FIRE_SPREAD_CHANCE: 0.18, // per second per neighbor
  SMOLDER_TIME: 12,
  WILDFIRE_CHANCE: 0.002, // per summer-day tick per candidate (tuned in fire system)

  // --- Crafting ---
  PROTOTYPER_RANGE: 5,

  // --- Combat ---
  HIT_STUN: 0.5,
  INVULN_AFTER_HIT: 0.35,
  CORPSE_TIME: 1.2,

  // --- Growth & regrowth (days) ---
  GRASS_REGROW: 4 * DAY,
  SAPLING_REGROW: 4 * DAY,
  BERRY_REGROW: 4.7 * DAY,
  CARROT_RESPAWN: 5 * DAY,
  FLOWER_RESPAWN: 2 * DAY,
  REEDS_REGROW: 3 * DAY,
  TREE_STAGE_TIME: [2.5 * DAY, 3 * DAY, 3.5 * DAY],
  PINECONE_GROW: 1.5 * DAY,
  BERRY_CYCLES: 3, // harvests before needing fertilizer
  FARM_GROW: 2.5 * DAY,
  WOOL_REGROW: 3 * DAY,

  // --- Spawners ---
  RABBIT_HOLE_REGEN: 1 * DAY,
  HOG_HOUSE_REGEN: 4 * DAY,
  SPIDER_DEN_REGEN: 1 * DAY,
  SPIDER_DEN_GROW: 6 * DAY,

  // --- Hounds ---
  HOUND_FIRST_DAY: 6,
  HOUND_WARN: 60,
  HOUND_SPAWN_DIST: 30,

  // --- Spoilage multipliers ---
  PERISH_ICEBOX: 0.5,
  PERISH_GROUND: 1.5,
  PERISH_WINTER: 0.75,
  PERISH_SUMMER: 1.25,
  STALE_AT: 0.5,
  SPOILED_AT: 0.2,

  // --- Seasons (days) ---
  SEASONS: ['autumn', 'winter', 'spring', 'summer'] as const,
  SEASON_LENGTH: { autumn: 20, winter: 15, spring: 20, summer: 15 } as Record<string, number>,
  /** [day, dusk, night] segments at mid-season */
  SEASON_SEGS: {
    autumn: [8, 6, 2],
    winter: [5, 5, 6],
    spring: [5, 8, 3],
    summer: [11, 1, 4],
  } as Record<string, [number, number, number]>,
  /** ambient temperature [start, mid, end] of season (daytime) */
  SEASON_TEMP: {
    autumn: [32, 24, 12],
    winter: [8, -6, 6],
    spring: [12, 22, 34],
    summer: [52, 74, 56],
  } as Record<string, [number, number, number]>,
  NIGHT_TEMP_DROP: 12,
  /** chance of rain starting per game-hour-ish (see weather system) */
  RAIN_CHANCE: { autumn: 0.25, winter: 0.35, spring: 0.85, summer: 0.08 } as Record<string, number>,

  // --- World ---
  WORLD_TILES: 180,
  AWAKE_RADIUS: 50,
} as const;

export type Season = (typeof T.SEASONS)[number];
