import { describe, expect, it } from 'vitest';
import { Rng } from '../src/engine/rng';
import { Scheduler } from '../src/engine/scheduler';
import { SpatialHash } from '../src/engine/spatial';
import { World } from '../src/engine/ecs';
import { action, condition, selector, sequence } from '../src/engine/bt';

describe('Rng', () => {
  it('is deterministic per seed and resumable', () => {
    const a = new Rng('seed');
    const b = new Rng('seed');
    const xs = Array.from({ length: 5 }, () => a.next());
    expect(xs).toEqual(Array.from({ length: 5 }, () => b.next()));
    const st = a.getState();
    const next = a.next();
    const c = new Rng(1);
    c.setState(st);
    expect(c.next()).toBe(next);
  });
  it('stays in range', () => {
    const r = new Rng(3);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(2, 5);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
    }
  });
});

describe('Scheduler', () => {
  it('drains in time order and keeps later items', () => {
    const s = new Scheduler();
    s.add(5, 1, 'b');
    s.add(1, 2, 'a');
    s.add(9, 3, 'c');
    const out: string[] = [];
    s.drain(6, (x) => out.push(x.ev));
    expect(out).toEqual(['a', 'b']);
    expect(s.size).toBe(1);
    const s2 = new Scheduler();
    s2.load(s.toJSON());
    expect(s2.size).toBe(1);
  });
});

describe('SpatialHash', () => {
  it('finds entities by radius after moves', () => {
    const h = new SpatialHash<{ id: number; x: number; y: number }>(8);
    const a = { id: 1, x: 0, y: 0 };
    const b = { id: 2, x: 30, y: 30 };
    h.insert(a);
    h.insert(b);
    expect(h.inRadius(0, 0, 5).map((e) => e.id)).toEqual([1]);
    b.x = 2;
    b.y = 1;
    h.update(b);
    expect(h.inRadius(0, 0, 5).length).toBe(2);
    expect(h.nearest(3, 1, 5)?.id).toBe(2);
    h.remove(a);
    expect(h.inRadius(0, 0, 5).map((e) => e.id)).toEqual([2]);
  });
});

describe('World', () => {
  it('indexes components', () => {
    const w = new World<{ id: number; prefab: string; x: number; y: number; hp?: number }>(['hp']);
    const e = w.add({ id: 0, prefab: 'x', x: 0, y: 0 });
    expect(w.query('hp').size).toBe(0);
    w.set(e, 'hp', 3);
    expect(w.query('hp').has(e)).toBe(true);
    w.unset(e, 'hp');
    expect(w.query('hp').size).toBe(0);
    w.remove(e);
    expect(w.entities.size).toBe(0);
  });
});

describe('Behavior tree', () => {
  it('selector falls through failures; sequence stops on failure', () => {
    const log: string[] = [];
    const tree = selector(
      sequence(condition(() => false), action(() => void log.push('never'))),
      action(() => {
        log.push('ran');
        return 'running';
      }),
    );
    expect(tree({})).toBe('running');
    expect(log).toEqual(['ran']);
  });
});
