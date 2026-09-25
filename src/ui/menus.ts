import { TIPS, DEATH_CAUSES } from '../content/strings';
import { PREFABS } from '../content/defs';

export interface MenuHandlers {
  newGame(seed: string, seasonScale: number): void;
  continueGame(): void;
  resume(): void;
  quitToTitle(): void;
  setVolume(v: number): void;
  hasSave(): boolean;
}

function overlay(id: string): HTMLDivElement {
  const o = document.createElement('div');
  o.className = 'overlay';
  o.id = id;
  document.body.appendChild(o);
  o.addEventListener('mousedown', (e) => e.stopPropagation());
  o.addEventListener('contextmenu', (e) => e.preventDefault());
  return o;
}

const KEYS = `
<div class="keys">
  <kbd>WASD</kbd><span>Walk</span>
  <kbd>Left click</kbd><span>Walk / gather / attack / use held item</span>
  <kbd>Right click</kbd><span>Examine, light, or use inventory item</span>
  <kbd>Space</kbd><span>Gather the nearest thing (hold)</span>
  <kbd>F</kbd><span>Attack the nearest enemy (Ctrl+click forces attack)</span>
  <kbd>1–0</kbd><span>Use inventory slot</span>
  <kbd>Shift+click</kbd><span>Split a stack</span>
  <kbd>M / Tab</kbd><span>Map</span>
  <kbd>J</kbd><span>Journal (things you\u2019ve discovered)</span>
  <kbd>Wheel</kbd><span>Zoom</span>
  <kbd>Esc</kbd><span>Pause / close</span>
</div>`;

export class Menus {
  private title = overlay('title');
  private pause = overlay('pause');
  private death = overlay('death');
  private bg = document.createElement('div');
  paused = false;

  constructor(private h: MenuHandlers) {
    this.bg.id = 'title-bg';
    this.title.prepend(this.bg);
  }

  showTitle(): void {
    const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
    this.title.innerHTML = '';
    this.title.appendChild(this.bg);
    const m = document.createElement('div');
    m.className = 'menu';
    m.style.position = 'relative';
    m.innerHTML = `
      <h1 class="flicker">Wick’s End</h1>
      <p>The lamps went out, and the Hollow woke up.</p>
      ${matchMedia('(pointer: coarse)').matches ? '<p style="color:#e0806a;font-size:15px">Best played with a mouse and keyboard.</p>' : ''}
      ${this.h.hasSave() ? '<button class="btn" data-a="continue">Continue</button>' : ''}
      <button class="btn" data-a="new">New World</button>
      <details style="margin-top:12px;text-align:left;color:#b3a58a">
        <summary style="cursor:pointer">World options</summary>
        <label>Seed <input id="seed" placeholder="random" style="width:150px"></label>
        <label>Seasons <select id="seasons"><option value="1">Default (20/15/20/15 days)</option><option value="0.5">Short (half length)</option><option value="0.25">Very short</option><option value="1.5">Long</option></select></label>
      </details>
      <details style="margin-top:6px;text-align:left;color:#b3a58a"><summary style="cursor:pointer">How to play</summary>${KEYS}</details>
      <p style="margin-top:18px;font-size:14px"><em>${tip}</em></p>`;
    this.title.appendChild(m);
    m.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => {
        const a = b.dataset.a;
        if (a === 'continue') this.h.continueGame();
        if (a === 'new') {
          const seed = (m.querySelector('#seed') as HTMLInputElement).value.trim() || Math.random().toString(36).slice(2, 8);
          const scale = +(m.querySelector('#seasons') as HTMLSelectElement).value;
          this.h.newGame(seed, scale);
        }
        this.hideAll();
      }),
    );
    this.title.classList.add('show');
  }

  togglePause(on = !this.paused, seed = ''): void {
    this.paused = on;
    if (!on) {
      this.pause.classList.remove('show');
      return;
    }
    this.pause.innerHTML = `
      <div class="menu panel">
        <h2>Paused</h2>
        <p>World seed: <b>${seed}</b></p>
        <button class="btn" data-a="resume">Resume</button>
        <label>Volume <input type="range" id="vol" min="0" max="1" step="0.05" value="${localStorage.getItem('we.vol') ?? '0.7'}"></label>
        ${KEYS}
        <button class="btn" data-a="quit">Save &amp; quit to title</button>
      </div>`;
    this.pause.querySelector('[data-a=resume]')!.addEventListener('click', () => this.h.resume());
    this.pause.querySelector('[data-a=quit]')!.addEventListener('click', () => this.h.quitToTitle());
    this.pause.querySelector('#vol')!.addEventListener('input', (e) => this.h.setVolume(+(e.target as HTMLInputElement).value));
    this.pause.classList.add('show');
  }

  showDeath(days: number, cause: string, stats: { crafted: number; killed: number }): void {
    const causeName = DEATH_CAUSES[cause] ?? PREFABS.get(cause)?.name ?? cause;
    this.death.innerHTML = `
      <div class="menu panel">
        <h2>You have perished</h2>
        <p>Silas survived <b style="color:#f1e8d6">${days} day${days === 1 ? '' : 's'}</b> in the Hollow.</p>
        <p>Undone by: <b style="color:#e0806a">${causeName}</b></p>
        <p style="font-size:15px">Things crafted: ${stats.crafted} &nbsp;·&nbsp; Creatures slain: ${stats.killed}</p>
        <button class="btn" data-a="again">Try again</button>
        <button class="btn" data-a="title">Title screen</button>
      </div>`;
    this.death.querySelector('[data-a=again]')!.addEventListener('click', () => {
      this.hideAll();
      this.h.newGame(Math.random().toString(36).slice(2, 8), 1);
    });
    this.death.querySelector('[data-a=title]')!.addEventListener('click', () => this.h.quitToTitle());
    this.death.classList.add('show');
  }

  anyOpen(): boolean {
    return [this.title, this.pause, this.death].some((o) => o.classList.contains('show'));
  }

  hideAll(): void {
    for (const o of [this.title, this.pause, this.death]) o.classList.remove('show');
    this.paused = false;
  }
}
