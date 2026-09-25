/**
 * Item icons, drawn procedurally in a 2x2 box centered on the origin.
 * Used for inventory slots (as cached canvases) and for items lying on the ground.
 */
import { Rng, hashString } from '../engine/rng';
import { INK, blob, blobPts, circle, inked, line, polyPath, shade, smoothPath, type Ctx, type Pt } from './ink';
import { ITEMS } from '../content/defs';
import { getSprite, staticSprite } from './sprites/static';

const LW = 0.09;

function stick(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, w: number, color: string): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = w + LW * 2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
}

function bowl(ctx: Ctx, food: string, rng: Rng, garnish?: string): void {
  // dish contents
  blob(ctx, 0, -0.05, 0.62, 0.32, food, rng, LW, 0.15, 14);
  if (garnish) for (let i = 0; i < 4; i++) circle(ctx, rng.range(-0.4, 0.4), rng.range(-0.25, 0.05), 0.09, garnish, 0.05);
  // bowl
  ctx.beginPath();
  ctx.moveTo(-0.8, 0.05);
  ctx.quadraticCurveTo(-0.7, 0.7, 0, 0.72);
  ctx.quadraticCurveTo(0.7, 0.7, 0.8, 0.05);
  ctx.closePath();
  inked(ctx, '#c9b79a', LW);
  line(ctx, [[-0.55, 0.35], [0, 0.45], [0.55, 0.35]], 0.04, shade('#c9b79a', -0.3));
}

function meatShape(ctx: Ctx, color: string, rng: Rng, bone = true): void {
  if (bone) {
    stick(ctx, 0.25, 0.25, 0.75, 0.7, 0.16, '#efe6d2');
    circle(ctx, 0.78, 0.62, 0.12, '#efe6d2', LW);
    circle(ctx, 0.68, 0.78, 0.12, '#efe6d2', LW);
  }
  blob(ctx, -0.12, -0.1, 0.62, 0.5, color, rng, LW, 0.12, 12);
  smoothPath(ctx, blobPts(-0.2, -0.18, 0.32, 0.22, 9, 0.2, rng));
  inked(ctx, shade(color, 0.25), 0);
  line(ctx, [[-0.4, 0.05], [-0.1, -0.05], [0.2, 0.1]], 0.05, shade(color, -0.4));
}

function hat(ctx: Ctx, color: string, band: string, top = 0.55): void {
  ctx.beginPath();
  ctx.ellipse(0, 0.35, 0.9, 0.28, 0, 0, Math.PI * 2);
  inked(ctx, color, LW);
  ctx.beginPath();
  ctx.moveTo(-0.5, 0.35);
  ctx.quadraticCurveTo(-0.55, -top, 0, -top - 0.05);
  ctx.quadraticCurveTo(0.55, -top, 0.5, 0.35);
  ctx.closePath();
  inked(ctx, color, LW);
  ctx.fillStyle = band;
  ctx.fillRect(-0.5, 0.12, 1, 0.14);
}

export function drawIcon(ctx: Ctx, id: string): void {
  const rng = new Rng(hashString(id));
  ctx.lineJoin = 'round';
  switch (id) {
    case 'twigs':
      for (let i = 0; i < 4; i++) {
        const a = -0.5 + i * 0.3;
        stick(ctx, -0.7 + i * 0.1, 0.6 - i * 0.05, 0.7 - i * 0.12, -0.6 + a * 0.3, 0.09, '#7a5a3a');
      }
      stick(ctx, -0.1, 0.1, 0.1, -0.3, 0.06, '#8a6a44');
      break;
    case 'cutgrass':
      for (let i = -3; i <= 3; i++) line(ctx, [[i * 0.06, 0.7], [i * 0.12, 0], [i * 0.22 + rng.range(-0.1, 0.1), -0.75]], 0.11, i % 2 ? '#b9a653' : '#a39245');
      ctx.fillStyle = '#6a5a2a';
      ctx.fillRect(-0.3, 0.25, 0.6, 0.12);
      break;
    case 'log':
      ctx.save();
      ctx.rotate(-0.35);
      ctx.beginPath();
      ctx.roundRect(-0.8, -0.3, 1.4, 0.6, 0.15);
      inked(ctx, '#7d5634', LW);
      line(ctx, [[-0.6, -0.1], [0.3, -0.12]], 0.04, '#5a3c22');
      line(ctx, [[-0.5, 0.12], [0.4, 0.1]], 0.04, '#5a3c22');
      ctx.beginPath();
      ctx.ellipse(0.62, 0, 0.18, 0.3, 0, 0, Math.PI * 2);
      inked(ctx, '#d2b27c', LW);
      circle(ctx, 0.62, 0, 0.07, null, 0.04, '#8a6a44');
      ctx.restore();
      break;
    case 'rocks':
      blob(ctx, -0.35, 0.2, 0.38, 0.3, '#8d8a84', rng);
      blob(ctx, 0.35, 0.25, 0.34, 0.28, '#7d7a74', rng);
      blob(ctx, 0, -0.2, 0.4, 0.32, '#9d9a94', rng);
      break;
    case 'flint':
      polyPath(ctx, [[-0.5, 0.55], [-0.6, -0.1], [-0.1, -0.7], [0.5, -0.3], [0.55, 0.4], [0.05, 0.65]]);
      inked(ctx, '#3d3f48', LW);
      polyPath(ctx, [[-0.35, 0.2], [-0.1, -0.45], [0.2, -0.2], [-0.05, 0.25]]);
      inked(ctx, '#5b5e6a', 0);
      break;
    case 'gold':
      blob(ctx, 0, 0.05, 0.6, 0.45, '#d8a93a', rng, LW, 0.2, 10);
      blob(ctx, -0.15, -0.1, 0.22, 0.14, '#f4d77a', rng, 0, 0.2, 8);
      break;
    case 'pinecone':
      for (let r = 0; r < 5; r++)
        for (let c = -1; c <= 1; c++) {
          const y = -0.55 + r * 0.26;
          const w = 0.45 - Math.abs(r - 2) * 0.08;
          blob(ctx, c * w * 0.6, y, 0.2, 0.16, r % 2 ? '#7a5433' : '#6b4829', rng, 0.05, 0.1, 8);
        }
      break;
    case 'cutreeds':
      for (let i = -2; i <= 2; i++) stick(ctx, i * 0.15, 0.7, i * 0.2, -0.7, 0.08, '#6f7a45');
      ctx.fillStyle = '#4a3a22';
      ctx.fillRect(-0.4, 0.15, 0.8, 0.12);
      break;
    case 'petals':
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        blob(ctx, Math.cos(a) * 0.35, Math.sin(a) * 0.35, 0.28, 0.2, i % 2 ? '#e7a0b6' : '#f2c9d4', rng, 0.06);
      }
      circle(ctx, 0, 0, 0.14, '#f1d062');
      break;
    case 'charcoal':
      blob(ctx, 0, 0.1, 0.65, 0.45, '#2a2624', rng, LW, 0.2, 9);
      line(ctx, [[-0.3, -0.05], [0.2, 0.1]], 0.05, '#4a4442');
      break;
    case 'ash':
      blob(ctx, 0, 0.25, 0.7, 0.35, '#8b8783', rng, LW, 0.15);
      blob(ctx, 0.1, 0.05, 0.4, 0.25, '#a19d98', rng, 0, 0.2);
      break;
    case 'rope':
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(0, 0.1 - i * 0.08, 0.65 - i * 0.14, 0.4 - i * 0.08, 0, 0, Math.PI * 2);
        inked(ctx, i % 2 ? '#b89a5c' : '#c9ab6c', LW);
      }
      break;
    case 'boards':
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.rect(-0.8, -0.5 + i * 0.35, 1.6, 0.3);
        inked(ctx, i % 2 ? '#b98a55' : '#c99a65', LW);
        line(ctx, [[-0.6, -0.35 + i * 0.35], [0.5, -0.36 + i * 0.35]], 0.03, '#8a6034');
      }
      break;
    case 'cutstone':
      ctx.beginPath();
      ctx.rect(-0.6, -0.45, 1.2, 0.9);
      inked(ctx, '#a19d94', LW);
      ctx.beginPath();
      ctx.moveTo(-0.6, -0.45);
      ctx.lineTo(-0.35, -0.7);
      ctx.lineTo(0.85, -0.7);
      ctx.lineTo(0.6, -0.45);
      ctx.closePath();
      inked(ctx, '#bdb9b0', LW);
      ctx.beginPath();
      ctx.moveTo(0.6, -0.45);
      ctx.lineTo(0.85, -0.7);
      ctx.lineTo(0.85, 0.2);
      ctx.lineTo(0.6, 0.45);
      ctx.closePath();
      inked(ctx, '#7f7b73', LW);
      break;
    case 'silk':
      blob(ctx, 0, 0, 0.6, 0.55, '#ece8df', rng, LW, 0.12);
      for (let i = 0; i < 4; i++) line(ctx, [[-0.5, -0.3 + i * 0.2], [0, -0.2 + i * 0.2], [0.5, -0.3 + i * 0.2]], 0.03, '#b8b3a8');
      break;
    case 'spidergland':
      blob(ctx, 0, 0.05, 0.55, 0.5, '#d87a86', rng, LW, 0.15);
      circle(ctx, -0.15, -0.15, 0.12, '#f0b0b8', 0);
      break;
    case 'houndstooth':
      ctx.beginPath();
      ctx.moveTo(-0.35, -0.6);
      ctx.quadraticCurveTo(0.5, -0.6, 0.35, -0.2);
      ctx.quadraticCurveTo(0.2, 0.4, -0.1, 0.75);
      ctx.quadraticCurveTo(-0.25, 0.1, -0.35, -0.6);
      inked(ctx, '#ede3cc', LW);
      break;
    case 'hogskin':
      blob(ctx, 0, 0, 0.75, 0.55, '#d59a80', rng, LW, 0.12);
      circle(ctx, 0.35, -0.05, 0.2, '#e8b09a');
      circle(ctx, 0.3, -0.05, 0.04, INK, 0);
      circle(ctx, 0.42, -0.05, 0.04, INK, 0);
      break;
    case 'wool':
      for (let i = 0; i < 6; i++) blob(ctx, rng.range(-0.4, 0.4), rng.range(-0.3, 0.3), 0.32, 0.28, i % 2 ? '#5b4636' : '#6d5544', rng, 0.06, 0.2);
      break;
    case 'manure':
      blob(ctx, 0, 0.35, 0.65, 0.28, '#5a3f28', rng);
      blob(ctx, 0, 0.05, 0.45, 0.24, '#664830', rng);
      blob(ctx, 0.05, -0.2, 0.25, 0.18, '#704f35', rng);
      line(ctx, [[-0.3, -0.5], [-0.2, -0.8]], 0.03, '#7a8a3a');
      line(ctx, [[0.25, -0.45], [0.35, -0.75]], 0.03, '#7a8a3a');
      break;
    case 'rot':
      blob(ctx, 0, 0.2, 0.7, 0.42, '#5d6232', rng, LW, 0.25);
      blob(ctx, -0.2, 0.05, 0.25, 0.16, '#7d7a3a', rng, 0, 0.3);
      circle(ctx, 0.3, -0.2, 0.08, '#8c8c52', 0.04);
      break;
    case 'nightmarefuel':
      smoothPath(ctx, blobPts(0, 0.05, 0.6, 0.6, 10, 0.3, rng));
      inked(ctx, '#1d1426', LW);
      circle(ctx, -0.18, -0.1, 0.1, '#b79cff', 0);
      circle(ctx, 0.2, 0.05, 0.07, '#b79cff', 0);
      break;
    case 'rabbit':
      blob(ctx, 0, 0.2, 0.55, 0.42, '#9a7a5c', rng);
      blob(ctx, -0.1, -0.35, 0.12, 0.4, '#9a7a5c', rng);
      blob(ctx, 0.2, -0.35, 0.12, 0.4, '#9a7a5c', rng);
      circle(ctx, 0.2, 0.05, 0.06, INK, 0);
      break;
    // ---------------- foods
    case 'meat':
      meatShape(ctx, '#c24a4a', rng);
      break;
    case 'meat_cooked':
      meatShape(ctx, '#8a4a2e', rng);
      break;
    case 'morsel':
      blob(ctx, 0, 0, 0.5, 0.38, '#c55656', rng, LW, 0.15);
      circle(ctx, -0.1, -0.1, 0.12, '#e38a8a', 0);
      break;
    case 'morsel_cooked':
      blob(ctx, 0, 0, 0.5, 0.38, '#8e5232', rng, LW, 0.15);
      break;
    case 'froglegs':
    case 'froglegs_cooked': {
      const c = id === 'froglegs' ? '#7e9a5a' : '#8e6a3a';
      stick(ctx, -0.4, -0.5, 0.2, 0.5, 0.22, c);
      stick(ctx, 0.3, -0.5, -0.1, 0.5, 0.22, c);
      break;
    }
    case 'monstermeat':
      meatShape(ctx, '#8b4d7a', rng, false);
      circle(ctx, 0.15, -0.15, 0.08, '#d0e070', 0.04);
      break;
    case 'monstermeat_cooked':
      meatShape(ctx, '#5d3a52', rng, false);
      break;
    case 'jerky':
    case 'smalljerky':
    case 'monsterjerky': {
      const c = id === 'monsterjerky' ? '#5a3a4a' : '#7a3e2a';
      const n = id === 'smalljerky' ? 2 : 3;
      for (let i = 0; i < n; i++) {
        ctx.save();
        ctx.rotate(-0.5 + i * 0.35);
        ctx.beginPath();
        ctx.roundRect(-0.15, -0.7, 0.3, 1.3, 0.12);
        inked(ctx, shade(c, i * 0.1), LW);
        ctx.restore();
      }
      break;
    }
    case 'berries':
    case 'berries_cooked': {
      const c = id === 'berries' ? '#b3263e' : '#7a2a2a';
      const pts: Pt[] = [[-0.3, 0.2], [0.25, 0.25], [0, -0.2], [-0.3, -0.3], [0.35, -0.25], [0, 0.55]];
      for (const [x, y] of pts) {
        circle(ctx, x, y, 0.27, c, LW);
        circle(ctx, x - 0.08, y - 0.08, 0.06, shade(c, 0.5), 0);
      }
      line(ctx, [[0, -0.5], [0.1, -0.8]], 0.06, '#5a6a2a');
      break;
    }
    case 'carrot':
    case 'carrot_cooked': {
      const c = id === 'carrot' ? '#e0782a' : '#a8552a';
      ctx.beginPath();
      ctx.moveTo(-0.3, -0.45);
      ctx.quadraticCurveTo(0.35, -0.55, 0.3, -0.3);
      ctx.lineTo(0.05, 0.8);
      ctx.closePath();
      inked(ctx, c, LW);
      for (let i = -1; i <= 1; i++) line(ctx, [[0, -0.45], [i * 0.25, -0.8]], 0.08, '#5b7a2a');
      break;
    }
    case 'corn':
    case 'corn_cooked':
      if (id === 'corn') {
        blob(ctx, 0, 0, 0.3, 0.7, '#f0c93c', rng);
        line(ctx, [[-0.35, 0.7], [-0.45, -0.2], [-0.2, -0.75]], 0.12, '#7a9a3a');
        line(ctx, [[0.35, 0.7], [0.45, -0.2], [0.2, -0.75]], 0.12, '#7a9a3a');
      } else for (let i = 0; i < 7; i++) blob(ctx, rng.range(-0.45, 0.45), rng.range(-0.4, 0.4), 0.22, 0.2, '#f6ecc8', rng, 0.05, 0.3);
      break;
    case 'pumpkin':
    case 'pumpkin_cooked':
      blob(ctx, 0, 0.1, 0.72, 0.58, id === 'pumpkin' ? '#d9702a' : '#a64a22', rng);
      line(ctx, [[0, -0.45], [0, 0.65]], 0.05, '#8a3a1a');
      line(ctx, [[-0.35, -0.35], [-0.4, 0.6]], 0.04, '#8a3a1a');
      line(ctx, [[0.35, -0.35], [0.4, 0.6]], 0.04, '#8a3a1a');
      stick(ctx, 0, -0.45, 0.1, -0.75, 0.12, '#5a4a2a');
      break;
    case 'eggplant':
    case 'eggplant_cooked':
      ctx.save();
      ctx.rotate(0.5);
      blob(ctx, 0, 0.15, 0.4, 0.62, id === 'eggplant' ? '#5a2e6a' : '#4a2a3a', rng);
      ctx.restore();
      blob(ctx, -0.2, -0.5, 0.25, 0.14, '#5b7a2a', rng);
      break;
    case 'watermelon':
    case 'watermelon_cooked':
      ctx.beginPath();
      ctx.moveTo(-0.8, -0.2);
      ctx.quadraticCurveTo(0, 1.0, 0.8, -0.2);
      ctx.closePath();
      inked(ctx, '#3e7a3a', LW);
      ctx.beginPath();
      ctx.moveTo(-0.65, -0.2);
      ctx.quadraticCurveTo(0, 0.8, 0.65, -0.2);
      ctx.closePath();
      inked(ctx, id === 'watermelon' ? '#e0505a' : '#a0403a', 0.04);
      for (let i = -2; i <= 2; i++) circle(ctx, i * 0.2, 0.05 + Math.abs(i) * -0.05, 0.04, INK, 0);
      break;
    case 'seeds':
    case 'seeds_cooked':
      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.translate(rng.range(-0.45, 0.45), rng.range(-0.4, 0.4));
        ctx.rotate(rng.range(0, 3));
        ctx.beginPath();
        ctx.ellipse(0, 0, 0.16, 0.1, 0, 0, Math.PI * 2);
        inked(ctx, id === 'seeds' ? '#d8c490' : '#9a7a44', 0.05);
        ctx.restore();
      }
      break;
    case 'meatballs':
      bowl(ctx, '#8a4a2e', rng);
      for (let i = 0; i < 3; i++) circle(ctx, -0.3 + i * 0.3, -0.15, 0.2, '#9a5a3a', 0.06);
      break;
    case 'meatystew':
      bowl(ctx, '#7a3a22', rng, '#c05030');
      break;
    case 'kabobs':
      stick(ctx, -0.8, 0.8, 0.8, -0.8, 0.07, '#8a6a44');
      for (let i = 0; i < 3; i++) blob(ctx, -0.35 + i * 0.35, 0.35 - i * 0.35, 0.2, 0.2, i % 2 ? '#a0502e' : '#7a3a22', rng);
      break;
    case 'ratatouille':
      bowl(ctx, '#a0602a', rng, '#6a8a2a');
      break;
    case 'berryjam':
      ctx.beginPath();
      ctx.roundRect(-0.5, -0.4, 1, 1.1, 0.2);
      inked(ctx, '#8a1a2e', LW);
      ctx.beginPath();
      ctx.rect(-0.55, -0.65, 1.1, 0.3);
      inked(ctx, '#d8c8a0', LW);
      break;
    case 'fruitmedley':
      bowl(ctx, '#e06070', rng, '#f0c040');
      break;
    case 'frogbun':
      blob(ctx, 0, 0.25, 0.75, 0.25, '#c99a55', rng);
      blob(ctx, 0, 0.02, 0.7, 0.14, '#7e9a5a', rng);
      blob(ctx, 0, -0.25, 0.72, 0.3, '#d8aa65', rng);
      break;
    case 'stuffedeggplant':
      ctx.save();
      ctx.rotate(0.3);
      blob(ctx, 0, 0, 0.45, 0.7, '#4a2a5a', rng);
      blob(ctx, 0, -0.1, 0.25, 0.45, '#c9a65a', rng);
      ctx.restore();
      break;
    case 'pumpkinstew':
      bowl(ctx, '#d0702a', rng, '#f0d060');
      break;
    case 'monsterlasagna':
      ctx.beginPath();
      ctx.rect(-0.7, -0.35, 1.4, 0.8);
      inked(ctx, '#7a4a6a', LW);
      for (let i = 0; i < 3; i++) line(ctx, [[-0.65, -0.15 + i * 0.22], [0.65, -0.15 + i * 0.22]], 0.06, i % 2 ? '#d0c050' : '#5a2a4a');
      break;
    case 'wetgoop':
      bowl(ctx, '#7a8a5a', rng);
      circle(ctx, 0.2, -0.3, 0.1, '#9aaa7a', 0.04);
      break;
    // ---------------- tools & gear
    case 'axe':
      stick(ctx, -0.6, 0.75, 0.45, -0.55, 0.12, '#8a6a44');
      polyPath(ctx, [[0.15, -0.6], [0.7, -0.75], [0.8, -0.2], [0.35, -0.2]]);
      inked(ctx, '#7d8290', LW);
      break;
    case 'pickaxe':
      stick(ctx, -0.6, 0.75, 0.35, -0.35, 0.12, '#8a6a44');
      ctx.beginPath();
      ctx.moveTo(-0.3, -0.7);
      ctx.quadraticCurveTo(0.35, -0.75, 0.85, -0.05);
      ctx.quadraticCurveTo(0.3, -0.45, -0.3, -0.55);
      ctx.closePath();
      inked(ctx, '#6d7280', LW);
      break;
    case 'shovel':
      stick(ctx, -0.5, 0.75, 0.3, -0.25, 0.1, '#8a6a44');
      ctx.save();
      ctx.translate(0.45, -0.45);
      ctx.rotate(0.9);
      ctx.beginPath();
      ctx.moveTo(-0.25, 0);
      ctx.lineTo(0.25, 0);
      ctx.quadraticCurveTo(0.3, 0.45, 0, 0.55);
      ctx.quadraticCurveTo(-0.3, 0.45, -0.25, 0);
      ctx.restore();
      inked(ctx, '#7d8290', LW);
      break;
    case 'hammer':
      stick(ctx, -0.6, 0.75, 0.3, -0.3, 0.12, '#8a6a44');
      ctx.save();
      ctx.translate(0.35, -0.4);
      ctx.rotate(-0.7);
      ctx.beginPath();
      ctx.rect(-0.45, -0.18, 0.9, 0.36);
      inked(ctx, '#6d6a66', LW);
      ctx.restore();
      break;
    case 'razor':
      stick(ctx, -0.6, 0.6, 0.0, 0.0, 0.14, '#5a4a3a');
      polyPath(ctx, [[-0.05, 0.05], [0.7, -0.6], [0.8, -0.45], [0.1, 0.15]]);
      inked(ctx, '#c9ccd4', LW);
      break;
    case 'torch':
      stick(ctx, -0.35, 0.8, 0.2, -0.3, 0.14, '#7a5a3a');
      blob(ctx, 0.25, -0.35, 0.22, 0.18, '#b9a653', rng, LW);
      smoothPath(ctx, [[0.25, -0.95], [0.45, -0.5], [0.25, -0.35], [0.05, -0.5]]);
      inked(ctx, '#f2a33a', 0.05);
      break;
    case 'umbrella':
      stick(ctx, 0, -0.3, 0, 0.8, 0.08, '#4a3a2a');
      ctx.beginPath();
      ctx.moveTo(-0.85, -0.05);
      ctx.quadraticCurveTo(0, -1.0, 0.85, -0.05);
      ctx.quadraticCurveTo(0.42, -0.2, 0, -0.05);
      ctx.quadraticCurveTo(-0.42, -0.2, -0.85, -0.05);
      inked(ctx, '#5a3a5a', LW);
      break;
    case 'spear':
      stick(ctx, -0.75, 0.75, 0.45, -0.45, 0.1, '#8a6a44');
      polyPath(ctx, [[0.35, -0.3], [0.85, -0.85], [0.55, -0.2]]);
      inked(ctx, '#4d5058', LW);
      line(ctx, [[0.25, -0.2], [0.4, -0.4]], 0.08, '#c9ab6c');
      break;
    case 'logsuit':
      ctx.beginPath();
      ctx.roundRect(-0.55, -0.7, 1.1, 1.4, 0.25);
      inked(ctx, '#8a603a', LW);
      for (let i = -1; i <= 1; i++) line(ctx, [[i * 0.3, -0.65], [i * 0.3, 0.65]], 0.04, '#5a3c22');
      stick(ctx, -0.6, -0.2, 0.6, -0.2, 0.08, '#c9ab6c');
      stick(ctx, -0.6, 0.3, 0.6, 0.3, 0.08, '#c9ab6c');
      break;
    case 'hoghelm':
      ctx.beginPath();
      ctx.arc(0, 0.2, 0.7, Math.PI, 0);
      ctx.lineTo(0.7, 0.4);
      ctx.lineTo(-0.7, 0.4);
      ctx.closePath();
      inked(ctx, '#b07a58', LW);
      line(ctx, [[0, -0.5], [0, 0.4]], 0.05, '#7a4a30');
      break;
    case 'strawhat':
      hat(ctx, '#d8bc6a', '#8a5a2a', 0.35);
      break;
    case 'garland':
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        circle(ctx, Math.cos(a) * 0.55, Math.sin(a) * 0.35, 0.18, ['#e7a0b6', '#f2d36a', '#b9c8f0'][i % 3], 0.05);
      }
      break;
    case 'woolcap':
      ctx.beginPath();
      ctx.arc(0, 0.3, 0.65, Math.PI, 0);
      ctx.closePath();
      inked(ctx, '#7a4a3a', LW);
      circle(ctx, 0, -0.45, 0.2, '#e8dccb');
      ctx.fillStyle = '#e8dccb';
      ctx.fillRect(-0.65, 0.18, 1.3, 0.2);
      break;
    case 'earmuffs':
      ctx.beginPath();
      ctx.arc(0, 0.1, 0.55, Math.PI, 0);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.14;
      ctx.stroke();
      circle(ctx, -0.55, 0.25, 0.3, '#b09070');
      circle(ctx, 0.55, 0.25, 0.3, '#b09070');
      break;
    case 'tophat':
      hat(ctx, '#2a2a30', '#7a2a3a', 0.8);
      break;
    case 'shagcoat':
      ctx.beginPath();
      ctx.moveTo(-0.6, -0.6);
      ctx.lineTo(0.6, -0.6);
      ctx.lineTo(0.75, 0.75);
      ctx.lineTo(-0.75, 0.75);
      ctx.closePath();
      inked(ctx, '#5b4636', LW);
      for (let i = 0; i < 8; i++) blob(ctx, rng.range(-0.5, 0.5), rng.range(-0.4, 0.6), 0.18, 0.15, '#6d5544', rng, 0.04, 0.3, 8);
      break;
    case 'backpack':
      ctx.beginPath();
      ctx.roundRect(-0.55, -0.6, 1.1, 1.3, 0.3);
      inked(ctx, '#8a7a4a', LW);
      ctx.beginPath();
      ctx.roundRect(-0.35, 0.05, 0.7, 0.45, 0.1);
      inked(ctx, '#9a8a5a', LW);
      line(ctx, [[-0.3, -0.6], [-0.2, -0.85], [0.2, -0.85], [0.3, -0.6]], 0.08);
      break;
    case 'thermalstone':
      blob(ctx, 0, 0.1, 0.65, 0.5, '#8a8078', rng, LW, 0.1);
      line(ctx, [[-0.3, -0.1], [0, 0.1], [0.3, -0.05]], 0.05, '#c06a3a');
      break;
    case 'salve':
      ctx.beginPath();
      ctx.roundRect(-0.5, -0.3, 1, 0.8, 0.15);
      inked(ctx, '#d8c8a0', LW);
      ctx.beginPath();
      ctx.rect(-0.55, -0.55, 1.1, 0.3);
      inked(ctx, '#8a5a3a', LW);
      circle(ctx, 0, 0.1, 0.15, '#c04040', 0.04);
      break;
    case 'strawroll':
      ctx.beginPath();
      ctx.ellipse(0, 0, 0.8, 0.45, 0, 0, Math.PI * 2);
      inked(ctx, '#c9ab5c', LW);
      ctx.beginPath();
      ctx.ellipse(0.55, 0, 0.2, 0.42, 0, 0, Math.PI * 2);
      inked(ctx, '#b09040', LW);
      stick(ctx, -0.2, -0.45, -0.2, 0.45, 0.06, '#7a5a2a');
      break;
    case 'trap_item':
      ctx.beginPath();
      ctx.moveTo(-0.7, 0.6);
      ctx.quadraticCurveTo(0, -1.1, 0.7, 0.6);
      ctx.closePath();
      inked(ctx, '#b9a653', LW);
      for (let i = -2; i <= 2; i++) line(ctx, [[i * 0.25, 0.6], [0, -0.5]], 0.03, '#7a6a2a');
      break;
    case 'wall_wood_item':
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 0.4 - 0.18, 0.7);
        ctx.lineTo(i * 0.4 - 0.18, -0.5);
        ctx.lineTo(i * 0.4, -0.75);
        ctx.lineTo(i * 0.4 + 0.18, -0.5);
        ctx.lineTo(i * 0.4 + 0.18, 0.7);
        ctx.closePath();
        inked(ctx, '#9a7048', LW);
      }
      break;
    case 'wall_stone_item':
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 2; c++) {
          ctx.beginPath();
          ctx.rect(-0.7 + c * 0.7 + (r % 2) * 0.2 - 0.1, 0.35 - r * 0.4, 0.62, 0.36);
          inked(ctx, shade('#9a978f', (r + c) * 0.05), 0.06);
        }
      break;
    default:
      circle(ctx, 0, 0, 0.6, '#a08a6a');
  }
}

const iconCache = new Map<string, HTMLCanvasElement>();

/** Cached icon canvas (px size). */
export function iconCanvas(id: string, px = 64): HTMLCanvasElement {
  const key = `${id}@${px}`;
  let c = iconCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = px;
  const ctx = c.getContext('2d')!;
  const spr = !ITEMS.has(id) ? getSprite(id, () => staticSprite(id)) : null;
  if (spr) {
    // structure icon: fit its world sprite into the box
    const w = spr.canvas.width;
    const h = spr.canvas.height;
    const k = (px * 0.92) / Math.max(w, h);
    ctx.drawImage(spr.canvas, (px - w * k) / 2, (px - h * k) / 2, w * k, h * k);
  } else {
    ctx.translate(px / 2, px / 2);
    ctx.scale(px * 0.42, px * 0.42);
    drawIcon(ctx, id);
  }
  iconCache.set(key, c);
  return c;
}

const urlCache = new Map<string, string>();
export function iconURL(id: string): string {
  let u = urlCache.get(id);
  if (!u) {
    u = iconCanvas(id, 72).toDataURL();
    urlCache.set(id, u);
  }
  return u;
}
