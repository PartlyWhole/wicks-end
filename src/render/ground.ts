import { T } from '../content/tuning';
import { valueNoise } from '../engine/noise';
import { hash2 } from '../engine/rng';
import type { Game } from '../sim/game';
import { TILE, TILE_INFO } from '../sim/tiles';

export const CHUNK_TILES = 16;
export const CHUNK_UNITS = CHUNK_TILES * T.TILE;
const GPX = 10; // ground pixels per world unit
const BASE_PX = 4; // base color lookup resolution (upscaled)

const rgbCache = new Map<string, [number, number, number]>();
function rgb(hex: string): [number, number, number] {
  let c = rgbCache.get(hex);
  if (!c) {
    const n = parseInt(hex.slice(1), 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(hex, c);
  }
  return c;
}

/** Tile lookup with a noise-warped position so biome borders look hand-painted. */
function warpedTile(g: Game, x: number, y: number, seed: number): number {
  const wx = x + (valueNoise(x / 3.1, y / 3.1, seed) - 0.5) * 4.2 + (valueNoise(x / 0.8, y / 0.8, seed + 5) - 0.5) * 1.1;
  const wy = y + (valueNoise(x / 3.1, y / 3.1, seed + 9) - 0.5) * 4.2 + (valueNoise(x / 0.8, y / 0.8, seed + 11) - 0.5) * 1.1;
  const t = g.tileAt(wx, wy);
  if (t !== TILE.ROAD) return t;
  // roads are painted as strokes; underneath, use a neighboring biome
  for (const [dx, dy] of [[4, 0], [-4, 0], [0, 4], [0, -4], [4, 4], [-4, -4]]) {
    const n = g.tileAt(wx + dx, wy + dy);
    if (n !== TILE.ROAD) return n;
  }
  return TILE.PLAINS;
}

export class GroundRenderer {
  private chunks = new Map<number, HTMLCanvasElement>();
  private order: number[] = [];
  private readonly max = 36;
  private seed: number;

  constructor(private g: Game) {
    this.seed = (g.seed.length * 7919) % 1000;
  }

  private key(cx: number, cy: number): number {
    return cx * 4096 + cy;
  }

  has(cx: number, cy: number): boolean {
    return this.chunks.has(this.key(cx, cy));
  }

  /** Get a chunk canvas, building at most `budget.n` new chunks per frame. */
  get(cx: number, cy: number, budget: { n: number }): HTMLCanvasElement | null {
    const k = this.key(cx, cy);
    const c = this.chunks.get(k);
    if (c) return c;
    if (budget.n <= 0) return null;
    budget.n--;
    const canvas = this.build(cx, cy);
    this.chunks.set(k, canvas);
    this.order.push(k);
    if (this.order.length > this.max) {
      const old = this.order.shift()!;
      this.chunks.delete(old);
    }
    return canvas;
  }

  private build(cx: number, cy: number): HTMLCanvasElement {
    const g = this.g;
    const U = CHUNK_UNITS;
    const ox = cx * U;
    const oy = cy * U;
    // --- base colors at low res
    const bw = U * BASE_PX;
    const base = document.createElement('canvas');
    base.width = base.height = bw;
    const bctx = base.getContext('2d')!;
    const img = bctx.createImageData(bw, bw);
    const d = img.data;
    const tiles = new Uint8Array(bw * bw);
    for (let py = 0; py < bw; py++)
      for (let px = 0; px < bw; px++) {
        const wx = ox + px / BASE_PX;
        const wy = oy + py / BASE_PX;
        const t = warpedTile(g, wx, wy, this.seed);
        tiles[py * bw + px] = t;
        const info = TILE_INFO[t];
        const n = valueNoise(wx / 6, wy / 6, this.seed + t) - 0.5;
        const grain = hash2(px + cx * 999, py + cy * 777, 3) - 0.5;
        const [r, gg, b] = rgb(info.color);
        const [dr, dg, db] = rgb(n < 0 ? info.dark : info.light);
        const m = Math.min(1, Math.abs(n) * 1.6);
        const i = (py * bw + px) * 4;
        const k = 1 + grain * 0.06;
        d[i] = (r + (dr - r) * m) * k;
        d[i + 1] = (gg + (dg - gg) * m) * k;
        d[i + 2] = (b + (db - b) * m) * k;
        d[i + 3] = 255;
      }
    // ink the coastline: land pixels bordering water get a dark rim, water gets a pale foam line
    const wet = (t: number) => t === TILE.OCEAN || t === TILE.SHALLOW;
    for (let py = 2; py < bw - 2; py++)
      for (let px = 2; px < bw - 2; px++) {
        const i = py * bw + px;
        const land = !wet(tiles[i]);
        let border = false;
        for (const o of [-2, 2, -2 * bw, 2 * bw, -1, 1, -bw, bw])
          if (wet(tiles[i + o]) === land) {
            border = true;
            break;
          }
        if (!border) continue;
        const j = i * 4;
        if (land) {
          d[j] *= 0.35;
          d[j + 1] *= 0.32;
          d[j + 2] *= 0.3;
        } else {
          d[j] = d[j] * 0.5 + 110;
          d[j + 1] = d[j + 1] * 0.5 + 130;
          d[j + 2] = d[j + 2] * 0.5 + 128;
        }
      }
    bctx.putImageData(img, 0, 0);

    const c = document.createElement('canvas');
    c.width = c.height = U * GPX;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(base, 0, 0, c.width, c.height);
    ctx.scale(GPX, GPX);
    ctx.lineCap = 'round';
    // --- details
    for (let ty = 0; ty < CHUNK_TILES; ty++)
      for (let tx = 0; tx < CHUNK_TILES; tx++) {
        const gx = cx * CHUNK_TILES + tx;
        const gy = cy * CHUNK_TILES + ty;
        let tile = g.tiles[gy * g.size + gx];
        if (tile === undefined) continue;
        if (tile === TILE.ROAD) tile = warpedTile(g, gx * T.TILE + 2, gy * T.TILE + 2, this.seed);
        const x0 = tx * T.TILE;
        const y0 = ty * T.TILE;
        const info = TILE_INFO[tile];
        const h = (i: number) => hash2(gx * 13 + i, gy * 7 + i * 3, tile);
        switch (tile) {
          case TILE.MEADOW:
          case TILE.PLAINS:
          case TILE.PINEWOOD: {
            const n = tile === TILE.PINEWOOD ? 5 : 9;
            ctx.strokeStyle = tile === TILE.PLAINS ? '#8f7a3e' : tile === TILE.PINEWOOD ? '#2e3622' : '#6a7532';
            ctx.lineWidth = 0.07;
            ctx.globalAlpha = 0.55;
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
              const x = x0 + h(i) * 4;
              const y = y0 + h(i + 50) * 4;
              const l = 0.25 + h(i + 90) * 0.3;
              ctx.moveTo(x, y);
              ctx.quadraticCurveTo(x + 0.05, y - l * 0.6, x + (h(i + 7) - 0.5) * 0.3, y - l);
            }
            ctx.stroke();
            if (tile === TILE.PINEWOOD) {
              ctx.fillStyle = '#39402a';
              for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.ellipse(x0 + h(i + 200) * 4, y0 + h(i + 300) * 4, 0.35, 0.18, 0, 0, Math.PI * 2);
                ctx.fill();
              }
            }
            ctx.globalAlpha = 1;
            break;
          }
          case TILE.ROCKY:
          case TILE.ROAD:
          case TILE.GRAVE: {
            const n = tile === TILE.ROAD ? 6 : 4;
            for (let i = 0; i < n; i++) {
              const x = x0 + h(i) * 4;
              const y = y0 + h(i + 40) * 4;
              const r = 0.08 + h(i + 80) * (tile === TILE.ROAD ? 0.22 : 0.14);
              ctx.fillStyle = tile === TILE.GRAVE ? '#443c33' : info.dark;
              ctx.beginPath();
              ctx.ellipse(x, y, r * 1.4, r, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = info.light;
              ctx.beginPath();
              ctx.ellipse(x - r * 0.3, y - r * 0.3, r * 0.6, r * 0.4, 0, 0, Math.PI * 2);
              ctx.fill();
            }
            break;
          }
          case TILE.MARSH: {
            if (h(1) < 0.35) {
              ctx.fillStyle = '#2a3a38';
              ctx.beginPath();
              ctx.ellipse(x0 + 1 + h(2) * 2, y0 + 1 + h(3) * 2, 0.6 + h(4) * 0.6, 0.3 + h(5) * 0.2, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#4a5a58';
              ctx.lineWidth = 0.05;
              ctx.stroke();
            }
            ctx.strokeStyle = '#2a3226';
            ctx.lineWidth = 0.06;
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
              const x = x0 + h(i + 10) * 4;
              const y = y0 + h(i + 20) * 4;
              ctx.moveTo(x, y);
              ctx.lineTo(x + 0.05, y - 0.35);
            }
            ctx.stroke();
            break;
          }
          case TILE.SHALLOW:
          case TILE.OCEAN: {
            ctx.strokeStyle = tile === TILE.SHALLOW ? '#6a929a' : '#35535d';
            ctx.lineWidth = 0.06;
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            for (let i = 0; i < 2; i++) {
              const x = x0 + h(i) * 4;
              const y = y0 + h(i + 30) * 4;
              ctx.moveTo(x - 0.4, y);
              ctx.quadraticCurveTo(x, y - 0.15, x + 0.4, y);
            }
            ctx.stroke();
            ctx.globalAlpha = 1;
            break;
          }
        }
      }
    this.paintRoads(ctx, ox, oy);
    return c;
  }

  private paintRoads(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
    const U = CHUNK_UNITS;
    ctx.save();
    ctx.translate(-ox, -oy);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const pts of this.g.roads) {
      // skip polylines that don't touch this chunk
      let hit = false;
      for (let i = 0; i < pts.length && !hit; i += 2) hit = pts[i] > ox - 6 && pts[i] < ox + U + 6 && pts[i + 1] > oy - 6 && pts[i + 1] < oy + U + 6;
      if (!hit) continue;
      const path = () => {
        ctx.beginPath();
        ctx.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length - 2; i += 2) ctx.quadraticCurveTo(pts[i], pts[i + 1], (pts[i] + pts[i + 2]) / 2, (pts[i + 1] + pts[i + 3]) / 2);
        ctx.lineTo(pts[pts.length - 2], pts[pts.length - 1]);
      };
      path();
      ctx.strokeStyle = 'rgba(60,48,34,0.55)';
      ctx.lineWidth = 3.4;
      ctx.stroke();
      path();
      ctx.strokeStyle = '#8a7658';
      ctx.lineWidth = 2.8;
      ctx.stroke();
      path();
      ctx.strokeStyle = 'rgba(160,140,110,0.35)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // pebbles
      for (let i = 0; i < pts.length - 2; i += 2) {
        const h = hash2(pts[i] * 10, pts[i + 1] * 10, 5);
        if (h > 0.6) continue;
        const px = pts[i] + (hash2(i, 1, 3) - 0.5) * 2;
        const py = pts[i + 1] + (hash2(i, 2, 3) - 0.5) * 2;
        ctx.fillStyle = '#5e5040';
        ctx.beginPath();
        ctx.ellipse(px, py, 0.18, 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  clear(): void {
    this.chunks.clear();
    this.order = [];
  }
}
