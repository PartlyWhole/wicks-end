/** Uniform-grid spatial hash for point entities. */
export interface Positioned {
  id: number;
  x: number;
  y: number;
}

export class SpatialHash<T extends Positioned> {
  private cells = new Map<number, Set<T>>();
  private where = new Map<T, number>();

  constructor(readonly cellSize = 8) {}

  private key(cx: number, cy: number): number {
    return ((cx + 32768) << 16) | (cy + 32768);
  }

  insert(e: T): void {
    const k = this.key(Math.floor(e.x / this.cellSize), Math.floor(e.y / this.cellSize));
    let cell = this.cells.get(k);
    if (!cell) this.cells.set(k, (cell = new Set()));
    cell.add(e);
    this.where.set(e, k);
  }

  remove(e: T): void {
    const k = this.where.get(e);
    if (k === undefined) return;
    const cell = this.cells.get(k);
    cell?.delete(e);
    if (cell && cell.size === 0) this.cells.delete(k);
    this.where.delete(e);
  }

  /** Call after changing e.x / e.y. Cheap when the cell is unchanged. */
  update(e: T): void {
    const k = this.key(Math.floor(e.x / this.cellSize), Math.floor(e.y / this.cellSize));
    const old = this.where.get(e);
    if (old === k) return;
    if (old !== undefined) {
      const cell = this.cells.get(old);
      cell?.delete(e);
      if (cell && cell.size === 0) this.cells.delete(old);
    }
    let cell = this.cells.get(k);
    if (!cell) this.cells.set(k, (cell = new Set()));
    cell.add(e);
    this.where.set(e, k);
  }

  /** Visits all entities within radius r of (x,y). Return true from fn to stop early. */
  forEachInRadius(x: number, y: number, r: number, fn: (e: T, d2: number) => boolean | void): void {
    const cs = this.cellSize;
    const x0 = Math.floor((x - r) / cs);
    const x1 = Math.floor((x + r) / cs);
    const y0 = Math.floor((y - r) / cs);
    const y1 = Math.floor((y + r) / cs);
    const r2 = r * r;
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const cell = this.cells.get(this.key(cx, cy));
        if (!cell) continue;
        for (const e of cell) {
          const dx = e.x - x;
          const dy = e.y - y;
          const d2 = dx * dx + dy * dy;
          if (d2 <= r2 && fn(e, d2)) return;
        }
      }
    }
  }

  inRadius(x: number, y: number, r: number, filter?: (e: T) => boolean): T[] {
    const out: T[] = [];
    this.forEachInRadius(x, y, r, (e) => {
      if (!filter || filter(e)) out.push(e);
    });
    return out;
  }

  nearest(x: number, y: number, r: number, filter?: (e: T) => boolean): T | undefined {
    let best: T | undefined;
    let bestD = Infinity;
    this.forEachInRadius(x, y, r, (e, d2) => {
      if (d2 < bestD && (!filter || filter(e))) {
        best = e;
        bestD = d2;
      }
    });
    return best;
  }

  /** Visits entities in an axis-aligned rect. */
  forEachInRect(x0: number, y0: number, x1: number, y1: number, fn: (e: T) => void): void {
    const cs = this.cellSize;
    for (let cx = Math.floor(x0 / cs); cx <= Math.floor(x1 / cs); cx++) {
      for (let cy = Math.floor(y0 / cs); cy <= Math.floor(y1 / cs); cy++) {
        const cell = this.cells.get(this.key(cx, cy));
        if (!cell) continue;
        for (const e of cell) if (e.x >= x0 && e.x <= x1 && e.y >= y0 && e.y <= y1) fn(e);
      }
    }
  }

  clear(): void {
    this.cells.clear();
    this.where.clear();
  }
}
