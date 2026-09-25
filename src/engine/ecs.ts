import { SpatialHash } from './spatial';

export interface BaseEntity {
  id: number;
  prefab: string;
  x: number;
  y: number;
}

/**
 * Entity store with a per-component index and a spatial hash.
 * Entities are plain objects; components are optional plain-data fields.
 * Only keys listed in `indexed` get query sets (cheap iteration for systems).
 */
export class World<E extends BaseEntity> {
  readonly entities = new Map<number, E>();
  readonly spatial = new SpatialHash<E>(8);
  private index = new Map<string, Set<E>>();
  private nextId = 1;

  constructor(readonly indexed: readonly string[]) {
    for (const k of indexed) this.index.set(k, new Set());
  }

  newId(): number {
    return this.nextId++;
  }

  get idCounter(): number {
    return this.nextId;
  }

  set idCounter(v: number) {
    this.nextId = v;
  }

  add(e: E): E {
    if (!e.id) e.id = this.newId();
    else if (e.id >= this.nextId) this.nextId = e.id + 1;
    this.entities.set(e.id, e);
    for (const [k, set] of this.index) if ((e as any)[k] !== undefined) set.add(e);
    this.spatial.insert(e);
    return e;
  }

  remove(e: E): void {
    if (!this.entities.delete(e.id)) return;
    for (const set of this.index.values()) set.delete(e);
    this.spatial.remove(e);
  }

  get(id: number | undefined | null): E | undefined {
    return id ? this.entities.get(id) : undefined;
  }

  has(e: E): boolean {
    return this.entities.get(e.id) === e;
  }

  /** Attach a component and keep the index in sync. */
  set<K extends keyof E & string>(e: E, key: K, value: E[K]): void {
    e[key] = value;
    this.index.get(key)?.add(e);
  }

  /** Detach a component. */
  unset<K extends keyof E & string>(e: E, key: K): void {
    delete e[key];
    this.index.get(key)?.delete(e);
  }

  query(key: string): Set<E> {
    const s = this.index.get(key);
    if (!s) throw new Error(`component '${key}' is not indexed`);
    return s;
  }

  moved(e: E): void {
    this.spatial.update(e);
  }

  clear(): void {
    this.entities.clear();
    for (const s of this.index.values()) s.clear();
    this.spatial.clear();
    this.nextId = 1;
  }
}
