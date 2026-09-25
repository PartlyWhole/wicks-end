/**
 * "Ink" drawing helpers: wobbly outlines, organic blobs and hatching that give the
 * procedural art a hand-drawn, storybook-gothic look. All functions draw in the current
 * transform, so sprites are authored in world units (1 unit = 1).
 */
import { Rng } from '../engine/rng';

export const INK = '#1a1410';
export const PAPER = '#e9dfc7';

export type Ctx = CanvasRenderingContext2D;
export type Pt = [number, number];

/** Jitter every point a little (deterministic via rng). */
export function jitter(points: Pt[], amount: number, rng: Rng): Pt[] {
  return points.map(([x, y]) => [x + rng.range(-amount, amount), y + rng.range(-amount, amount)]);
}

/** Smooth closed/open path through points using quadratic midpoints. */
export function smoothPath(ctx: Ctx, pts: Pt[], closed = true): void {
  if (pts.length < 2) return;
  ctx.beginPath();
  if (closed) {
    const last = pts[pts.length - 1];
    const first = pts[0];
    ctx.moveTo((last[0] + first[0]) / 2, (last[1] + first[1]) / 2);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const n = pts[(i + 1) % pts.length];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + n[0]) / 2, (p[1] + n[1]) / 2);
    }
    ctx.closePath();
  } else {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i];
      const n = pts[i + 1];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + n[0]) / 2, (p[1] + n[1]) / 2);
    }
    const l = pts[pts.length - 1];
    ctx.lineTo(l[0], l[1]);
  }
}

/** Straight-edged polygon (for jagged shapes like pine tiers). */
export function polyPath(ctx: Ctx, pts: Pt[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

/** Organic ellipse points. */
export function blobPts(cx: number, cy: number, rx: number, ry: number, n: number, wobble: number, rng: Rng): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + rng.range(-wobble, wobble);
    out.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return out;
}

/** Fill the current path, then stroke it with ink. */
export function inked(ctx: Ctx, fill: string | CanvasGradient | CanvasPattern | null, lw = 0.08, stroke = INK): void {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (lw > 0) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

export function blob(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, fill: string, rng: Rng, lw = 0.08, wobble = 0.08, n = 12): void {
  smoothPath(ctx, blobPts(cx, cy, rx, ry, n, wobble, rng));
  inked(ctx, fill, lw);
}

/** Hatch lines clipped to the current path (call after building a path). */
export function hatchClip(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, spacing: number, color: string, lw = 0.04, angle = -0.9): void {
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const w = x1 - x0;
  const h = y1 - y0;
  const len = Math.hypot(w, h) * 2;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let s = -len; s < len; s += spacing) {
    const cx = x0 + w / 2 + -dy * s;
    const cy = y0 + h / 2 + dx * s;
    ctx.moveTo(cx - dx * len, cy - dy * len);
    ctx.lineTo(cx + dx * len, cy + dy * len);
  }
  ctx.stroke();
  ctx.restore();
}

/** A single wobbly ink line. */
export function line(ctx: Ctx, pts: Pt[], lw: number, color = INK): void {
  smoothPath(ctx, pts, false);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

export function circle(ctx: Ctx, x: number, y: number, r: number, fill: string | null, lw = 0.06, stroke = INK): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  inked(ctx, fill, lw, stroke);
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amt < 0) {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  } else {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  }
  return `#${((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).slice(1)}`;
}

/** Soft contact shadow ellipse under objects. */
export function groundShadow(ctx: Ctx, x: number, y: number, rx: number, ry: number, alpha = 0.28): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export { Rng };
