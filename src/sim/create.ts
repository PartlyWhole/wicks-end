import { T } from '../content/tuning';
import { Game, type GameSettings } from './game';
import { actorSystem, aiSystem } from './systems/ai';
import { locomotionSystem } from './systems/locomotion';
import { statsSystem } from './systems/stats';
import { fireSystem } from './systems/fire';
import { spoilageSystem } from './systems/spoilage';
import { weatherSystem } from './systems/weather';
import { worldSystem } from './systems/world';
import { threatSystem } from './systems/threats';
import { generateWorld } from './worldgen/worldgen';
import { spawn } from './spawn';
import type { Entity } from './types';
import { computeClock } from './clock';

export function installSystems(g: Game): void {
  g.addSystems([actorSystem, aiSystem, locomotionSystem, statsSystem, fireSystem, spoilageSystem, weatherSystem, worldSystem, threatSystem]);
}

export function newGame(seed: string, settings?: Partial<GameSettings>, size = T.WORLD_TILES): Game {
  const g = new Game(seed, size, settings);
  installSystems(g);
  const { spawnX, spawnY } = generateWorld(g);
  g.player = spawn(g, 'player', spawnX, spawnY);
  g.player.facing = 1;
  return g;
}

// ------------------------------------------------------------------ save / load
const SAVE_VERSION = 1;

interface SaveData {
  v: number;
  seed: string;
  size: number;
  time: number;
  settings: GameSettings;
  rng: [number, number, number, number];
  tiles: string;
  explored: string;
  entities: Entity[];
  sched: Array<[number, number, string]>;
  weather: Game['weather'];
  hounds: Game['hounds'];
  giant?: Game['giant'];
  idCounter: number;
  playerId: number;
  roads: number[][];
}

function b64(u: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192));
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

export function serialize(g: Game): string {
  const data: SaveData = {
    v: SAVE_VERSION,
    seed: g.seed,
    size: g.size,
    time: g.time,
    settings: g.settings,
    rng: g.rng.getState(),
    tiles: b64(g.tiles),
    explored: b64(g.explored),
    entities: [...g.world.entities.values()],
    sched: g.sched.toJSON(),
    weather: g.weather,
    hounds: g.hounds,
    giant: g.giant,
    idCounter: g.world.idCounter,
    playerId: g.player.id,
    roads: g.roads,
  };
  return JSON.stringify(data);
}

export function deserialize(json: string): Game {
  const d = JSON.parse(json) as SaveData;
  if (d.v !== SAVE_VERSION) throw new Error('incompatible save');
  const g = new Game(d.seed, d.size, d.settings);
  installSystems(g);
  g.time = d.time;
  g.rng.setState(d.rng);
  g.tiles.set(unb64(d.tiles));
  g.explored.set(unb64(d.explored));
  for (const e of d.entities) g.world.add(e);
  g.world.idCounter = d.idCounter;
  g.sched.load(d.sched);
  Object.assign(g.weather, d.weather);
  Object.assign(g.hounds, d.hounds);
  if (d.giant) Object.assign(g.giant, d.giant);
  g.player = g.world.get(d.playerId)!;
  g.roads = d.roads ?? [];
  g.clock = computeClock(g.time, g.settings.seasonLengths);
  return g;
}
