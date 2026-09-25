/**
 * Static (cached) sprites for world objects. Each draw function works in world units with
 * the origin at the object's feet; y grows downward (so "up" is negative).
 */
import { Rng } from '../../engine/rng';
import { INK, blob, blobPts, circle, groundShadow, hatchClip, inked, line, polyPath, shade, smoothPath, type Ctx, type Pt } from '../ink';

export const PX = 40; // cache resolution: pixels per world unit

export interface SpriteDef {
  /** box in units: left, top, width, height relative to feet origin */
  box: [number, number, number, number];
  draw: (ctx: Ctx, rng: Rng) => void;
}

export interface Sprite {
  canvas: HTMLCanvasElement;
  box: [number, number, number, number];
}

const cache = new Map<string, Sprite>();

export function getSprite(key: string, make: () => SpriteDef | null): Sprite | null {
  let s = cache.get(key);
  if (s) return s;
  const def = make();
  if (!def) return null;
  const [l, t, w, h] = def.box;
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * PX);
  c.height = Math.ceil(h * PX);
  const ctx = c.getContext('2d')!;
  ctx.scale(PX, PX);
  ctx.translate(-l, -t);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  def.draw(ctx, new Rng(key));
  s = { canvas: c, box: def.box };
  cache.set(key, s);
  return s;
}

// ------------------------------------------------------------------ flora
function pineTree(stage: number, v: number, snow: boolean): SpriteDef {
  const H = [3.2, 5.2, 7][stage];
  const W = [1.6, 2.4, 3][stage];
  return {
    box: [-W - 0.5, -H - 0.6, W * 2 + 1, H + 1.2],
    draw(ctx, rng) {
      groundShadow(ctx, 0, 0.05, W * 0.8, 0.35, 0.3);
      // trunk
      ctx.beginPath();
      ctx.moveTo(-0.22, 0.05);
      ctx.lineTo(-0.14, -H * 0.3);
      ctx.lineTo(0.14, -H * 0.3);
      ctx.lineTo(0.22, 0.05);
      ctx.closePath();
      inked(ctx, '#5a3d27', 0.09);
      const tiers = [3, 4, 5][stage];
      const base = -H * 0.18;
      const green = ['#3e5a34', '#39532f', '#2f4a2c'][v % 3];
      for (let i = 0; i < tiers; i++) {
        const f = i / tiers;
        const y0 = base - f * H * 0.78;
        const w = W * (1 - f * 0.72);
        const h = (H * 0.78) / tiers + 0.55;
        const pts: Pt[] = [];
        const n = 7;
        pts.push([-w, y0]);
        for (let k = 1; k < n; k++) {
          const x = -w + (2 * w * k) / n;
          pts.push([x + rng.range(-0.05, 0.05), y0 + (k % 2 ? 0.28 : 0.05) + rng.range(-0.05, 0.05)]);
        }
        pts.push([w, y0]);
        pts.push([rng.range(-0.1, 0.1), y0 - h]);
        polyPath(ctx, pts);
        inked(ctx, shade(green, -f * 0.1 + 0.04 * i), 0.09);
        // right-side shading hatch
        polyPath(ctx, [[0.05, y0 - h + 0.1], [w * 0.95, y0], [w * 0.2, y0 + 0.1]]);
        hatchClip(ctx, 0, y0 - h, w, y0 + 0.3, 0.16, shade(green, -0.45), 0.045);
        // highlight needles
        line(ctx, [[-w * 0.55, y0 - 0.05], [-w * 0.2, y0 - h * 0.45]], 0.05, shade(green, 0.25));
        if (snow) {
          polyPath(ctx, [[-w * 0.5, y0 - h * 0.45], [0, y0 - h + 0.05], [w * 0.4, y0 - h * 0.5], [0, y0 - h * 0.55]]);
          inked(ctx, '#eef2f4', 0.04);
        }
      }
    },
  };
}

function burntTree(): SpriteDef {
  return {
    box: [-1.6, -4.6, 3.2, 5],
    draw(ctx, rng) {
      groundShadow(ctx, 0, 0.05, 0.9, 0.25);
      polyPath(ctx, [[-0.3, 0.05], [-0.15, -3.8], [0, -4.3], [0.12, -3.7], [0.3, 0.05]]);
      inked(ctx, '#2a2522', 0.08);
      for (let i = 0; i < 5; i++) {
        const y = -1 - i * 0.6;
        const d = i % 2 ? 1 : -1;
        line(ctx, [[0, y], [d * 0.5, y - 0.3], [d * (0.9 + rng.range(0, 0.3)), y - 0.2 - rng.range(0, 0.4)]], 0.1, '#2a2522');
      }
    },
  };
}

function stump(): SpriteDef {
  return {
    box: [-0.8, -0.9, 1.6, 1.2],
    draw(ctx) {
      groundShadow(ctx, 0, 0.05, 0.55, 0.18);
      ctx.beginPath();
      ctx.moveTo(-0.38, 0.05);
      ctx.lineTo(-0.3, -0.45);
      ctx.lineTo(0.3, -0.45);
      ctx.lineTo(0.38, 0.05);
      ctx.closePath();
      inked(ctx, '#5a3d27', 0.08);
      ctx.beginPath();
      ctx.ellipse(0, -0.45, 0.3, 0.13, 0, 0, Math.PI * 2);
      inked(ctx, '#c9a26a', 0.07);
      ctx.beginPath();
      ctx.ellipse(0, -0.45, 0.14, 0.06, 0, 0, Math.PI * 2);
      inked(ctx, null, 0.03, '#8a6a44');
    },
  };
}

function sapling(ready: boolean, planted = false): SpriteDef {
  return {
    box: [-1, -1.9, 2, 2.2],
    draw(ctx, rng) {
      groundShadow(ctx, 0, 0.03, 0.4, 0.12);
      if (planted) {
        line(ctx, [[0, 0], [0.05, -0.8]], 0.08, '#5a3d27');
        polyPath(ctx, [[-0.35, -0.5], [0.05, -1.3], [0.4, -0.5]]);
        inked(ctx, '#46663a', 0.07);
        return;
      }
      const n = ready ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const a = -0.5 + i * (1 / (n - 1 || 1));
        const len = ready ? rng.range(1.2, 1.6) : 0.35;
        line(ctx, [[0, 0], [a * 0.25, -len * 0.5], [a * 0.6, -len]], 0.07, '#6b4a2c');
        if (ready) {
          blob(ctx, a * 0.6, -len, 0.12, 0.08, '#6a8a3a', rng, 0.04);
          blob(ctx, a * 0.35, -len * 0.6, 0.1, 0.07, '#5a7a32', rng, 0.04);
        }
      }
    },
  };
}

function grass(ready: boolean, v: number): SpriteDef {
  return {
    box: [-1, -1.7, 2, 1.9],
    draw(ctx, rng) {
      groundShadow(ctx, 0, 0.03, 0.5, 0.12, 0.22);
      const blades = ready ? 9 : 6;
      const col = ['#b3a24f', '#a6974a', '#bfad58'][v % 3];
      for (let i = 0; i < blades; i++) {
        const x = (i / (blades - 1) - 0.5) * 0.7;
        const h = ready ? rng.range(0.9, 1.45) : rng.range(0.15, 0.3);
        const lean = x * 0.9 + rng.range(-0.15, 0.15);
        ctx.beginPath();
        ctx.moveTo(x - 0.06, 0);
        ctx.quadraticCurveTo(x + lean * 0.3, -h * 0.6, x + lean, -h);
        ctx.quadraticCurveTo(x + lean * 0.3 + 0.05, -h * 0.5, x + 0.07, 0);
        ctx.closePath();
        inked(ctx, i % 2 ? col : shade(col, -0.15), 0.045);
      }
    },
  };
}

function berryBush(state: 'ready' | 'picked' | 'barren', v: number): SpriteDef {
  return {
    box: [-1.3, -2, 2.6, 2.3],
    draw(ctx, rng) {
      groundShadow(ctx, 0, 0.05, 0.9, 0.22);
      const leaf = state === 'barren' ? '#6a5a3a' : ['#3e5a30', '#44602f'][v % 2];
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI + (i / 4) * Math.PI;
        blob(ctx, Math.cos(a) * 0.55, -0.55 + Math.sin(a) * 0.45, 0.48, 0.42, shade(leaf, (i % 2) * 0.08), rng, 0.07, 0.15);
      }
      blob(ctx, 0, -0.75, 0.6, 0.5, shade(leaf, 0.06), rng, 0.07, 0.15);
      if (state === 'ready')
        for (let i = 0; i < 7; i++) {
          const x = rng.range(-0.7, 0.7);
          const y = rng.range(-1.2, -0.3);
          circle(ctx, x, y, 0.12, '#b3263e', 0.045);
          circle(ctx, x - 0.04, y - 0.04, 0.035, '#f0a0a8', 0);
        }
    },
  };
}

function carrotPlant(): SpriteDef {
  return {
    box: [-0.6, -1, 1.2, 1.2],
    draw(ctx) {
      groundShadow(ctx, 0, 0.02, 0.25, 0.08);
      polyPath(ctx, [[-0.12, 0], [0, 0.12], [0.12, 0], [0.06, -0.15], [-0.06, -0.15]]);
      inked(ctx, '#e0782a', 0.05);
      for (let i = -2; i <= 2; i++) line(ctx, [[0, -0.12], [i * 0.1, -0.45], [i * 0.2, -0.75]], 0.06, '#5b7a2a');
    },
  };
}

function flower(v: number): SpriteDef {
  const cols = ['#e7a0b6', '#f2d36a', '#b9c8f0', '#f0f0f0', '#e38a5a'];
  return {
    box: [-0.6, -1.2, 1.2, 1.4],
    draw(ctx, rng) {
      line(ctx, [[0, 0], [0.05, -0.4], [0, -0.7]], 0.05, '#4d6a2a');
      blob(ctx, 0.12, -0.35, 0.12, 0.06, '#5b7a2a', rng, 0.03);
      const c = cols[v % cols.length];
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        circle(ctx, Math.cos(a) * 0.16, -0.75 + Math.sin(a) * 0.14, 0.12, c, 0.04);
      }
      circle(ctx, 0, -0.75, 0.07, '#f1c040', 0.03);
    },
  };
}

function reeds(ready: boolean): SpriteDef {
  return {
    box: [-0.9, -2.2, 1.8, 2.4],
    draw(ctx, rng) {
      const n = ready ? 7 : 4;
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1) - 0.5) * 0.8;
        const h = ready ? rng.range(1.3, 1.9) : rng.range(0.3, 0.5);
        line(ctx, [[x, 0], [x + x * 0.2, -h * 0.5], [x + x * 0.4, -h]], 0.06, '#6f7a45');
        if (ready && i % 2 === 0) {
          ctx.beginPath();
          ctx.ellipse(x + x * 0.4, -h + 0.12, 0.07, 0.2, 0, 0, Math.PI * 2);
          inked(ctx, '#6a4a2a', 0.04);
        }
      }
    },
  };
}

// ------------------------------------------------------------------ minerals
function boulder(gold: boolean, v: number): SpriteDef {
  return {
    box: [-1.4, -1.8, 2.8, 2.1],
    draw(ctx, rng) {
      groundShadow(ctx, 0, 0.05, 1.15, 0.3);
      const base = gold ? '#8f8778' : ['#8a8780', '#807d77', '#918d85'][v % 3];
      smoothPath(ctx, blobPts(0, -0.65, 1.05, 0.72, 11, 0.12, rng));
      inked(ctx, base, 0.09);
      smoothPath(ctx, blobPts(-0.2, -0.95, 0.55, 0.3, 8, 0.2, rng));
      inked(ctx, shade(base, 0.18), 0);
      smoothPath(ctx, blobPts(0, -0.65, 1.05, 0.72, 11, 0.12, new Rng(v + 91)));
      ctx.save();
      ctx.clip();
      ctx.fillStyle = shade(base, -0.28);
      ctx.beginPath();
      ctx.ellipse(0.5, -0.3, 0.8, 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      line(ctx, [[-0.4, -1.1], [-0.2, -0.7], [-0.35, -0.35]], 0.05, shade(base, -0.45));
      line(ctx, [[0.3, -1.0], [0.45, -0.7]], 0.04, shade(base, -0.45));
      if (gold) for (let i = 0; i < 6; i++) blob(ctx, rng.range(-0.6, 0.6), rng.range(-1.1, -0.3), 0.1, 0.07, '#e4b43e', rng, 0.03, 0.3, 6);
    },
  };
}

// ------------------------------------------------------------------ structures
function stoneRing(ctx: Ctx, rng: Rng, r: number): void {
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    blob(ctx, Math.cos(a) * r, Math.sin(a) * r * 0.45 - 0.1, 0.26, 0.2, shade('#8d8a84', rng.range(-0.1, 0.1)), rng, 0.06);
  }
}

function firepit(): SpriteDef {
  return {
    box: [-1.3, -1, 2.6, 1.5],
    draw(ctx, rng) {
      ctx.beginPath();
      ctx.ellipse(0, -0.1, 0.8, 0.35, 0, 0, Math.PI * 2);
      inked(ctx, '#2a2320', 0.05);
      stoneRing(ctx, rng, 0.85);
      line(ctx, [[-0.4, -0.1], [0.35, -0.2]], 0.15, '#4a3322');
      line(ctx, [[-0.3, -0.25], [0.4, -0.05]], 0.15, '#3a2a1a');
    },
  };
}

function campfire(): SpriteDef {
  return {
    box: [-1, -0.8, 2, 1.2],
    draw(ctx) {
      ctx.beginPath();
      ctx.ellipse(0, 0, 0.6, 0.25, 0, 0, Math.PI * 2);
      inked(ctx, '#2a2320', 0.04);
      line(ctx, [[-0.5, 0.05], [0.25, -0.3]], 0.16, '#5a3d27');
      line(ctx, [[0.5, 0.05], [-0.25, -0.3]], 0.16, '#4a3322');
      line(ctx, [[-0.3, 0.1], [0.35, 0.1]], 0.12, '#6a4a2c');
    },
  };
}

function tinkersBench(): SpriteDef {
  return {
    box: [-1.6, -3.4, 3.2, 3.8],
    draw(ctx, rng) {
      groundShadow(ctx, 0, 0.05, 1.3, 0.3);
      // legs + table
      for (const x of [-1, 1]) line(ctx, [[x * 0.9, 0], [x * 0.85, -1.1]], 0.14, '#5a3d27');
      ctx.beginPath();
      ctx.rect(-1.2, -1.35, 2.4, 0.3);
      inked(ctx, '#8a603a', 0.08);
      // box body with dials
      ctx.beginPath();
      ctx.rect(-0.8, -2.5, 1.6, 1.15);
      inked(ctx, '#a07046', 0.08);
      hatchClip(ctx, -0.8, -2.5, 0.8, -1.35, 0.18, '#7a5030', 0.03);
      circle(ctx, -0.35, -1.95, 0.25, '#d8c89a', 0.06);
      line(ctx, [[-0.35, -1.95], [-0.2, -2.1]], 0.05);
      // gear
      ctx.save();
      ctx.translate(0.4, -1.95);
      for (let i = 0; i < 8; i++) {
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#b08a3a';
        ctx.fillRect(-0.06, -0.33, 0.12, 0.1);
      }
      ctx.restore();
      circle(ctx, 0.4, -1.95, 0.24, '#c09a4a', 0.06);
      circle(ctx, 0.4, -1.95, 0.08, INK, 0);
      // antenna + bulb
      line(ctx, [[0, -2.5], [0.05, -2.9]], 0.06);
      circle(ctx, 0.05, -3.05, 0.18, '#f2e2a0', 0.06);
      void rng;
    },
  };
}

function alembic(): SpriteDef {
  return {
    box: [-1.7, -3.8, 3.4, 4.2],
    draw(ctx, rng) {
      groundShadow(ctx, 0, 0.05, 1.3, 0.3);
      ctx.beginPath();
      ctx.rect(-1.1, -0.9, 2.2, 0.9);
      inked(ctx, '#6d6a66', 0.08);
      for (let i = 0; i < 4; i++) blob(ctx, -0.8 + i * 0.55, -0.45, 0.22, 0.2, '#8d8a84', rng, 0.05);
      // copper flask
      ctx.beginPath();
      ctx.moveTo(-0.2, -3.1);
      ctx.lineTo(-0.2, -2.4);
      ctx.quadraticCurveTo(-1.0, -2.1, -0.9, -1.4);
      ctx.quadraticCurveTo(-0.8, -0.85, 0, -0.9);
      ctx.quadraticCurveTo(0.8, -0.85, 0.9, -1.4);
      ctx.quadraticCurveTo(1.0, -2.1, 0.2, -2.4);
      ctx.lineTo(0.2, -3.1);
      ctx.closePath();
      inked(ctx, '#b86d3a', 0.09);
      ctx.beginPath();
      ctx.ellipse(0, -1.5, 0.65, 0.35, 0, 0, Math.PI * 2);
      inked(ctx, '#6fb0a0', 0.05);
      line(ctx, [[0.2, -2.9], [0.9, -3.2], [1.3, -2.4], [1.3, -0.9]], 0.1, '#8a4a2a');
      circle(ctx, -0.3, -1.6, 0.08, '#c0f0e0', 0);
      circle(ctx, 0.2, -1.4, 0.06, '#c0f0e0', 0);
    },
  };
}

function cookpot(): SpriteDef {
  return {
    box: [-1.3, -2.4, 2.6, 2.8],
    draw(ctx) {
      groundShadow(ctx, 0, 0.05, 1, 0.25);
      for (const x of [-0.8, 0.8]) line(ctx, [[x, 0], [x * 0.7, -1.3]], 0.1, '#3a3430');
      line(ctx, [[0, 0.05], [0, -1.0]], 0.1, '#3a3430');
      ctx.beginPath();
      ctx.moveTo(-0.85, -1.6);
      ctx.quadraticCurveTo(-0.95, -0.6, 0, -0.6);
      ctx.quadraticCurveTo(0.95, -0.6, 0.85, -1.6);
      ctx.closePath();
      inked(ctx, '#3a3632', 0.09);
      ctx.beginPath();
      ctx.ellipse(0, -1.6, 0.88, 0.25, 0, 0, Math.PI * 2);
      inked(ctx, '#54504a', 0.08);
      ctx.beginPath();
      ctx.ellipse(0, -1.62, 0.66, 0.15, 0, 0, Math.PI * 2);
      inked(ctx, '#1e1c1a', 0.04);
      line(ctx, [[-0.5, -1.0], [0.4, -0.95]], 0.04, '#6a655e');
    },
  };
}

function chest(fridge: boolean): SpriteDef {
  return {
    box: [-1.1, -1.8, 2.2, 2.2],
    draw(ctx, rng) {
      groundShadow(ctx, 0, 0.05, 0.9, 0.2);
      const body = fridge ? '#a9c6d6' : '#9a6b3c';
      ctx.beginPath();
      ctx.rect(-0.8, -0.95, 1.6, 0.95);
      inked(ctx, body, 0.08);
      ctx.beginPath();
      ctx.moveTo(-0.85, -0.95);
      ctx.quadraticCurveTo(0, -1.65, 0.85, -0.95);
      ctx.closePath();
      inked(ctx, shade(body, 0.12), 0.08);
      if (!fridge) {
        for (const x of [-0.5, 0.5]) line(ctx, [[x, -1.3], [x, 0]], 0.08, '#4a4440');
        ctx.beginPath();
        ctx.rect(-0.14, -1.05, 0.28, 0.28);
        inked(ctx, '#d8b04a', 0.05);
        hatchClip(ctx, -0.8, -0.95, 0.8, 0, 0.2, '#6a4a2a', 0.03, 0);
      } else {
        line(ctx, [[-0.6, -0.5], [0.6, -0.5]], 0.05, '#6a8a9a');
        for (let i = 0; i < 3; i++) blob(ctx, rng.range(-0.5, 0.5), -1.2, 0.08, 0.06, '#ffffff', rng, 0.02);
      }
    },
  };
}

function dryingRack(item?: string): SpriteDef {
  return {
    box: [-1.4, -2.6, 2.8, 2.9],
    draw(ctx, rng) {
      groundShadow(ctx, 0, 0.05, 1.1, 0.2);
      for (const x of [-1, 1]) {
        line(ctx, [[x * 1.1, 0], [x * 0.9, -2.1]], 0.09, '#6b4a2c');
        line(ctx, [[x * 0.7, 0], [x * 0.9, -2.1]], 0.09, '#6b4a2c');
      }
      line(ctx, [[-1, -2.05], [1, -2.05]], 0.1, '#7d5634');
      if (item) {
        const c = item.includes('jerky') ? '#7a3e2a' : '#c24a4a';
        for (let i = 0; i < 3; i++) {
          line(ctx, [[-0.5 + i * 0.5, -2.05], [-0.5 + i * 0.5, -1.8]], 0.03, '#c9ab6c');
          blob(ctx, -0.5 + i * 0.5, -1.45, 0.16, 0.36, shade(c, i * 0.06), rng, 0.05);
        }
      }
    },
  };
}

function farmPlot(crop?: string, ready?: boolean): SpriteDef {
  return {
    box: [-1.5, -1.6, 3, 2.2],
    draw(ctx, rng) {
      ctx.beginPath();
      ctx.rect(-1.25, -0.8, 2.5, 1.1);
      inked(ctx, '#4a3624', 0.07);
      for (let i = 0; i < 4; i++) line(ctx, [[-1.1, -0.6 + i * 0.28], [1.1, -0.6 + i * 0.28]], 0.05, '#3a2a1a');
      for (const x of [-1.3, 1.3]) {
        line(ctx, [[x, 0.35], [x, -0.85]], 0.1, '#6b4a2c');
      }
      if (crop) {
        if (!ready) {
          for (let i = 0; i < 3; i++) line(ctx, [[-0.5 + i * 0.5, -0.2], [-0.45 + i * 0.5, -0.6]], 0.06, '#6a9a3a');
        } else {
          ctx.save();
          ctx.translate(0, -0.6);
          ctx.scale(0.55, 0.55);
          drawCropOnPlot(ctx, crop, rng);
          ctx.restore();
        }
      }
    },
  };
}

function drawCropOnPlot(ctx: Ctx, crop: string, rng: Rng): void {
  const col: Record<string, string> = { carrot: '#e0782a', corn: '#f0c93c', pumpkin: '#d9702a', eggplant: '#5a2e6a', watermelon: '#3e7a3a' };
  blob(ctx, 0, 0, 0.7, 0.55, col[crop] ?? '#a0a060', rng, 0.12);
  for (let i = -1; i <= 1; i++) line(ctx, [[0, -0.5], [i * 0.35, -1.0]], 0.12, '#5b7a2a');
}

function wall(stone: boolean): SpriteDef {
  return {
    box: [-0.8, -2.4, 1.6, 2.7],
    draw(ctx, rng) {
      groundShadow(ctx, 0, 0.05, 0.6, 0.18);
      if (!stone) {
        for (let i = -1; i <= 1; i++) {
          const x = i * 0.33;
          const h = 1.8 + rng.range(-0.15, 0.15);
          polyPath(ctx, [[x - 0.16, 0], [x - 0.16, -h], [x, -h - 0.25], [x + 0.16, -h], [x + 0.16, 0]]);
          inked(ctx, shade('#9a7048', i * 0.05), 0.07);
        }
        line(ctx, [[-0.55, -1.2], [0.55, -1.25]], 0.08, '#6b4a2c');
      } else {
        for (let r = 0; r < 4; r++)
          for (let c = 0; c < 2; c++) {
            ctx.beginPath();
            ctx.roundRect(-0.6 + c * 0.6 + (r % 2) * 0.12 - 0.06, -0.45 - r * 0.45, 0.58, 0.44, 0.08);
            inked(ctx, shade('#9a978f', rng.range(-0.08, 0.08)), 0.06);
          }
      }
    },
  };
}

function hogHouse(lit: boolean): SpriteDef {
  return {
    box: [-2.2, -5.2, 4.4, 5.6],
    draw(ctx, rng) {
      groundShadow(ctx, 0, 0.05, 1.8, 0.35);
      // body: tapered wooden tower
      ctx.beginPath();
      ctx.moveTo(-1.3, 0);
      ctx.lineTo(-1.05, -3.2);
      ctx.lineTo(1.05, -3.2);
      ctx.lineTo(1.3, 0);
      ctx.closePath();
      inked(ctx, '#a07046', 0.1);
      for (let i = -2; i <= 2; i++) line(ctx, [[i * 0.5, 0], [i * 0.42, -3.2]], 0.04, '#7a5030');
      // thatch roof
      ctx.beginPath();
      ctx.moveTo(-1.8, -3.0);
      ctx.quadraticCurveTo(-0.5, -4.3, 0.1, -5.0);
      ctx.quadraticCurveTo(0.6, -4.2, 1.8, -3.0);
      ctx.quadraticCurveTo(0, -3.3, -1.8, -3.0);
      inked(ctx, '#c2a45a', 0.1);
      hatchClip(ctx, -1.8, -5, 1.8, -3, 0.2, '#8a7030', 0.04, -1.3);
      // round window
      circle(ctx, 0, -2.1, 0.45, lit ? '#ffd27a' : '#2b2420', 0.09);
      line(ctx, [[-0.45, -2.1], [0.45, -2.1]], 0.05);
      line(ctx, [[0, -2.55], [0, -1.65]], 0.05);
      // door
      ctx.beginPath();
      ctx.moveTo(-0.45, 0);
      ctx.lineTo(-0.45, -0.9);
      ctx.quadraticCurveTo(0, -1.3, 0.45, -0.9);
      ctx.lineTo(0.45, 0);
      ctx.closePath();
      inked(ctx, '#5a3d27', 0.07);
      void rng;
    },
  };
}

function tent(): SpriteDef {
  return {
    box: [-1.8, -3, 3.6, 3.4],
    draw(ctx) {
      groundShadow(ctx, 0, 0.05, 1.5, 0.3);
      polyPath(ctx, [[-1.5, 0], [0, -2.6], [1.5, 0]]);
      inked(ctx, '#b9a27c', 0.1);
      polyPath(ctx, [[-0.45, 0], [0, -1.6], [0.45, 0]]);
      inked(ctx, '#2a2420', 0.06);
      line(ctx, [[0, -2.6], [0, -2.9]], 0.08, '#6b4a2c');
      hatchClip(ctx, -1.5, -2.6, 1.5, 0, 0.22, '#8a7654', 0.035, -0.5);
    },
  };
}

function trap(caught: boolean): SpriteDef {
  return {
    box: [-0.9, -1.6, 1.8, 1.9],
    draw(ctx) {
      groundShadow(ctx, 0, 0.03, 0.55, 0.14);
      ctx.beginPath();
      ctx.moveTo(-0.55, 0);
      ctx.quadraticCurveTo(0, -1.5, 0.55, 0);
      ctx.closePath();
      inked(ctx, '#b9a653', 0.07);
      for (let i = -2; i <= 2; i++) line(ctx, [[i * 0.2, 0], [0, -1.05]], 0.03, '#7a6a2a');
      if (caught) {
        line(ctx, [[-0.1, -1.0], [-0.2, -1.45]], 0.1, '#9a7a5c');
        line(ctx, [[0.1, -1.0], [0.2, -1.45]], 0.1, '#9a7a5c');
      }
    },
  };
}

function rabbitHole(): SpriteDef {
  return {
    box: [-1, -0.7, 2, 1.1],
    draw(ctx, rng) {
      blob(ctx, 0, -0.1, 0.8, 0.35, '#7a5e40', rng, 0.06, 0.15);
      ctx.beginPath();
      ctx.ellipse(0, -0.12, 0.38, 0.17, 0, 0, Math.PI * 2);
      inked(ctx, '#1e1812', 0.04);
    },
  };
}

function spiderDen(stage: number): SpriteDef {
  const s = [1, 1.3, 1.6][stage];
  return {
    box: [-2.2 * s, -3.6 * s, 4.4 * s, 4 * s],
    draw(ctx, rng) {
      groundShadow(ctx, 0, 0.05, 1.6 * s, 0.4 * s);
      // web strands to the ground
      for (let i = 0; i < 7; i++) {
        const a = (i / 6) * Math.PI;
        line(ctx, [[Math.cos(a) * 1.8 * s, 0], [Math.cos(a) * 0.6 * s, -1.2 * s]], 0.03, '#d8d4cc');
      }
      for (let t = 0; t <= stage; t++) {
        const y = -0.9 * s - t * 0.9 * s;
        const r = (1.3 - t * 0.3) * s;
        smoothPath(ctx, blobPts(0, y, r, r * 0.8, 12, 0.14, rng));
        inked(ctx, shade('#e2ded4', -t * 0.04), 0.08);
        smoothPath(ctx, blobPts(0, y, r, r * 0.8, 12, 0.14, new Rng(t + 3)));
        hatchClip(ctx, -r, y - r, r, y + r, 0.25, '#bdb8ac', 0.03, 0.4);
      }
      circle(ctx, 0.2 * s, -0.7 * s, 0.22 * s, '#1a1410', 0.04);
    },
  };
}

function pond(frozen: boolean): SpriteDef {
  return {
    box: [-3, -1.6, 6, 3],
    draw(ctx, rng) {
      smoothPath(ctx, blobPts(0, 0, 2.6, 1.2, 14, 0.1, rng));
      inked(ctx, frozen ? '#a9c6d6' : '#2e4a55', 0.1);
      smoothPath(ctx, blobPts(0, -0.05, 2.2, 0.95, 12, 0.08, new Rng(4)));
      inked(ctx, frozen ? '#c9dde6' : '#3a5a66', 0);
      if (!frozen) {
        blob(ctx, 1.1, 0.2, 0.3, 0.14, '#5b7a3a', rng, 0.04);
        blob(ctx, -1.2, -0.3, 0.25, 0.12, '#5b7a3a', rng, 0.04);
        line(ctx, [[-0.5, 0.3], [0.3, 0.28]], 0.04, '#6a8a96');
      } else line(ctx, [[-0.8, -0.2], [0.2, 0.1], [0.9, -0.1]], 0.03, '#ffffff');
    },
  };
}

function gravestone(v: number): SpriteDef {
  return {
    box: [-0.9, -2.2, 1.8, 2.5],
    draw(ctx, rng) {
      groundShadow(ctx, 0, 0.05, 0.6, 0.15);
      ctx.beginPath();
      if (v % 2) {
        ctx.moveTo(-0.55, 0);
        ctx.lineTo(-0.55, -1.3);
        ctx.quadraticCurveTo(0, -1.95, 0.55, -1.3);
        ctx.lineTo(0.55, 0);
      } else {
        ctx.moveTo(-0.15, 0);
        ctx.lineTo(-0.15, -1.1);
        ctx.lineTo(-0.55, -1.1);
        ctx.lineTo(-0.55, -1.4);
        ctx.lineTo(-0.15, -1.4);
        ctx.lineTo(-0.15, -1.9);
        ctx.lineTo(0.15, -1.9);
        ctx.lineTo(0.15, -1.4);
        ctx.lineTo(0.55, -1.4);
        ctx.lineTo(0.55, -1.1);
        ctx.lineTo(0.15, -1.1);
        ctx.lineTo(0.15, 0);
      }
      ctx.closePath();
      inked(ctx, '#8a8a90', 0.08);
      line(ctx, [[-0.3, -0.9], [0.2, -0.95]], 0.04, '#5a5a60');
      line(ctx, [[-0.25, -0.6], [0.3, -0.65]], 0.04, '#5a5a60');
      blob(ctx, 0.35, -0.1, 0.2, 0.12, '#5b6a3a', rng, 0.03);
    },
  };
}

function graveMound(): SpriteDef {
  return {
    box: [-1.1, -0.7, 2.2, 1.1],
    draw(ctx, rng) {
      blob(ctx, 0, -0.15, 0.95, 0.35, '#6a5a44', rng, 0.06, 0.1);
      line(ctx, [[-0.5, -0.2], [0.4, -0.25]], 0.03, '#4a3a2a');
    },
  };
}

function lampPost(): SpriteDef {
  return {
    box: [-1, -5, 2, 5.4],
    draw(ctx) {
      groundShadow(ctx, 0, 0.05, 0.6, 0.15);
      ctx.beginPath();
      ctx.rect(-0.35, -0.35, 0.7, 0.35);
      inked(ctx, '#3a3632', 0.07);
      line(ctx, [[0, -0.35], [0, -3.6]], 0.14, '#2a2622');
      line(ctx, [[-0.3, -3.3], [0.3, -3.3]], 0.08, '#2a2622');
      polyPath(ctx, [[-0.4, -3.6], [0.4, -3.6], [0.3, -4.4], [-0.3, -4.4]]);
      inked(ctx, '#ffe2a0', 0.08);
      polyPath(ctx, [[-0.45, -4.4], [0.45, -4.4], [0, -4.8]]);
      inked(ctx, '#2a2622', 0.07);
    },
  };
}

function portal(): SpriteDef {
  return {
    box: [-2, -4.2, 4, 4.6],
    draw(ctx, rng) {
      groundShadow(ctx, 0, 0.05, 1.6, 0.3);
      ctx.beginPath();
      ctx.ellipse(0, -1.9, 1.1, 1.6, 0, 0, Math.PI * 2);
      inked(ctx, '#2a1e3a', 0.1);
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(0, -1.9, 0.9 - i * 0.2, 1.35 - i * 0.3, i * 0.4, 0, Math.PI * 1.5);
        ctx.strokeStyle = ['#6a4aa0', '#8a6ac0', '#a58cff', '#d0c0ff'][i];
        ctx.lineWidth = 0.08;
        ctx.stroke();
      }
      for (const x of [-1.2, 1.2]) {
        line(ctx, [[x, 0], [x * 1.05, -3.3]], 0.2, '#5a3d27');
      }
      line(ctx, [[-1.4, -3.3], [0, -3.8], [1.4, -3.3]], 0.2, '#5a3d27');
      blob(ctx, 0, -3.75, 0.25, 0.2, '#a58cff', rng, 0.05);
    },
  };
}

// ------------------------------------------------------------------ registry
export function staticSprite(key: string): SpriteDef | null {
  const [id, a, b] = key.split(':');
  const v = +(b ?? 0);
  switch (id) {
    case 'pine_tree':
      return pineTree(+a, v % 3, key.endsWith(':s'));
    case 'burnt_tree':
      return burntTree();
    case 'pine_stump':
      return stump();
    case 'pine_sapling':
      return sapling(true, true);
    case 'sapling':
      return sapling(a === '1');
    case 'grass':
      return grass(a === '1', v);
    case 'berrybush':
      return berryBush(a as any, v);
    case 'carrot_plant':
      return carrotPlant();
    case 'flower':
      return flower(+a);
    case 'reeds':
      return reeds(a === '1');
    case 'boulder':
      return boulder(false, +a);
    case 'boulder_gold':
      return boulder(true, +a);
    case 'firepit':
      return firepit();
    case 'campfire':
      return campfire();
    case 'tinkers_bench':
      return tinkersBench();
    case 'alembic':
      return alembic();
    case 'cookpot':
      return cookpot();
    case 'chest':
      return chest(false);
    case 'icebox':
      return chest(true);
    case 'drying_rack':
      return dryingRack(a || undefined);
    case 'farm_plot':
      return farmPlot(a || undefined, b === '1');
    case 'wall_wood':
      return wall(false);
    case 'wall_stone':
      return wall(true);
    case 'hog_house':
      return hogHouse(a === '1');
    case 'tent':
      return tent();
    case 'trap':
      return trap(a === '1');
    case 'rabbit_hole':
      return rabbitHole();
    case 'spider_den':
      return spiderDen(+a);
    case 'pond':
      return pond(a === '1');
    case 'gravestone':
      return gravestone(+a);
    case 'grave_mound':
      return graveMound();
    case 'hollow_obelisk':
      return lampPost();
    case 'sign_start':
      return portal();
  }
  return null;
}
