import { ITEMS, PREFABS, RECIPES, hasTag } from '../content/defs';
import { COOK_RECIPES } from '../content/cookpot';
import { T } from '../content/tuning';
import type { Game } from '../sim/game';
import type { Entity } from '../sim/types';
import { iconURL } from '../render/icons';
import { drawActor } from '../render/sprites/actors';

/**
 * The Journal ("discover, then reveal"): entries unlock when you examine, carry, eat or
 * fight something, and it remembers across runs, because knowledge is the real progression.
 */
const KEY = 'we.journal';

type Cat = 'creatures' | 'food' | 'things';

const CREATURES = ['rabbit', 'crow', 'hog', 'shagbeast', 'spider', 'spider_warrior', 'frog', 'hound', 'crawling_dread', 'dread_beak', 'frostmaw'];

function load(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

const portraitCache = new Map<string, string>();
function portrait(id: string): string {
  let u = portraitCache.get(id);
  if (u) return u;
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const ctx = c.getContext('2d')!;
  const size = PREFABS.get(id)?.size ?? 2;
  const k = 80 / Math.max(2.4, size * 1.25);
  ctx.translate(48, 88);
  ctx.scale(k, k);
  const fake = { id: 7, prefab: id, x: 0, y: 0, facing: 1, state: { name: 'idle', t0: 0 } } as Entity;
  drawActor(ctx, fake, { state: 'idle', t: 0, time: 0.4, moving: false, speed: 0 }, true, 0);
  u = c.toDataURL();
  portraitCache.set(id, u);
  return u;
}

function days(sec: number): string {
  const d = sec / T.DAY;
  return d >= 1 ? `${+d.toFixed(1)} days` : `${Math.round(sec)} s`;
}

export class Journal {
  private root: HTMLDivElement;
  private known = load();
  private cat: Cat = 'creatures';
  private sel: string | null = null;
  shown = false;
  private unsub: (() => void)[] = [];

  constructor(g: Game) {
    this.root = document.createElement('div');
    this.root.className = 'overlay';
    this.root.id = 'journal';
    document.body.appendChild(this.root);
    this.root.addEventListener('mousedown', (e) => {
      if (e.target === this.root) this.toggle(false);
      e.stopPropagation();
    });
    this.setGame(g);
  }

  setGame(g: Game): void {
    for (const u of this.unsub) u();
    const learn = (id: string) => this.learn(id);
    this.unsub = [
      g.events.on('discover', ({ id }) => learn(id)),
      g.events.on('ate', ({ item }) => learn(item)),
      g.events.on('hit', ({ id, by }) => {
        const a = g.world.get(id);
        const b = g.world.get(by ?? 0);
        if (a && !a.player) learn(a.prefab);
        if (b && !b.player) learn(b.prefab);
      }),
      g.events.on('inv', () => {
        const inv = g.player.inventory!;
        for (const s of [...inv.slots, ...(inv.pack ?? []), inv.equip.hand, inv.equip.body, inv.equip.head, inv.cursor]) if (s) learn(s.id);
      }),
      g.events.on('crafted', ({ recipe }) => {
        const r = RECIPES.get(recipe);
        if (r?.item) learn(r.item);
      }),
    ];
  }

  learn(id: string): void {
    if (this.known.has(id)) return;
    if (!ITEMS.has(id) && !CREATURES.includes(id)) return;
    this.known.add(id);
    try {
      localStorage.setItem(KEY, JSON.stringify([...this.known]));
    } catch {
      /* storage unavailable: journal lives for this session only */
    }
    if (this.shown) this.render();
  }

  toggle(v = !this.shown): void {
    this.shown = v;
    this.root.classList.toggle('show', v);
    if (v) this.render();
  }

  private entries(cat: Cat): string[] {
    if (cat === 'creatures') return CREATURES;
    const all = [...ITEMS.values()];
    if (cat === 'food') return all.filter((d) => d.food && d.id !== 'petals').map((d) => d.id);
    return all.filter((d) => !d.food || d.id === 'petals').map((d) => d.id);
  }

  private render(): void {
    const list = this.entries(this.cat);
    const found = list.filter((id) => this.known.has(id)).length;
    const tabs = (['creatures', 'food', 'things'] as Cat[])
      .map((c) => `<button class="btn jt${c === this.cat ? ' on' : ''}" data-c="${c}">${c[0].toUpperCase() + c.slice(1)}</button>`)
      .join('');
    const grid = list
      .map((id) => {
        const k = this.known.has(id);
        const img = k ? (this.cat === 'creatures' ? portrait(id) : iconURL(id)) : '';
        return `<div class="recipe je${k ? ' ok' : ' locked'}${this.sel === id ? ' sel' : ''}" data-id="${id}">${k ? `<img src="${img}">` : ''}</div>`;
      })
      .join('');
    this.root.innerHTML = `
      <div class="menu panel" style="max-width:min(94vw,760px);width:760px;text-align:left">
        <h2 style="text-align:center">Journal</h2>
        <p style="text-align:center;margin:0 0 10px">${found} of ${list.length} discovered · remembered across lives</p>
        <div style="display:flex;gap:8px;justify-content:center;margin-bottom:10px">${tabs}</div>
        <div style="display:flex;gap:16px;align-items:flex-start">
          <div class="recipes" style="grid-template-columns:repeat(7,52px);max-height:52vh;overflow-y:auto;padding:2px">${grid}</div>
          <div id="jdetail" style="flex:1;min-width:0">${this.detail()}</div>
        </div>
        <p style="text-align:center;margin-top:12px;font-size:14px">Examine things (right-click) to record them. J or Esc to close.</p>
      </div>`;
    this.root.querySelectorAll<HTMLElement>('.jt').forEach((b) => (b.onclick = () => ((this.cat = b.dataset.c as Cat), (this.sel = null), this.render())));
    this.root.querySelectorAll<HTMLElement>('.je').forEach((b) => (b.onclick = () => ((this.sel = b.dataset.id!), this.render())));
  }

  private detail(): string {
    const id = this.sel;
    if (!id) return '<p>Select an entry.</p>';
    if (!this.known.has(id)) return '<h3 style="margin:0">???</h3><p>You haven’t encountered this yet.</p>';
    const row = (k: string, v: string | number) => `<div style="display:flex;justify-content:space-between;border-bottom:1px solid #3a3027;padding:3px 0"><span style="color:#b3a58a">${k}</span><span>${v}</span></div>`;
    if (CREATURES.includes(id)) {
      const d = PREFABS.get(id)!;
      const c = d.components!;
      const loot = (d.loot ?? []).map((l) => `${ITEMS.get(l.item)?.name}${l.n && l.n > 1 ? ` ×${l.n}` : ''}${l.chance ? ` (${Math.round(l.chance * 100)}%)` : ''}`).join(', ');
      return `<img src="${portrait(id)}" style="float:right;width:96px;height:96px"><h3 style="margin:0;color:#d9b45a">${d.name}</h3><p style="font-style:italic">${d.examine ?? ''}</p>
        ${row('Health', c.health?.max ?? '—')}${c.combat ? row('Damage', c.combat.damage) + row('Attack every', `${c.combat.period} s`) : ''}
        ${c.locomotor ? row('Speed', `${c.locomotor.walk} / ${c.locomotor.run}`) : ''}${d.sanityAura ? row('Sanity aura', `${d.sanityAura}/min`) : ''}
        ${row('Temperament', hasTag(d, 'hostile') ? 'Hostile' : c.combat ? 'Neutral' : 'Skittish')}${loot ? row('Drops', loot) : ''}`;
    }
    const d = ITEMS.get(id)!;
    let rows = '';
    if (d.food) rows += row('Health', d.food.health) + row('Hunger', d.food.hunger) + row('Sanity', d.food.sanity);
    if (d.perish) rows += row('Spoils in', days(d.perish));
    if (d.cooked) rows += row('Cooks into', ITEMS.get(d.cooked)!.name);
    if (d.dried) rows += row('Dries into', ITEMS.get(d.dried)!.name);
    if (d.cook) rows += row('Cook Pot', Object.entries(d.cook).map(([k, v]) => `${k} ${v}`).join(', '));
    if (d.fuel) rows += row('Fuel', `${d.fuel} s`);
    if (d.weapon) rows += row('Damage', d.weapon.damage);
    if (d.uses) rows += row('Uses', d.uses);
    if (d.time) rows += row('Lasts', days(d.time));
    if (d.armor) rows += row('Absorbs', `${Math.round(d.armor.absorb * 100)}% (${d.armor.hp} hp)`);
    if (d.equip?.insulation) rows += row('Warmth', d.equip.insulation);
    if (d.equip?.summer) rows += row('Cooling', d.equip.summer);
    if (d.equip?.waterproof) rows += row('Waterproof', `${Math.round(d.equip.waterproof * 100)}%`);
    if (d.equip?.sanity) rows += row('Sanity', `+${d.equip.sanity}/min`);
    if (d.heal) rows += row('Heals', d.heal);
    const dish = COOK_RECIPES.some((r) => r.id === id);
    return `<img src="${iconURL(id)}" style="float:right;width:72px;height:72px"><h3 style="margin:0;color:#d9b45a">${d.name}</h3><p style="font-style:italic">${d.desc ?? (dish ? 'A Cook Pot dish.' : '')}</p>${rows}`;
  }
}
