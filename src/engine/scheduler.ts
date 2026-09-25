/** Min-heap of timed events. Used for sparse, long timers (regrowth, burnout) instead of per-tick countdowns. */
export interface Scheduled {
  t: number; // absolute sim time (seconds)
  id: number; // entity id (0 = world)
  ev: string; // event name
  seq: number;
}

export class Scheduler {
  private heap: Scheduled[] = [];
  private seq = 0;

  get size(): number {
    return this.heap.length;
  }

  add(t: number, id: number, ev: string): void {
    const item = { t, id, ev, seq: this.seq++ };
    const h = this.heap;
    h.push(item);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (less(h[p], h[i])) break;
      [h[p], h[i]] = [h[i], h[p]];
      i = p;
    }
  }

  /** Pops every item with t <= now, calling fn for each (in time order). */
  drain(now: number, fn: (s: Scheduled) => void): void {
    const h = this.heap;
    while (h.length && h[0].t <= now) {
      fn(this.pop()!);
    }
  }

  private pop(): Scheduled | undefined {
    const h = this.heap;
    if (!h.length) return undefined;
    const top = h[0];
    const last = h.pop()!;
    if (h.length) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < h.length && less(h[l], h[m])) m = l;
        if (r < h.length && less(h[r], h[m])) m = r;
        if (m === i) break;
        [h[m], h[i]] = [h[i], h[m]];
        i = m;
      }
    }
    return top;
  }

  toJSON(): Array<[number, number, string]> {
    return this.heap.map((s) => [s.t, s.id, s.ev]);
  }

  load(items: Array<[number, number, string]>): void {
    this.heap = [];
    for (const [t, id, ev] of items) this.add(t, id, ev);
  }
}

function less(a: Scheduled, b: Scheduled): boolean {
  return a.t < b.t || (a.t === b.t && a.seq < b.seq);
}
