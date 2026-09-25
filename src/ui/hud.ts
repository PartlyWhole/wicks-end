import { T } from '../content/tuning';
import type { Game } from '../sim/game';
import { isFullMoon, moonPhase } from '../sim/light';

const SVGNS = 'http://www.w3.org/2000/svg';

const ICONS = {
  health: 'M50 84 C18 62 8 46 16 30 C24 14 44 16 50 32 C56 16 76 14 84 30 C92 46 82 62 50 84Z',
  hunger: 'M34 20 C50 12 74 18 76 40 C78 56 62 60 64 72 C66 84 50 90 36 84 C20 76 18 60 26 50 C32 42 20 30 34 20Z',
  sanity: 'M50 22 C38 14 22 22 23 36 C12 40 14 58 25 61 C25 74 40 80 50 73 C60 80 75 74 75 61 C86 58 88 40 77 36 C78 22 62 14 50 22Z',
};
const COLORS = { health: '#c8423a', hunger: '#d88a2a', sanity: '#9c8ab8' };

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e;
}

class Badge {
  root: HTMLDivElement;
  private rect: SVGRectElement;
  private val: HTMLDivElement;
  private arrow: HTMLDivElement;
  private last = -1;
  private hist: number[] = [];

  constructor(
    parent: HTMLElement,
    readonly kind: keyof typeof ICONS,
    title: string,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'badge';
    this.root.title = title;
    const svg = el('svg', { viewBox: '0 0 100 100' }, this.root);
    const defs = el('defs', {}, svg);
    const clip = el('clipPath', { id: `clip-${kind}` }, defs);
    this.rect = el('rect', { x: 0, y: 0, width: 100, height: 100 }, clip);
    el('circle', { cx: 50, cy: 50, r: 46, fill: '#231c16', stroke: '#6b5a44', 'stroke-width': 4 }, svg);
    el('path', { d: ICONS[kind], fill: '#3a302a', stroke: '#1a1410', 'stroke-width': 3 }, svg);
    el('path', { d: ICONS[kind], fill: COLORS[kind], 'clip-path': `url(#clip-${kind})` }, svg);
    el('path', { d: ICONS[kind], fill: 'none', stroke: '#1a1410', 'stroke-width': 4, 'stroke-linejoin': 'round' }, svg);
    if (kind === 'sanity') el('path', { d: 'M50 24 L50 70 M36 34 C42 40 40 48 34 52 M64 34 C58 40 60 48 66 52', stroke: '#1a1410', 'stroke-width': 3, fill: 'none' }, svg);
    this.val = document.createElement('div');
    this.val.className = 'val';
    this.arrow = document.createElement('div');
    this.arrow.className = 'arrow';
    this.root.append(this.val, this.arrow);
    parent.appendChild(this.root);
  }

  set(cur: number, max: number): void {
    const f = Math.max(0, Math.min(1, cur / max));
    const top = 12 + (1 - f) * 76;
    this.rect.setAttribute('y', String(top));
    const v = Math.ceil(cur);
    if (v !== this.last) {
      this.val.textContent = String(v);
      this.last = v;
    }
    this.root.classList.toggle('low', f < 0.25);
    this.root.classList.toggle('pulse', f < 0.15);
    // trend arrow from recent history
    this.hist.push(cur);
    if (this.hist.length > 90) this.hist.shift();
    const d = cur - this.hist[0];
    const rate = d / Math.max(1, this.hist.length / 30);
    const big = Math.abs(rate) > (this.kind === 'hunger' ? 0.3 : 0.12);
    this.arrow.textContent = big ? (rate > 0 ? '▲' : '▼') : '';
    this.arrow.style.color = rate > 0 ? '#9fe07a' : '#f0705a';
  }
}

export class Hud {
  private clockSvg: SVGSVGElement;
  private wedges: SVGPathElement[] = [];
  private hand: SVGLineElement;
  private dayText: SVGTextElement;
  private moon: SVGCircleElement;
  private season: HTMLDivElement;
  private temp: HTMLDivElement;
  private badges: Record<string, Badge> = {};
  private lastSegs = '';

  constructor(root: HTMLElement) {
    const tr = document.createElement('div');
    tr.id = 'hud-tr';
    root.appendChild(tr);
    this.clockSvg = el('svg', { id: 'clock', viewBox: '0 0 100 100' });
    tr.appendChild(this.clockSvg);
    el('circle', { cx: 50, cy: 50, r: 48, fill: '#1c1612', stroke: '#6b5a44', 'stroke-width': 3 }, this.clockSvg);
    for (let i = 0; i < 16; i++) this.wedges.push(el('path', { d: wedge(i), stroke: '#1a1410', 'stroke-width': 1.2 }, this.clockSvg));
    el('circle', { cx: 50, cy: 50, r: 25, fill: '#2a221c', stroke: '#1a1410', 'stroke-width': 2 }, this.clockSvg);
    this.moon = el('circle', { cx: 50, cy: 38, r: 5, fill: '#e8e0c8', opacity: 0 }, this.clockSvg);
    this.dayText = el('text', { x: 50, y: 56, 'text-anchor': 'middle', 'font-size': 13, fill: '#f1e8d6', 'font-family': 'IM Fell English, Georgia, serif' }, this.clockSvg);
    this.hand = el('line', { x1: 50, y1: 50, x2: 50, y2: 6, stroke: '#f1e8d6', 'stroke-width': 3, 'stroke-linecap': 'round' }, this.clockSvg);
    this.season = document.createElement('div');
    this.season.id = 'season';
    tr.appendChild(this.season);
    const b = document.createElement('div');
    b.id = 'badges';
    tr.appendChild(b);
    this.badges.hunger = new Badge(b, 'hunger', 'Hunger');
    this.badges.sanity = new Badge(b, 'sanity', 'Sanity');
    this.badges.health = new Badge(b, 'health', 'Health');
    this.temp = document.createElement('div');
    this.temp.id = 'temp';
    tr.appendChild(this.temp);
  }

  update(g: Game): void {
    const c = g.clock;
    const p = g.player;
    const segKey = c.segs.join(',');
    if (segKey !== this.lastSegs) {
      this.lastSegs = segKey;
      const [d, du] = c.segs;
      this.wedges.forEach((w, i) => w.setAttribute('fill', i < d ? '#c9a24a' : i < d + du ? '#9a4a36' : '#2c3a5a'));
    }
    const a = c.frac * 360;
    this.hand.setAttribute('transform', `rotate(${a} 50 50)`);
    this.dayText.textContent = `Day ${c.day + 1}`;
    this.moon.setAttribute('opacity', c.phase === 'night' ? (isFullMoon(c.day) ? '1' : String(0.25 + Math.abs(0.5 - moonPhase(c.day)) * 0)) : '0');
    const sName = c.season[0].toUpperCase() + c.season.slice(1);
    this.season.innerHTML = `${sName}<br><small>${c.seasonDaysLeft} day${c.seasonDaysLeft === 1 ? '' : 's'} left</small>`;
    this.badges.health.set(p.health!.cur, p.health!.max);
    this.badges.hunger.set(p.hunger!.cur, p.hunger!.max);
    this.badges.sanity.set(p.sanity!.cur, p.sanity!.max);
    const t = p.temperature!.cur;
    const show = t < 15 || t > 55 || (p.wetness?.cur ?? 0) > 15;
    this.temp.classList.toggle('show', show);
    if (show) {
      const col = t < T.WARN_COLD ? '#8fc0ff' : t > T.WARN_HOT ? '#ff8a5a' : '#e8dcc0';
      const wet = (p.wetness?.cur ?? 0) > 15 ? ` &nbsp;\u{1F4A7} ${Math.round(p.wetness!.cur)}%` : '';
      this.temp.innerHTML = `<span style="color:${col}">\u{1F321} ${Math.round(t)}°</span>${wet}`;
    }
  }
}

function wedge(i: number): string {
  const a0 = (i / 16) * Math.PI * 2 - Math.PI / 2;
  const a1 = ((i + 1) / 16) * Math.PI * 2 - Math.PI / 2;
  const R = 44;
  const r = 25;
  const p = (a: number, rr: number) => `${50 + Math.cos(a) * rr} ${50 + Math.sin(a) * rr}`;
  return `M ${p(a0, r)} L ${p(a0, R)} A ${R} ${R} 0 0 1 ${p(a1, R)} L ${p(a1, r)} A ${r} ${r} 0 0 0 ${p(a0, r)} Z`;
}
