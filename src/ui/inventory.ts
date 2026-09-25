import { ITEMS, hasTag, prefab } from '../content/defs';
import { T } from '../content/tuning';
import type { Game } from '../sim/game';
import type { SlotRef } from '../sim/commands';
import type { Stack } from '../sim/types';
import { foodValues } from '../sim/player';
import { iconURL } from '../render/icons';
import type { Tooltip } from './tooltip';

const EQUIP_GHOST: Record<string, string> = { hand: 'axe', body: 'logsuit', head: 'strawhat' };

function stackHint(s: Stack, where: SlotRef['where']): string {
  const d = ITEMS.get(s.id)!;
  if (where === 'equip') return 'Right-click: Unequip';
  if (where === 'container') return 'Right-click: Take';
  if (d.equip) return 'Right-click: Equip';
  if (d.food) return 'Right-click: Eat';
  if (d.heal) return 'Right-click: Heal';
  if (hasTag(d, 'bedroll')) return 'Right-click: Sleep';
  if (s.id === 'rabbit') return 'Right-click: Murder';
  if (d.deploy) return 'Click, then click the ground to place';
  return '';
}

export function stackLabel(s: Stack): string {
  const d = ITEMS.get(s.id)!;
  let label = d.name;
  if (s.fresh !== undefined && d.food) {
    const f = s.fresh;
    label += f < T.SPOILED_AT ? ' (spoiled)' : f < T.STALE_AT ? ' (stale)' : '';
  }
  if (s.temp !== undefined) label += ` (${Math.round(s.temp)}°)`;
  return label;
}

function foodLine(s: Stack): string {
  const d = ITEMS.get(s.id)!;
  if (!d.food) return '';
  const v = foodValues(s);
  const f = (n: number) => (n > 0 ? `+${+n.toFixed(1)}` : `${+n.toFixed(1)}`);
  return `<span style="color:#e0806a">♥ ${f(v.health)}</span> &nbsp;<span style="color:#e0a64a">● ${f(v.hunger)}</span> &nbsp;<span style="color:#b7a8d8">✹ ${f(v.sanity)}</span>`;
}

export class InventoryUI {
  private bar: HTMLDivElement;
  private main: HTMLDivElement;
  private equip: HTMLDivElement;
  private pack: HTMLDivElement;
  private packSlots: HTMLDivElement;
  private container: HTMLDivElement;
  private cursor: HTMLDivElement;
  private dirty = true;
  private lastRefresh = 0;
  mouse = { x: 0, y: 0 };

  constructor(
    root: HTMLElement,
    private g: Game,
    private tip: Tooltip,
  ) {
    this.bar = div('panel', root, 'inventory');
    this.main = div('slots', this.bar);
    div('divider', this.bar);
    this.equip = div('slots', this.bar);
    this.pack = div('panel', root, 'pack');
    this.pack.innerHTML = '<div style="font-size:13px;color:#b3a58a;margin:0 0 4px;text-align:center">Backpack</div>';
    this.packSlots = div('slots', this.pack);
    this.container = div('panel', root, 'container');
    this.cursor = div('', document.body, 'cursor-item');
    g.events.on('inv', () => (this.dirty = true));
    g.events.on('openContainer', () => (this.dirty = true));
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.cursor.style.left = `${e.clientX}px`;
      this.cursor.style.top = `${e.clientY}px`;
    });
    for (const el of [this.bar, this.pack, this.container]) el.addEventListener('mouseleave', () => this.tip.setUI(null));
    this.bar.addEventListener('contextmenu', (e) => e.preventDefault());
    this.pack.addEventListener('contextmenu', (e) => e.preventDefault());
    this.container.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setGame(g: Game): void {
    this.g = g;
    g.events.on('inv', () => (this.dirty = true));
    g.events.on('openContainer', () => (this.dirty = true));
    this.dirty = true;
  }

  private slotEl(parent: HTMLElement, s: Stack | null, ref: SlotRef, key?: string, equipSlot?: string): void {
    const d = document.createElement('div');
    d.className = 'slot';
    if (equipSlot) d.classList.add('equip');
    if (s) {
      const def = ITEMS.get(s.id)!;
      const img = document.createElement('img');
      img.src = iconURL(s.id);
      img.draggable = false;
      d.appendChild(img);
      if (s.n > 1) span(d, 'n', String(s.n));
      if (s.dur !== undefined) span(d, 'pct', `${Math.max(0, Math.round(s.dur * 100))}%`);
      if (s.fresh !== undefined && def.food) {
        if (s.fresh < T.SPOILED_AT) d.classList.add('fresh-spoiled');
        else if (s.fresh < T.STALE_AT) d.classList.add('fresh-stale');
        d.style.boxShadow = `inset 0 -${Math.round(4 * s.fresh) + 1}px 0 ${s.fresh < T.SPOILED_AT ? '#a0402a' : s.fresh < T.STALE_AT ? '#b0a03a' : '#6a9a4a'}`;
      }
      d.onmouseenter = () => {
        const hint = stackHint(s, ref.where);
        this.tip.setUI(`${stackLabel(s)}${foodLine(s) ? `<div class="alt">${foodLine(s)}</div>` : ''}${hint ? `<div class="alt">${hint}</div>` : ''}`);
      };
    } else if (equipSlot) {
      const img = document.createElement('img');
      img.src = iconURL(EQUIP_GHOST[equipSlot]);
      img.className = 'ghost';
      d.appendChild(img);
      d.onmouseenter = () => this.tip.setUI(`${equipSlot[0].toUpperCase() + equipSlot.slice(1)} slot`);
    } else d.onmouseenter = () => this.tip.setUI('');
    d.onmouseleave = () => this.tip.setUI(null);
    if (key) span(d, 'key', key);
    d.onmousedown = (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.g.queue({ t: 'slot', ref, alt: e.button === 2, split: e.shiftKey });
    };
    parent.appendChild(d);
  }

  update(): void {
    const time = performance.now() / 1000;
    const g = this.g;
    const p = g.player;
    // auto-close container when walking away
    if (g.openContainer !== null) {
      const c = g.world.get(g.openContainer);
      if (!c || Math.hypot(c.x - p.x, c.y - p.y) > 4.5 || c.cooker?.until) g.queue({ t: 'closeContainer' });
    }
    if (time - this.lastRefresh > 0.5) this.dirty = true;
    this.updateCursor();
    if (!this.dirty) return;
    this.dirty = false;
    this.lastRefresh = time;
    const inv = p.inventory!;
    this.main.textContent = '';
    inv.slots.forEach((s, i) => this.slotEl(this.main, s, { where: 'inv', i }, i < 10 ? String((i + 1) % 10) : undefined));
    this.equip.textContent = '';
    for (const slot of ['hand', 'body', 'head'] as const) this.slotEl(this.equip, inv.equip[slot], { where: 'equip', slot }, undefined, slot);
    // backpack
    if (inv.pack) {
      this.pack.style.display = 'block';
      this.packSlots.textContent = '';
      inv.pack.forEach((s, i) => this.slotEl(this.packSlots, s, { where: 'pack', i }));
    } else this.pack.style.display = 'none';
    // container
    const cid = g.openContainer;
    const ce = cid !== null ? g.world.get(cid) : undefined;
    if (ce?.container) {
      this.container.style.display = 'block';
      this.container.textContent = '';
      const h = document.createElement('h3');
      h.textContent = prefab(ce.prefab).name;
      this.container.appendChild(h);
      const grid = div('slots', this.container);
      const n = ce.container.slots.length;
      grid.style.gridTemplateColumns = `repeat(${n === 4 ? 2 : 3}, 52px)`;
      ce.container.slots.forEach((s, i) => this.slotEl(grid, s, { where: 'container', id: ce.id, i }));
      if (ce.cooker) {
        const b = document.createElement('button');
        b.textContent = 'Cook';
        b.disabled = ce.container.slots.some((s) => !s);
        b.onmousedown = (e) => {
          e.stopPropagation();
          g.queue({ t: 'cook', id: ce.id });
        };
        this.container.appendChild(b);
      }
    } else this.container.style.display = 'none';
  }

  private updateCursor(): void {
    const cur = this.g.player.inventory!.cursor;
    if (!cur) {
      this.cursor.style.display = 'none';
      (this.cursor as any)._id = null;
      return;
    }
    this.cursor.style.display = 'block';
    const key = `${cur.id}:${cur.n}`;
    if ((this.cursor as any)._id !== key) {
      (this.cursor as any)._id = key;
      this.cursor.innerHTML = `<img src="${iconURL(cur.id)}">${cur.n > 1 ? `<span class="n">${cur.n}</span>` : ''}`;
    }
  }
}

function div(cls: string, parent: HTMLElement, id?: string): HTMLDivElement {
  const d = document.createElement('div');
  if (cls) d.className = cls;
  if (id) d.id = id;
  parent.appendChild(d);
  return d;
}
function span(parent: HTMLElement, cls: string, text: string): void {
  const s = document.createElement('span');
  s.className = cls;
  s.textContent = text;
  parent.appendChild(s);
}
