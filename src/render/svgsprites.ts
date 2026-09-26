/**
 * Baked Magic-Lantern sprites (see art/tools/bake.mjs). Each asset has two sheets:
 * a silhouette (always drawn) and a colour layer, drawn on top with alpha = local light,
 * so the world is ink in the dark and "projected" into colour by lamplight.
 * Missing or still-loading sheets simply return false, and the caller falls back to
 * the procedural sprite.
 */
import baked from './sprites/baked.json';

interface Meta {
  frames: number;
  fps: number;
  cols: number;
  size: number;
  worldScale: number;
  duration: number;
}

const META = baked as Record<string, Meta>;
/** world units spanned by a standard 256 px box (Silas is 190 px ≈ 3.2 units tall) */
export const BOX_UNITS = 4.3;
const ANCHOR_X = 128 / 256;
const ANCHOR_Y = 232 / 256;

interface Sheets {
  sil: HTMLImageElement;
  col: HTMLImageElement;
  ok: boolean;
}

export class SvgSprites {
  private sheets = new Map<string, Sheets>();

  constructor(base = 'sprites/') {
    for (const id of Object.keys(META)) {
      const s: Sheets = { sil: new Image(), col: new Image(), ok: false };
      let n = 0;
      const done = () => {
        if (++n === 2) s.ok = true;
      };
      s.sil.onload = done;
      s.col.onload = done;
      s.sil.src = `${base}${id}.sil.webp`;
      s.col.src = `${base}${id}.col.webp`;
      this.sheets.set(id, s);
    }
  }

  has(id: string): boolean {
    return !!this.sheets.get(id)?.ok;
  }

  meta(id: string): Meta | undefined {
    return META[id];
  }

  /** Frame index for a looping clip at time t (seconds). */
  frameAt(id: string, t: number): number {
    const m = META[id];
    if (!m) return 0;
    return ((Math.floor(t * m.fps) % m.frames) + m.frames) % m.frames;
  }

  /** Frame index for a clip played once over `dur` seconds (clamped). */
  frameOnce(id: string, t: number, dur: number): number {
    const m = META[id];
    if (!m) return 0;
    return Math.min(m.frames - 1, Math.max(0, Math.floor((t / dur) * m.frames)));
  }

  /** World-space box [left, top, width, height] relative to the feet, in world units. */
  box(id: string, scale = 1): [number, number, number, number] {
    const u = BOX_UNITS * (META[id]?.worldScale ?? 1) * scale;
    return [-ANCHOR_X * u, -ANCHOR_Y * u, u, u];
  }

  /**
   * Draw at screen (sx, sy) = feet. `px` = pixels per world unit. `colour` 0..1 = how much of
   * the colour layer is revealed. `glow` > 0 adds an additive highlight (hover or hit flash).
   */
  draw(ctx: CanvasRenderingContext2D, id: string, frame: number, sx: number, sy: number, px: number, opts: { scale?: number; facing?: number; colour?: number; glow?: number; alpha?: number; rotate?: number } = {}): boolean {
    const s = this.sheets.get(id);
    const m = META[id];
    if (!s?.ok || !m) return false;
    const f = Math.min(frame, m.frames - 1);
    const cx = (f % m.cols) * m.size;
    const cy = Math.floor(f / m.cols) * m.size;
    const u = BOX_UNITS * m.worldScale * (opts.scale ?? 1) * px;
    ctx.save();
    ctx.translate(sx, sy);
    if (opts.rotate) ctx.rotate(opts.rotate);
    ctx.scale(opts.facing ?? 1, 1);
    const dx = -ANCHOR_X * u;
    const dy = -ANCHOR_Y * u;
    const a = opts.alpha ?? 1;
    ctx.globalAlpha = a;
    ctx.drawImage(s.sil, cx, cy, m.size, m.size, dx, dy, u, u);
    const c = opts.colour ?? 1;
    if (c > 0.01) {
      ctx.globalAlpha = a * c;
      ctx.drawImage(s.col, cx, cy, m.size, m.size, dx, dy, u, u);
    }
    if (opts.glow) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a * opts.glow;
      ctx.drawImage(s.col, cx, cy, m.size, m.size, dx, dy, u, u);
    }
    ctx.restore();
    return true;
  }
}
