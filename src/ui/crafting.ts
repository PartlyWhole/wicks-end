import { ITEMS, RECIPES, type Recipe, type Tab } from '../content/defs';
import { TABS, TECH_NAMES } from '../content/recipes';
import type { Game } from '../sim/game';
import { countItem } from '../sim/inventory';
import { craftStatus, techAt, type CraftStatus } from '../sim/player';
import { iconURL } from '../render/icons';
import type { Tooltip } from './tooltip';

const recipeIcon = (r: Recipe) => r.item ?? r.place!;
const recipeName = (r: Recipe) => (r.item ? ITEMS.get(r.item)!.name : prefabName(r.place!));
let prefabName: (id: string) => string = (id) => id;

export class CraftingUI {
  private tabs: HTMLDivElement;
  private list: HTMLDivElement;
  private tabEls = new Map<Tab, HTMLDivElement>();
  private open: Tab | null = null;
  private selected: string | null = null;
  private lastKey = '';

  constructor(
    root: HTMLElement,
    private g: Game,
    private tip: Tooltip,
    nameOf: (id: string) => string,
  ) {
    prefabName = nameOf;
    this.tabs = document.createElement('div');
    this.tabs.id = 'craft-tabs';
    this.tabs.className = 'panel';
    root.appendChild(this.tabs);
    this.list = document.createElement('div');
    this.list.id = 'craft-list';
    this.list.className = 'panel';
    root.appendChild(this.list);
    for (const t of TABS) {
      const d = document.createElement('div');
      d.className = 'tab';
      d.innerHTML = `<img src="${iconURL(t.icon)}"><span class="dot"></span>`;
      d.onmouseenter = () => this.tip.setUI(t.name);
      d.onmouseleave = () => this.tip.setUI(null);
      d.onmousedown = (e) => {
        e.stopPropagation();
        this.toggle(t.id);
      };
      this.tabs.appendChild(d);
      this.tabEls.set(t.id, d);
    }
    for (const el of [this.tabs, this.list]) {
      el.addEventListener('mousedown', (e) => e.stopPropagation());
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  setGame(g: Game): void {
    this.g = g;
    this.lastKey = '';
  }

  toggle(t: Tab | null): void {
    this.open = this.open === t ? null : t;
    this.selected = null;
    this.lastKey = '';
    this.update();
  }

  close(): boolean {
    if (!this.open) return false;
    this.toggle(null);
    return true;
  }

  private status(id: string): CraftStatus {
    return craftStatus(this.g, this.g.player, id);
  }

  update(): void {
    const g = this.g;
    const p = g.player;
    // cheap change key: inventory counts + tech + known
    const tech = techAt(g, p.x, p.y);
    const inv = p.inventory!;
    const invKey = [...inv.slots, ...(inv.pack ?? [])].map((s) => (s ? `${s.id}${s.n}` : '-')).join('');
    const key = `${this.open}|${this.selected}|${tech}|${p.player!.known.length}|${invKey}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    // tab badges: prototypes available
    for (const t of TABS) {
      const any = [...RECIPES.values()].some((r) => r.tab === t.id && this.status(r.id) === 'prototype');
      const el = this.tabEls.get(t.id)!;
      el.classList.toggle('has-proto', any);
      el.classList.toggle('active', this.open === t.id);
    }
    if (!this.open) {
      this.list.style.display = 'none';
      return;
    }
    const tab = TABS.find((t) => t.id === this.open)!;
    this.list.style.display = 'block';
    this.list.innerHTML = `<h3>${tab.name}</h3>`;
    const grid = document.createElement('div');
    grid.className = 'recipes';
    this.list.appendChild(grid);
    const recipes = [...RECIPES.values()].filter((r) => r.tab === this.open);
    for (const r of recipes) {
      const st = this.status(r.id);
      const d = document.createElement('div');
      d.className = `recipe ${st}${this.selected === r.id ? ' sel' : ''}`;
      d.innerHTML = `<img src="${iconURL(recipeIcon(r))}">`;
      d.onmouseenter = () => this.tip.setUI(st === 'locked' ? `Needs ${TECH_NAMES[r.tech]}` : recipeName(r));
      d.onmouseleave = () => this.tip.setUI(null);
      d.onmousedown = (e) => {
        e.stopPropagation();
        if (this.selected === r.id && (st === 'ok' || st === 'prototype')) {
          g.queue({ t: 'craft', recipe: r.id });
          if (r.place) this.toggle(null);
        } else {
          this.selected = r.id;
          this.lastKey = '';
          this.update();
        }
      };
      grid.appendChild(d);
    }
    const sel = this.selected ? RECIPES.get(this.selected) : recipes.find((r) => this.status(r.id) !== 'locked');
    if (sel) this.detail(sel);
  }

  private detail(r: Recipe): void {
    const st = this.status(r.id);
    const inv = this.g.player.inventory!;
    const d = document.createElement('div');
    d.id = 'craft-detail';
    if (st === 'locked') {
      d.innerHTML = `<div class="name">???</div><div class="desc">You haven’t figured this out yet.</div><div class="need">Needs ${TECH_NAMES[r.tech]} nearby to learn.</div>`;
      this.list.appendChild(d);
      return;
    }
    const ings = r.ingredients
      .map(([id, n]) => {
        const have = countItem(inv, id);
        return `<div class="ing${have < n ? ' short' : ''}" title="${ITEMS.get(id)!.name}"><img src="${iconURL(id)}">${have}/${n}</div>`;
      })
      .join('');
    d.innerHTML = `<div class="name">${recipeName(r)}${r.n && r.n > 1 ? ` ×${r.n}` : ''}</div><div class="desc">${r.desc}</div><div class="ings">${ings}</div>`;
    const b = document.createElement('button');
    b.className = 'btn';
    b.style.width = '100%';
    b.textContent = st === 'prototype' ? 'Prototype' : r.place ? 'Build' : 'Craft';
    b.disabled = st !== 'ok' && st !== 'prototype';
    b.onmousedown = (e) => {
      e.stopPropagation();
      this.g.queue({ t: 'craft', recipe: r.id });
      if (r.place) this.toggle(null);
    };
    d.appendChild(b);
    this.list.appendChild(d);
  }
}
