/**
 * Procedurally animated actors, drawn every frame in world units with the origin at the feet.
 * The caller mirrors the context for facing. `t` is state elapsed time, `time` is global time.
 */
import { Rng } from '../../engine/rng';
import type { Entity } from '../../sim/types';
import { INK, blob, circle, groundShadow, inked, line, polyPath, shade, type Ctx } from '../ink';
import { drawIcon } from '../icons';

export interface ActorPose {
  state: string;
  t: number; // seconds in state
  time: number;
  moving: boolean;
  speed: number;
}

const rngFor = (e: Entity) => new Rng(e.id * 7 + 3);

function legs(ctx: Ctx, p: ActorPose, x: number, len: number, w: number, color: string, phase = 0): void {
  const swing = p.moving ? Math.sin(p.time * 11 + phase) * 0.35 : 0;
  for (const s of [-1, 1]) {
    const a = swing * s;
    line(ctx, [[x + s * 0.12, -len], [x + s * 0.12 + Math.sin(a) * len * 0.5, -len * 0.45], [x + s * 0.12 + Math.sin(a) * len, 0]], w, color);
  }
}

// ------------------------------------------------------------------ player: Silas the lamplighter
export function drawPlayer(ctx: Ctx, e: Entity, p: ActorPose): void {
  const inv = e.inventory!;
  const st = p.state;
  if (st === 'dead') {
    ctx.save();
    ctx.rotate(-Math.PI / 2);
    ctx.translate(0.2, 0);
    drawPlayerBody(ctx, e, { ...p, moving: false }, inv);
    ctx.restore();
    return;
  }
  if (st === 'sleep') {
    groundShadow(ctx, 0, 0.05, 1.2, 0.3);
    ctx.save();
    ctx.translate(-0.6, -0.1);
    ctx.rotate(-Math.PI / 2 + 0.15);
    drawPlayerBody(ctx, e, { ...p, moving: false }, inv, true);
    ctx.restore();
    return;
  }
  groundShadow(ctx, 0, 0.05, 0.6, 0.18);
  drawPlayerBody(ctx, e, p, inv);
}

function drawPlayerBody(ctx: Ctx, e: Entity, p: ActorPose, inv: NonNullable<Entity['inventory']>, eyesClosed = false): void {
  const st = p.state;
  const bob = p.moving ? Math.abs(Math.sin(p.time * 11)) * 0.08 : Math.sin(p.time * 2) * 0.03;
  const crouch = st === 'pickup' ? 0.35 * Math.sin(Math.min(1, p.t / 0.3) * Math.PI) : st === 'build' ? 0.2 : 0;
  const coat = '#3b3548';
  legs(ctx, p, 0, 1.0 - crouch * 0.5, 0.13, '#2a2530');
  ctx.save();
  ctx.translate(0, -bob - crouch * 0.4);
  // body armor / coat
  const body = inv.equip.body?.id;
  ctx.beginPath();
  ctx.moveTo(-0.42, -0.95);
  ctx.quadraticCurveTo(-0.55, -1.7, -0.32, -2.05);
  ctx.lineTo(0.32, -2.05);
  ctx.quadraticCurveTo(0.55, -1.7, 0.42, -0.95);
  ctx.closePath();
  inked(ctx, body === 'shagcoat' ? '#5b4636' : coat, 0.09);
  line(ctx, [[0.02, -2.0], [0.0, -1.0]], 0.04, '#221e2a');
  circle(ctx, 0.12, -1.6, 0.04, '#c9a24a', 0);
  circle(ctx, 0.12, -1.35, 0.04, '#c9a24a', 0);
  if (body === 'logsuit') {
    ctx.beginPath();
    ctx.roundRect(-0.48, -2.0, 0.96, 1.05, 0.15);
    inked(ctx, '#8a603a', 0.08);
    for (let i = -1; i <= 1; i++) line(ctx, [[i * 0.25, -1.95], [i * 0.25, -1.0]], 0.035, '#5a3c22');
  }
  if (body === 'backpack') {
    ctx.beginPath();
    ctx.roundRect(-0.7, -1.95, 0.35, 0.8, 0.1);
    inked(ctx, '#8a7a4a', 0.07);
  }
  // scarf
  ctx.beginPath();
  ctx.ellipse(0, -2.05, 0.36, 0.12, 0, 0, Math.PI * 2);
  inked(ctx, '#c0563a', 0.07);
  line(ctx, [[-0.2, -2.0], [-0.32, -1.6]], 0.12, '#c0563a');

  // arm + held item
  const hand = inv.equip.hand?.id;
  let armA = p.moving ? Math.sin(p.time * 11) * 0.5 : 0.1;
  if (st === 'work') armA = -2.2 + Math.sin(Math.min(1, p.t / 0.5) * Math.PI) * 2.6;
  if (st === 'attack') armA = -2.0 + Math.min(1, p.t / 0.18) * 2.8;
  if (st === 'eat') armA = -2.4;
  if (st === 'pickup') armA = 0.9;
  ctx.save();
  ctx.translate(0.22, -1.85);
  ctx.rotate(armA);
  if (hand) {
    ctx.save();
    ctx.translate(0.05, 0.75);
    ctx.rotate(-0.8);
    ctx.scale(0.55, 0.55);
    drawIcon(ctx, hand);
    ctx.restore();
  }
  line(ctx, [[0, 0], [0.05, 0.4], [0.05, 0.72]], 0.15, coat);
  circle(ctx, 0.05, 0.76, 0.09, '#e8d6c0', 0.05);
  ctx.restore();

  // head
  const hx = 0;
  const hy = -2.55;
  ctx.beginPath();
  ctx.ellipse(hx, hy, 0.46, 0.5, 0, 0, Math.PI * 2);
  inked(ctx, '#ecdcc4', 0.09);
  // stubble shadow
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(hx, hy, 0.46, 0.5, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#5a4a40';
  ctx.fillRect(-0.5, hy + 0.2, 1, 0.4);
  ctx.restore();
  // eyes
  const blink = Math.sin(p.time * 1.3 + e.id) > 0.985;
  if (eyesClosed || blink || st === 'dead') {
    line(ctx, [[0.02, hy - 0.02], [0.16, hy - 0.02]], 0.04);
    line(ctx, [[0.24, hy - 0.02], [0.36, hy - 0.02]], 0.04);
  } else {
    ctx.beginPath();
    ctx.ellipse(0.1, hy - 0.04, 0.07, 0.11, 0, 0, Math.PI * 2);
    ctx.ellipse(0.3, hy - 0.04, 0.06, 0.1, 0, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
  }
  line(ctx, [[0.15, hy + 0.22], [0.3, hy + 0.2]], 0.035);
  // hair tufts
  for (let i = 0; i < 5; i++) {
    const a = -2.6 + i * 0.35;
    polyPath(ctx, [[hx + Math.cos(a) * 0.42, hy + Math.sin(a) * 0.45], [hx + Math.cos(a) * 0.7, hy + Math.sin(a) * 0.75 - 0.05], [hx + Math.cos(a + 0.25) * 0.42, hy + Math.sin(a + 0.25) * 0.45]]);
    inked(ctx, '#2a2226', 0.05);
  }
  // hat
  const head = inv.equip.head?.id;
  if (head) {
    ctx.save();
    ctx.translate(hx, hy - 0.5);
    ctx.scale(0.55, 0.5);
    drawIcon(ctx, head);
    ctx.restore();
  } else {
    // lamplighter's cap
    ctx.beginPath();
    ctx.moveTo(-0.44, hy - 0.2);
    ctx.quadraticCurveTo(-0.4, hy - 0.7, 0.05, hy - 0.72);
    ctx.quadraticCurveTo(0.45, hy - 0.68, 0.45, hy - 0.25);
    ctx.closePath();
    inked(ctx, '#4a3f36', 0.08);
    line(ctx, [[0.1, hy - 0.24], [0.65, hy - 0.18]], 0.1, '#3a302a');
  }
  ctx.restore();
}

// ------------------------------------------------------------------ creatures
function eye(ctx: Ctx, x: number, y: number, r: number, color = INK): void {
  circle(ctx, x, y, r, color, 0);
}

function rabbit(ctx: Ctx, e: Entity, p: ActorPose): void {
  const hop = p.moving ? Math.abs(Math.sin(p.time * 14)) * 0.35 : 0;
  groundShadow(ctx, 0, 0.03, 0.4, 0.1);
  ctx.save();
  ctx.translate(0, -hop);
  const rng = rngFor(e);
  blob(ctx, 0, -0.35, 0.42, 0.32, '#9a7a5c', rng, 0.07);
  blob(ctx, 0.35, -0.6, 0.24, 0.22, '#9a7a5c', rng, 0.07);
  blob(ctx, 0.28, -1.0, 0.07, 0.25, '#9a7a5c', rng, 0.05);
  blob(ctx, 0.42, -1.0, 0.07, 0.25, '#8a6a4c', rng, 0.05);
  circle(ctx, -0.42, -0.35, 0.1, '#e8ddd0', 0.04);
  eye(ctx, 0.44, -0.63, 0.05);
  ctx.restore();
}

function crow(ctx: Ctx, e: Entity, p: ActorPose): void {
  const flying = p.state === 'walk' && !p.moving ? false : p.moving && p.speed > 3;
  const peck = p.state === 'work' ? Math.sin(Math.min(1, p.t / 0.4) * Math.PI) * 0.5 : 0;
  if (!flying) groundShadow(ctx, 0, 0.03, 0.3, 0.08);
  const rng = rngFor(e);
  ctx.save();
  if (flying) ctx.translate(0, -1.2);
  blob(ctx, 0, -0.35, 0.35, 0.25, '#221e22', rng, 0.06);
  ctx.save();
  ctx.translate(0.28, -0.5);
  ctx.rotate(peck);
  blob(ctx, 0, 0, 0.17, 0.16, '#221e22', rng, 0.05);
  polyPath(ctx, [[0.12, -0.03], [0.35, 0.03], [0.12, 0.07]]);
  inked(ctx, '#d0a040', 0.03);
  eye(ctx, 0.05, -0.04, 0.035, '#f0e0a0');
  ctx.restore();
  if (flying) {
    const f = Math.sin(p.time * 25) * 0.6;
    polyPath(ctx, [[-0.1, -0.4], [-0.5, -0.8 - f * 0.5], [0.2, -0.45]]);
    inked(ctx, '#2a262a', 0.05);
  } else {
    line(ctx, [[-0.05, -0.12], [-0.05, 0]], 0.04, '#b08030');
    line(ctx, [[0.08, -0.12], [0.1, 0]], 0.04, '#b08030');
  }
  polyPath(ctx, [[-0.3, -0.4], [-0.6, -0.3], [-0.3, -0.25]]);
  inked(ctx, '#221e22', 0.04);
  ctx.restore();
}

function hog(ctx: Ctx, e: Entity, p: ActorPose): void {
  const bob = p.moving ? Math.abs(Math.sin(p.time * 9)) * 0.1 : Math.sin(p.time * 2 + e.id) * 0.03;
  groundShadow(ctx, 0, 0.05, 0.7, 0.18);
  const rng = rngFor(e);
  const skin = '#d59a80';
  legs(ctx, p, 0, 0.7, 0.16, shade(skin, -0.15));
  ctx.save();
  ctx.translate(0, -bob);
  // belly
  blob(ctx, 0, -1.25, 0.7, 0.72, skin, rng, 0.09, 0.06);
  ctx.beginPath();
  ctx.ellipse(0.1, -1.1, 0.42, 0.45, 0, 0, Math.PI * 2);
  inked(ctx, shade(skin, 0.15), 0);
  // vest
  ctx.beginPath();
  ctx.moveTo(-0.6, -1.7);
  ctx.quadraticCurveTo(-0.7, -1.0, -0.4, -0.75);
  ctx.lineTo(-0.2, -1.6);
  ctx.closePath();
  inked(ctx, '#6a5a8a', 0.06);
  // arm
  let armA = p.moving ? Math.sin(p.time * 9) * 0.5 : 0.2;
  if (p.state === 'attack') armA = -1.8 + Math.min(1, p.t / 0.45) * 2.6;
  if (p.state === 'eat') armA = -2.3;
  ctx.save();
  ctx.translate(0.35, -1.5);
  ctx.rotate(armA);
  line(ctx, [[0, 0], [0.05, 0.55]], 0.16, skin);
  circle(ctx, 0.05, 0.6, 0.1, shade(skin, -0.1), 0.05);
  ctx.restore();
  // head
  blob(ctx, 0.15, -2.2, 0.48, 0.42, skin, rng, 0.09, 0.05);
  polyPath(ctx, [[-0.2, -2.45], [-0.35, -2.85], [0.0, -2.55]]);
  inked(ctx, shade(skin, -0.1), 0.06);
  polyPath(ctx, [[0.3, -2.5], [0.4, -2.9], [0.5, -2.5]]);
  inked(ctx, shade(skin, -0.1), 0.06);
  ctx.beginPath();
  ctx.ellipse(0.55, -2.1, 0.2, 0.16, 0, 0, Math.PI * 2);
  inked(ctx, '#e8b09a', 0.06);
  eye(ctx, 0.5, -2.1, 0.035);
  eye(ctx, 0.62, -2.1, 0.035);
  eye(ctx, 0.28, -2.3, 0.05);
  line(ctx, [[0.2, -2.42], [0.36, -2.38]], 0.035);
  if (e.follower) circle(ctx, -0.1, -2.95, 0.08, '#f0d060', 0.03);
  ctx.restore();
}

function shagbeast(ctx: Ctx, e: Entity, p: ActorPose, shaved: boolean): void {
  const sleep = p.state === 'sleep';
  const bob = p.moving ? Math.abs(Math.sin(p.time * 6)) * 0.08 : Math.sin(p.time * 1.2 + e.id) * 0.04;
  groundShadow(ctx, 0, 0.05, 1.5, 0.35);
  const rng = rngFor(e);
  const fur = shaved ? '#8a7470' : '#4e3b2e';
  if (!sleep) {
    for (const x of [-0.8, -0.4, 0.5, 0.9]) {
      const sw = p.moving ? Math.sin(p.time * 6 + x * 3) * 0.2 : 0;
      line(ctx, [[x, -0.8], [x + sw, 0]], 0.26, '#2a201a');
    }
  }
  ctx.save();
  ctx.translate(0, sleep ? 0.55 : -bob);
  // shaggy body
  blob(ctx, -0.1, -1.6, 1.35, 0.95, fur, rng, 0.1, 0.12, 14);
  if (!shaved)
    for (let i = 0; i < 14; i++) {
      const x = rng.range(-1.2, 1.0);
      const y = rng.range(-2.3, -0.9);
      line(ctx, [[x, y], [x + 0.05, y + 0.35]], 0.06, shade(fur, 0.15));
    }
  // head with horns
  blob(ctx, 1.05, -1.3, 0.55, 0.55, shade(fur, -0.15), rng, 0.09);
  ctx.beginPath();
  ctx.moveTo(0.8, -1.75);
  ctx.quadraticCurveTo(0.3, -2.4, 0.55, -2.55);
  ctx.quadraticCurveTo(0.65, -2.2, 1.0, -1.8);
  inked(ctx, '#e0d4bc', 0.06);
  ctx.beginPath();
  ctx.moveTo(1.3, -1.75);
  ctx.quadraticCurveTo(1.9, -2.3, 1.75, -2.5);
  ctx.quadraticCurveTo(1.55, -2.2, 1.15, -1.85);
  inked(ctx, '#e0d4bc', 0.06);
  ctx.beginPath();
  ctx.ellipse(1.35, -1.05, 0.28, 0.2, 0, 0, Math.PI * 2);
  inked(ctx, '#6a5a50', 0.06);
  if (sleep) {
    line(ctx, [[1.0, -1.4], [1.15, -1.4]], 0.04);
  } else {
    eye(ctx, 1.1, -1.4, 0.06);
  }
  ctx.restore();
}

function spider(ctx: Ctx, e: Entity, p: ActorPose, warrior: boolean): void {
  const s = warrior ? 1.2 : 1;
  const bob = p.moving ? Math.sin(p.time * 16) * 0.05 : 0;
  groundShadow(ctx, 0, 0.03, 0.8 * s, 0.18);
  const rng = rngFor(e);
  ctx.save();
  ctx.scale(s, s);
  // legs
  for (let i = 0; i < 4; i++) {
    for (const side of [-1, 1]) {
      const ph = p.moving ? Math.sin(p.time * 16 + i * 1.3 + (side > 0 ? 0 : Math.PI)) * 0.15 : 0;
      const bx = (i - 1.5) * 0.18;
      line(ctx, [[bx, -0.55], [bx + side * 0.55 + ph, -0.9], [bx + side * 0.8 + ph, 0]], 0.07, '#141012');
    }
  }
  ctx.translate(0, bob);
  const body = warrior ? '#2a2418' : '#1e1a1c';
  blob(ctx, -0.25, -0.75, 0.52, 0.42, body, rng, 0.07);
  if (warrior) for (let i = 0; i < 3; i++) line(ctx, [[-0.55 + i * 0.25, -1.05], [-0.5 + i * 0.25, -0.45]], 0.07, '#c9a03a');
  else for (let i = 0; i < 3; i++) circle(ctx, rng.range(-0.55, 0.05), rng.range(-0.95, -0.6), 0.05, '#e0d8d0', 0);
  blob(ctx, 0.3, -0.6, 0.3, 0.26, body, rng, 0.07);
  const ec = p.state === 'attack' ? '#ff5040' : '#d03a30';
  eye(ctx, 0.42, -0.66, 0.06, ec);
  eye(ctx, 0.52, -0.58, 0.05, ec);
  eye(ctx, 0.35, -0.55, 0.04, ec);
  const bite = p.state === 'attack' ? Math.sin(Math.min(1, p.t / 0.45) * Math.PI) * 0.15 : 0;
  line(ctx, [[0.55, -0.45], [0.7 + bite, -0.35]], 0.05, '#e0d8d0');
  ctx.restore();
}

function frog(ctx: Ctx, e: Entity, p: ActorPose): void {
  const hop = p.moving ? Math.abs(Math.sin(p.time * 10)) * 0.35 : 0;
  groundShadow(ctx, 0, 0.03, 0.45, 0.12);
  const rng = rngFor(e);
  ctx.save();
  ctx.translate(0, -hop);
  blob(ctx, 0, -0.35, 0.5, 0.35, '#5f7a3e', rng, 0.07);
  ctx.beginPath();
  ctx.ellipse(0.1, -0.25, 0.3, 0.18, 0, 0, Math.PI * 2);
  inked(ctx, '#b8b87a', 0);
  circle(ctx, 0.2, -0.72, 0.13, '#6f8a4e', 0.05);
  circle(ctx, -0.1, -0.72, 0.13, '#6f8a4e', 0.05);
  eye(ctx, 0.22, -0.74, 0.06);
  eye(ctx, -0.08, -0.74, 0.06);
  line(ctx, [[-0.4, -0.15], [-0.6, 0]], 0.1, '#4f6a2e');
  line(ctx, [[0.4, -0.15], [0.6, 0]], 0.1, '#4f6a2e');
  ctx.restore();
}

function hound(ctx: Ctx, e: Entity, p: ActorPose): void {
  const run = p.moving;
  groundShadow(ctx, 0, 0.05, 0.9, 0.2);
  const rng = rngFor(e);
  for (const x of [-0.55, -0.3, 0.45, 0.7]) {
    const sw = run ? Math.sin(p.time * 18 + x * 4) * 0.3 : 0;
    line(ctx, [[x, -0.65], [x + sw, 0]], 0.12, '#1e1a1c');
  }
  ctx.save();
  ctx.translate(0, run ? Math.sin(p.time * 18) * 0.05 : 0);
  blob(ctx, 0, -0.9, 0.85, 0.36, '#2e2a2e', rng, 0.08, 0.1);
  // spiky back
  for (let i = 0; i < 5; i++) polyPath(ctx, [[-0.6 + i * 0.25, -1.15], [-0.52 + i * 0.25, -1.5], [-0.4 + i * 0.25, -1.15]]), inked(ctx, '#2e2a2e', 0.05);
  ctx.save();
  ctx.translate(0.8, -1.1);
  const bite = p.state === 'attack' ? Math.sin(Math.min(1, p.t / 0.45) * Math.PI) * 0.3 : 0;
  ctx.rotate(-bite * 0.5);
  blob(ctx, 0, 0, 0.36, 0.28, '#2e2a2e', rng, 0.08);
  polyPath(ctx, [[0.15, 0.05], [0.65, 0.1 + bite * 0.3], [0.15, 0.25]]);
  inked(ctx, '#2e2a2e', 0.06);
  polyPath(ctx, [[-0.1, -0.2], [-0.05, -0.55], [0.1, -0.2]]);
  inked(ctx, '#2e2a2e', 0.05);
  eye(ctx, 0.15, -0.05, 0.06, '#e03a30');
  line(ctx, [[0.25, 0.15], [0.5, 0.18]], 0.03, '#e8e0d0');
  ctx.restore();
  polyPath(ctx, [[-0.8, -1.0], [-1.3, -1.3], [-0.85, -0.8]]);
  inked(ctx, '#2e2a2e', 0.05);
  ctx.restore();
}

function shadowCreature(ctx: Ctx, e: Entity, p: ActorPose, beak: boolean, solid: boolean): void {
  ctx.save();
  const flick = 0.75 + Math.sin(p.time * 13) * 0.08 + Math.sin(p.time * 5.3) * 0.07;
  ctx.globalAlpha = (solid ? 0.9 : 0.28) * flick;
  const w = p.time * 3 + e.id;
  const rng = new Rng(Math.floor(p.time * 8) + e.id);
  const ink = '#050308';
  // smoky aura
  ctx.fillStyle = 'rgba(60,20,80,0.25)';
  smoothPath2(ctx, 0, beak ? -1.6 : -0.6, beak ? 1.2 : 1.6, beak ? 1.6 : 0.8, rng);
  ctx.fill();
  ctx.fillStyle = ink;
  if (!beak) {
    // crawling dread: a flat ink blot with many grasping limbs
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + Math.sin(w * 0.7 + i) * 0.2;
      const len = 1.1 + Math.sin(w * 1.3 + i * 1.7) * 0.35;
      const kx = Math.cos(a);
      const ky = Math.sin(a) * 0.45;
      line(ctx, [[0, -0.5], [kx * len * 0.55, -0.5 + ky * len * 0.6 - 0.35], [kx * len, -0.1 + ky * len]], 0.11 - (i % 3) * 0.02, ink);
    }
    smoothPath2(ctx, 0, -0.55, 0.95, 0.5, rng);
    ctx.fill();
    // teeth-lined maw
    ctx.fillStyle = '#e8e0ff';
    for (let i = 0; i < 5; i++) polyPath(ctx, [[-0.35 + i * 0.15, -0.45], [-0.28 + i * 0.15, -0.3], [-0.21 + i * 0.15, -0.45]]), ctx.fill();
    circle(ctx, 0.25, -0.8, 0.1, '#f4f0ff', 0);
    circle(ctx, 0.5, -0.72, 0.07, '#f4f0ff', 0);
    circle(ctx, -0.2, -0.82, 0.05, '#f4f0ff', 0);
  } else {
    // dread beak: a tall wavering column with a long, cruel beak
    for (const x of [-0.25, 0.25]) line(ctx, [[x, -1.4], [x + Math.sin(w + x) * 0.25, -0.7], [x * 1.6, 0]], 0.12, ink);
    smoothPath2(ctx, 0, -2.1, 0.6, 0.95, rng);
    ctx.fill();
    polyPath(ctx, [[0.25, -2.55], [1.7, -2.35 + Math.sin(w) * 0.12], [0.25, -2.15]]);
    ctx.fill();
    circle(ctx, 0.12, -2.45, 0.11, '#f4f0ff', 0);
  }
  ctx.restore();
}

function smoothPath2(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, rng: Rng): void {
  ctx.beginPath();
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + rng.range(-0.15, 0.15);
    const x = cx + Math.cos(a) * rx * k;
    const y = cy + Math.sin(a) * ry * k;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function drawActor(ctx: Ctx, e: Entity, p: ActorPose, insane: boolean, now: number): void {
  switch (e.prefab) {
    case 'player':
      return drawPlayer(ctx, e, p);
    case 'rabbit':
      return rabbit(ctx, e, p);
    case 'crow':
      return crow(ctx, e, p);
    case 'hog':
      return hog(ctx, e, p);
    case 'shagbeast':
      return shagbeast(ctx, e, p, !!e.shaveable && now < e.shaveable.woolAt);
    case 'spider':
      return spider(ctx, e, p, false);
    case 'spider_warrior':
      return spider(ctx, e, p, true);
    case 'frog':
      return frog(ctx, e, p);
    case 'hound':
      return hound(ctx, e, p);
    case 'crawling_dread':
      return shadowCreature(ctx, e, p, false, insane);
    case 'dread_beak':
      return shadowCreature(ctx, e, p, true, insane);
  }
}
