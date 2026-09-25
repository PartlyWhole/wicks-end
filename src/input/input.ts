import { ITEMS, PREFABS, RECIPES } from '../content/defs';
import type { Game } from '../sim/game';
import { resolveAction, verbFor } from '../sim/actions';
import { placementPrefab } from '../sim/player';
import type { Renderer } from '../render/renderer';
import type { Tooltip } from '../ui/tooltip';
import { stackLabel } from '../ui/inventory';

export interface InputHooks {
  toggleMap(): void;
  toggleJournal(): void;
  escape(): void;
  isBlocked(): boolean;
}

export class Input {
  private keys = new Set<string>();
  private lastMove = '0,0';
  private mouse = { x: 0, y: 0, left: false, onCanvas: false };
  private repeatT = 0;
  private walkT = 0;

  constructor(
    private g: Game,
    private r: Renderer,
    private tip: Tooltip,
    private hooks: InputHooks,
  ) {
    const c = r.canvas;
    window.addEventListener('keydown', (e) => this.key(e, true));
    window.addEventListener('keyup', (e) => this.key(e, false));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.left = false;
      this.sendMove();
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('mousedown', (e) => this.down(e));
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
    });
    c.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.mouse.onCanvas = true;
    });
    c.addEventListener('mouseleave', () => {
      this.mouse.onCanvas = false;
      this.tip.setWorld('');
    });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.r.zoom(e.deltaY);
    }, { passive: false });
  }

  setGame(g: Game, r: Renderer): void {
    this.g = g;
    this.r = r;
    this.keys.clear();
    this.lastMove = '0,0';
  }

  private key(e: KeyboardEvent, down: boolean): void {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (down && (k === 'escape')) {
      this.hooks.escape();
      return;
    }
    if (this.hooks.isBlocked()) return;
    if (k === 'tab') e.preventDefault();
    if (down && (k === 'm' || k === 'tab') && !e.repeat) this.hooks.toggleMap();
    if (down && k === 'j' && !e.repeat) this.hooks.toggleJournal();
    if (down) this.keys.add(k);
    else this.keys.delete(k);
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      e.preventDefault();
      this.sendMove();
    }
    if (down && !e.repeat) {
      if (k === ' ') this.g.queue({ t: 'autoAct' });
      if (k === 'f') this.g.queue({ t: 'autoAttack' });
      if (/^[0-9]$/.test(k)) this.g.queue({ t: 'useSlot', i: (+k + 9) % 10 });
    }
    if (k === ' ') e.preventDefault();
  }

  private sendMove(): void {
    const k = this.keys;
    const dx = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    const dy = (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0);
    const key = `${dx},${dy}`;
    if (key === this.lastMove) return;
    this.lastMove = key;
    this.g.queue({ t: 'move', dx, dy });
  }

  private down(e: MouseEvent): void {
    if (this.hooks.isBlocked()) return;
    const [wx, wy] = this.r.toWorld(e.clientX, e.clientY);
    const target = this.r.pick(e.clientX, e.clientY);
    const alt = e.button === 2;
    if (e.button === 0) this.mouse.left = true;
    this.walkT = 0.25;
    this.g.queue({ t: 'click', alt, target: target?.id, x: wx, y: wy, force: e.ctrlKey || e.metaKey });
  }

  /** Per-frame: held keys repeat, hover tooltip, held-mouse walking. */
  update(dt: number): void {
    const g = this.g;
    const p = g.player;
    this.repeatT -= dt;
    if (this.repeatT <= 0 && !this.hooks.isBlocked()) {
      this.repeatT = 0.2;
      if (this.keys.has(' ') && !p.player!.pending) g.queue({ t: 'autoAct' });
      if (this.keys.has('f') && !p.player!.pending) g.queue({ t: 'autoAttack' });
    }
    // hold left mouse on empty ground to keep walking toward the cursor
    this.walkT -= dt;
    if (this.mouse.left && this.walkT <= 0 && this.mouse.onCanvas) {
      this.walkT = 0.2;
      const pend = p.player!.pending;
      if (!pend || pend.action === 'walk') {
        const [wx, wy] = this.r.toWorld(this.mouse.x, this.mouse.y);
        if (!this.r.pick(this.mouse.x, this.mouse.y) && !p.inventory!.cursor && !placementPrefab(p)) g.queue({ t: 'click', alt: false, x: wx, y: wy });
      }
    }
    if (!this.mouse.onCanvas) {
      this.r.hoverId = null;
      this.r.mouseWorld = null;
      return;
    }
    this.r.mouseWorld = this.r.toWorld(this.mouse.x, this.mouse.y);
    const pre = placementPrefab(p);
    if (pre) {
      this.r.hoverId = null;
      const name = p.player!.placing ? PREFABS.get(RECIPES.get(p.player!.placing)!.place!)!.name : ITEMS.get(p.inventory!.cursor!.id)!.name;
      this.tip.setWorld(`Place ${name}<div class="alt">Right-click: Cancel</div>`);
      return;
    }
    const e = this.r.pick(this.mouse.x, this.mouse.y);
    this.r.hoverId = e?.id ?? null;
    if (!e) {
      const cur = p.inventory!.cursor;
      this.tip.setWorld(cur ? `Drop ${stackLabel(cur)}<div class="alt">Right-click: Put back</div>` : '');
      return;
    }
    const a = resolveAction(g, p, e, false);
    const alt = resolveAction(g, p, e, true);
    const name = e.item ? `${stackLabel(e.item)}${e.item.n > 1 ? ` ×${e.item.n}` : ''}` : PREFABS.get(e.prefab)!.name;
    const main = a ? (e.item ? `${typeof a.verb === 'string' ? a.verb : verbFor(a, g, p)} ${name}` : verbFor(a, g, p, e)) : name;
    this.tip.setWorld(`${main}${alt ? `<div class="alt">Right-click: ${alt.verb}</div>` : ''}`);
  }
}
