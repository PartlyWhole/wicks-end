import '../content/items';
import '../content/prefabs';
import '../content/recipes';
import { World } from '../engine/ecs';
import { EventBus } from '../engine/events';
import { Rng } from '../engine/rng';
import { Scheduler } from '../engine/scheduler';
import { T } from '../content/tuning';
import { computeClock, type ClockState } from './clock';
import type { Entity } from './types';
import { TILE, TILE_INFO } from './tiles';
import type { Command } from './commands';
import { SAY, type SayKey } from '../content/strings';

export const INDEXED = [
  'health', 'hunger', 'brain', 'locomotor', 'combat', 'burnable', 'fueled', 'light', 'item',
  'spawner', 'cooker', 'dryer', 'farm', 'trap', 'shaveable', 'ttl', 'shadow', 'container',
  'workable', 'pickable', 'growable', 'follower', 'state', 'wave',
] as const;

export interface SimEvents extends Record<string, unknown> {
  say: { id: number; text: string };
  sfx: { name: string; x: number; y: number; id?: number };
  hit: { id: number; by?: number; dmg: number };
  died: { id: number; prefab: string; x: number; y: number };
  playerDied: { cause: string };
  crafted: { recipe: string; prototyped: boolean };
  ate: { item: string };
  fx: { kind: string; x: number; y: number; data?: any };
  newDay: { day: number };
  season: { season: string };
  phase: { phase: string };
  openContainer: { id: number | null };
  inv: {};
  autosave: {};
  /** something was examined/encountered: a prefab or item id */
  discover: { id: string };
}

export interface GameSettings {
  seasonLengths: Record<string, number>;
  /** 0 = relaxed .. 2 = harsh */
  difficulty: number;
}

export interface System {
  name: string;
  /** seconds between updates (0 = every tick) */
  interval?: number;
  update(g: Game, dt: number): void;
}

export class Game {
  readonly world = new World<Entity>(INDEXED);
  readonly events = new EventBus<SimEvents>();
  readonly sched = new Scheduler();
  rng: Rng;
  time = 0;
  clock: ClockState;
  tiles: Uint8Array;
  explored: Uint8Array;
  size: number;
  player!: Entity;
  over = false;
  commands: Command[] = [];
  settings: GameSettings;
  weather = { precip: 0, raining: false, snowCover: 0, nextRoll: 0, lightningAt: 0, rainStart: 0, rainEnd: 0 };
  hounds = { nextAt: 0, warnFrom: 0, toSpawn: 0, spawnAt: 0, warned: 0 };
  giant = { year: -1, warnAt: 0, spawnAt: 0, warned: 0, id: 0 };
  /** per-system accumulated time */
  private acc = new Map<System, number>();
  private systems: System[] = [];
  openContainer: number | null = null;
  /** road polylines in world units: [x0, y0, x1, y1, ...] */
  roads: number[][] = [];

  constructor(
    readonly seed: string,
    size: number,
    settings?: Partial<GameSettings>,
  ) {
    this.rng = new Rng(seed + ':runtime');
    this.size = size;
    this.tiles = new Uint8Array(size * size);
    this.explored = new Uint8Array(size * size);
    this.settings = { seasonLengths: { ...T.SEASON_LENGTH }, difficulty: 1, ...settings };
    this.clock = computeClock(0, this.settings.seasonLengths);
  }

  addSystems(list: System[]): void {
    this.systems.push(...list);
    for (const s of list) this.acc.set(s, 0);
  }

  // ---------- world geometry ----------
  get worldSize(): number {
    return this.size * T.TILE;
  }

  tileAt(x: number, y: number): number {
    const tx = Math.floor(x / T.TILE);
    const ty = Math.floor(y / T.TILE);
    if (tx < 0 || ty < 0 || tx >= this.size || ty >= this.size) return TILE.OCEAN;
    return this.tiles[ty * this.size + tx];
  }

  walkable(x: number, y: number): boolean {
    return TILE_INFO[this.tileAt(x, y)].walkable;
  }

  // ---------- tick ----------
  tick(dt: number): void {
    if (this.over) return;
    this.time += dt;
    const prev = this.clock;
    this.clock = computeClock(this.time, this.settings.seasonLengths);
    if (this.clock.day !== prev.day) this.events.emit('newDay', { day: this.clock.day });
    if (this.clock.season !== prev.season) this.events.emit('season', { season: this.clock.season });
    if (this.clock.phase !== prev.phase) this.events.emit('phase', { phase: this.clock.phase });
    for (const s of this.systems) {
      if (!s.interval) {
        s.update(this, dt);
        continue;
      }
      const a = (this.acc.get(s) ?? 0) + dt;
      if (a >= s.interval) {
        s.update(this, a);
        this.acc.set(s, 0);
      } else this.acc.set(s, a);
    }
  }

  queue(cmd: Command): void {
    this.commands.push(cmd);
  }

  // ---------- helpers used by systems ----------
  /** Speak a random line for `key`, or raw text when `raw` is set. */
  say(e: Entity, key: SayKey | string, raw = false): void {
    const text = raw ? key : this.rng.pick(SAY[key as SayKey] ?? [key]);
    if (e.player) e.player.lastSay = this.time;
    this.events.emit('say', { id: e.id, text });
  }

  sfx(name: string, x: number, y: number, id?: number): void {
    this.events.emit('sfx', { name, x, y, id });
  }

  inAwakeRange(e: Entity): boolean {
    const p = this.player;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    return dx * dx + dy * dy < T.AWAKE_RADIUS * T.AWAKE_RADIUS;
  }
}
