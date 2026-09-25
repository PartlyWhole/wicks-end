import './ui/style.css';
import { T } from './content/tuning';
import { PREFABS } from './content/defs';
import type { Game } from './sim/game';
import { newGame, serialize, deserialize } from './sim/create';
import { Renderer } from './render/renderer';
import { Hud } from './ui/hud';
import { InventoryUI } from './ui/inventory';
import { CraftingUI } from './ui/crafting';
import { Tooltip } from './ui/tooltip';
import { MapUI } from './ui/map';
import { Menus } from './ui/menus';
import { Input } from './input/input';
import { Audio } from './audio/audio';
import { TIPS } from './content/strings';
import { Journal } from './ui/journal';

const SAVE_KEY = 'we.save.v1';
const STEP = 1 / T.SIM_HZ;

const canvas = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui')!;
const vignette = document.getElementById('vignette')!;
const toastEl = document.getElementById('toast')!;
const sleepFade = document.getElementById('sleep-fade')!;

class App {
  g: Game | null = null;
  r: Renderer | null = null;
  hud = new Hud(uiRoot);
  tip = new Tooltip();
  inv!: InventoryUI;
  craft!: CraftingUI;
  map!: MapUI;
  journal!: Journal;
  input!: Input;
  audio = new Audio();
  menus: Menus;
  private acc = 0;
  private last = performance.now();
  private deathShown = false;
  private helpEl: HTMLDivElement | null = null;
  private toastTimer = 0;

  constructor() {
    this.menus = new Menus({
      newGame: (seed, scale) => this.start(newGame(seed, { seasonLengths: scaled(scale) })),
      continueGame: () => this.continueGame(),
      resume: () => this.menus.togglePause(false),
      quitToTitle: () => {
        this.save();
        this.menus.hideAll();
        this.g = null;
        this.menus.showTitle();
      },
      setVolume: (v) => this.audio.setVolume(v),
      hasSave: () => !!localStorage.getItem(SAVE_KEY),
    });
    window.addEventListener('resize', () => this.r?.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.g && !this.g.over) {
        this.save();
        if (!this.menus.anyOpen()) this.menus.togglePause(true, this.g.seed);
      }
    });
    window.addEventListener('beforeunload', () => this.save());
    this.menus.showTitle();
    requestAnimationFrame(this.frame);
  }

  private continueGame(): void {
    const json = localStorage.getItem(SAVE_KEY);
    if (!json) return;
    try {
      this.start(deserialize(json), true);
    } catch (err) {
      console.error(err);
      localStorage.removeItem(SAVE_KEY);
      this.menus.showTitle();
    }
  }

  start(g: Game, loaded = false): void {
    this.g = g;
    this.deathShown = false;
    this.acc = 0;
    this.r = new Renderer(canvas, g);
    if (!this.inv) {
      this.inv = new InventoryUI(uiRoot, g, this.tip);
      this.craft = new CraftingUI(uiRoot, g, this.tip, (id) => PREFABS.get(id)?.name ?? id);
      this.map = new MapUI(g);
      this.journal = new Journal(g);
      this.input = new Input(g, this.r, this.tip, {
        toggleMap: () => this.map.toggle(),
        toggleJournal: () => this.journal.toggle(),
        escape: () => this.escape(),
        isBlocked: () => this.menus.anyOpen() || !this.g,
      });
    } else {
      this.inv.setGame(g);
      this.craft.setGame(g);
      this.map.setGame(g);
      this.journal.setGame(g);
      this.input.setGame(g);
      (this.input as any).r = this.r;
    }
    this.audio.attach(g);
    g.events.on('newDay', ({ day }) => {
      g.player.player!.stats.daysSurvived = day;
      this.toast(`Day ${day + 1}`);
      if (day > 0) g.say(g.player, 'dawn');
      this.save();
    });
    g.events.on('season', ({ season }) => {
      this.toast(`${season[0].toUpperCase() + season.slice(1)} has come`);
      if (season === 'winter' || season === 'summer' || season === 'spring') g.say(g.player, season);
    });
    g.events.on('phase', ({ phase }) => phase === 'dusk' && g.say(g.player, 'dusk'));
    g.events.on('playerDied', () => {
      localStorage.removeItem(SAVE_KEY);
      setTimeout(() => this.onDeath(), 2500);
    });
    g.events.on('crafted', () => this.helpEl?.classList.add('hide'));
    if (!loaded) {
      this.toast('Day 1');
      setTimeout(() => g.say(g.player, 'firstDay'), 1200);
      this.showHelp();
    }
    uiRoot.style.display = '';
  }

  private showHelp(): void {
    this.helpEl?.remove();
    const h = document.createElement('div');
    h.id = 'help-card';
    h.className = 'panel';
    h.innerHTML = `<b style="color:#d9b45a">Survive.</b> Nobody is coming.<br>
      <span style="color:#b3a58a">WASD</span> walk · <span style="color:#b3a58a">click</span> gather &amp; act · <span style="color:#b3a58a">right-click</span> examine/use ·
      <span style="color:#b3a58a">Space</span> gather nearby · <span style="color:#b3a58a">F</span> fight · craft from the left.<br>
      <em style="color:#b3a58a">${TIPS[0]}</em>`;
    uiRoot.appendChild(h);
    this.helpEl = h;
    setTimeout(() => h.classList.add('hide'), 60000);
  }

  private toast(text: string): void {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  private escape(): void {
    const g = this.g;
    if (!g) return;
    if (this.menus.anyOpen()) {
      if (this.menus.paused) this.menus.togglePause(false);
      return;
    }
    if (this.map.shown) return this.map.toggle(false);
    if (this.journal.shown) return this.journal.toggle(false);
    if (this.craft.close()) return;
    if (g.openContainer !== null) return g.queue({ t: 'closeContainer' });
    if (g.player.player!.placing) return g.queue({ t: 'cancelPlace' });
    if (g.player.inventory!.cursor) return g.queue({ t: 'returnCursor' });
    this.save();
    this.menus.togglePause(true, g.seed);
  }

  private onDeath(): void {
    if (!this.g || this.deathShown) return;
    this.deathShown = true;
    const st = this.g.player.player!.stats;
    this.menus.showDeath(this.g.clock.day, st.cause ?? 'unknown', st);
  }

  save(): void {
    const g = this.g;
    if (!g || g.over || g.player.state?.name === 'dead') return;
    try {
      localStorage.setItem(SAVE_KEY, serialize(g));
    } catch (err) {
      console.warn('save failed', err);
    }
  }

  private frame = (now: number): void => {
    requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const g = this.g;
    const r = this.r;
    if (!g || !r) return;
    const running = !this.menus.anyOpen() && !this.map.shown && !this.journal.shown;
    const asleep = g.player.state?.name === 'sleep';
    if (running) {
      this.acc += dt * (asleep ? 12 : 1);
      let steps = 0;
      const max = asleep ? 30 : 5;
      while (this.acc >= STEP && steps < max) {
        r.snapshot();
        g.tick(STEP);
        this.acc -= STEP;
        steps++;
      }
      if (steps >= max) this.acc = 0;
      this.input.update(dt);
    }
    r.render(running ? this.acc / STEP : 1, running ? dt : 0);
    this.hud.update(g);
    this.inv.update();
    this.craft.update();
    this.audio.update(g, dt);
    this.postFx(g, r);
    sleepFade.style.opacity = asleep ? '0.55' : '0';
  };

  private postFx(g: Game, r: Renderer): void {
    const p = g.player;
    const s = p.sanity!.cur / p.sanity!.max;
    const k = Math.max(0, (0.75 - s) / 0.75);
    canvas.style.filter = k > 0.01 ? `saturate(${1 - k * 0.65}) contrast(${1 + k * 0.18}) hue-rotate(${Math.sin(g.time * 0.5) * k * 12}deg)` : '';
    const layers: string[] = [];
    const fx = r.fx;
    if (fx.hush > 0.01) layers.push(`radial-gradient(ellipse at center, rgba(0,0,0,${fx.hush * 0.3}) 20%, rgba(0,0,0,${fx.hush}) 75%)`);
    if (fx.hurt > 0.01) layers.push(`radial-gradient(ellipse at center, transparent 45%, rgba(160,20,10,${fx.hurt * 0.55}) 100%)`);
    const t = p.temperature!.cur;
    if (t < 8) layers.push(`radial-gradient(ellipse at center, transparent 50%, rgba(170,210,255,${Math.min(0.55, (8 - t) / 16)}) 100%)`);
    if (t > 62) layers.push(`radial-gradient(ellipse at center, transparent 50%, rgba(255,140,40,${Math.min(0.45, (t - 62) / 18)}) 100%)`);
    if (k > 0.05) {
      const w = 45 + Math.sin(g.time * 1.7) * 6 * k;
      layers.push(`radial-gradient(ellipse at center, transparent ${w}%, rgba(20,6,24,${k * 0.75}) 100%)`);
    }
    if ((p.health!.cur / p.health!.max) < 0.25) layers.push(`radial-gradient(ellipse at center, transparent 55%, rgba(120,10,10,${0.25 + Math.sin(g.time * 5) * 0.1}) 100%)`);
    vignette.style.background = layers.join(',');
  }
}

function scaled(k: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [s, n] of Object.entries(T.SEASON_LENGTH)) out[s] = Math.max(3, Math.round(n * k));
  return out;
}

const app = new App();
if (import.meta.env.DEV) {
  (window as any).WE = app;
  import('./debug').then((m) => m.installDebug(() => app.g, () => app.r?.cam ?? null));
}
