import { PREFABS } from '../content/defs';
import { T } from '../content/tuning';
import type { Game } from '../sim/game';
import { TILE_INFO } from '../sim/tiles';

/** Parchment-style world map showing only explored tiles. */
export class MapUI {
  private root: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  shown = false;

  constructor(private g: Game) {
    this.root = document.createElement('div');
    this.root.id = 'map';
    this.root.className = 'panel';
    this.canvas = document.createElement('canvas');
    this.root.appendChild(this.canvas);
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = 'M / Tab to close';
    this.root.appendChild(hint);
    document.body.appendChild(this.root);
    this.root.addEventListener('mousedown', () => this.toggle(false));
  }

  setGame(g: Game): void {
    this.g = g;
  }

  toggle(v = !this.shown): void {
    this.shown = v;
    this.root.classList.toggle('show', v);
    if (v) this.draw();
  }

  draw(): void {
    const g = this.g;
    const c = this.canvas;
    const r = c.getBoundingClientRect();
    c.width = r.width * devicePixelRatio;
    c.height = r.height * devicePixelRatio;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#d8cbad';
    ctx.fillRect(0, 0, c.width, c.height);
    const N = g.size;
    const k = Math.min(c.width, c.height) / N;
    const ox = (c.width - N * k) / 2;
    const oy = (c.height - N * k) / 2;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        if (!g.explored[i]) continue;
        ctx.fillStyle = TILE_INFO[g.tiles[i]].color;
        ctx.fillRect(ox + x * k, oy + y * k, k + 0.6, k + 0.6);
      }
    // parchment vignette
    const grad = ctx.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.3, c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.7);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(60,40,20,0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, c.width, c.height);
    // icons for notable things in explored area
    const u = k / T.TILE;
    for (const e of g.world.entities.values()) {
      const col = PREFABS.get(e.prefab)?.mapColor;
      if (!col) continue;
      const tx = Math.floor(e.x / T.TILE);
      const ty = Math.floor(e.y / T.TILE);
      if (!g.explored[ty * N + tx]) continue;
      ctx.fillStyle = col;
      ctx.strokeStyle = '#1a1410';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const s = e.prefab === 'pine_tree' ? Math.max(1.2, u * 1.2) : Math.max(2.2, u * 2);
      ctx.arc(ox + e.x * u, oy + e.y * u, s, 0, Math.PI * 2);
      ctx.fill();
      if (e.prefab !== 'pine_tree') ctx.stroke();
    }
    // player
    const p = g.player;
    const px = ox + p.x * u;
    const py = oy + p.y * u;
    ctx.fillStyle = '#c0563a';
    ctx.strokeStyle = '#1a1410';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}
