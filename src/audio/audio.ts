import type { Game } from '../sim/game';

/**
 * Procedural audio: every sound is synthesized with WebAudio (no assets).
 * Positional sfx attenuate with distance to the player and pan left/right.
 */
export class Audio {
  private ac: AudioContext | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private rain!: GainNode;
  private wind!: GainNode;
  private drone!: GainNode;
  private droneOsc: OscillatorNode[] = [];
  private nextAmbient = 0;
  private nextCrackle = 0;
  volume = 0.7;
  private g: Game | null = null;
  private unsub: (() => void)[] = [];

  constructor() {
    const v = localStorage.getItem('we.vol');
    if (v !== null) this.volume = +v;
    const start = () => {
      this.init();
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
    window.addEventListener('pointerdown', start);
    window.addEventListener('keydown', start);
  }

  private init(): void {
    if (this.ac) return;
    const ac = new AudioContext();
    this.ac = ac;
    this.master = ac.createGain();
    this.master.gain.value = this.volume * 0.6;
    this.master.connect(ac.destination);
    const len = ac.sampleRate * 2;
    this.noise = ac.createBuffer(1, len, ac.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.rain = this.loopNoise(1800, 0.6);
    this.wind = this.loopNoise(400, 0.4);
    // insanity drone
    this.drone = ac.createGain();
    this.drone.gain.value = 0;
    this.drone.connect(this.master);
    for (const f of [55, 58.3, 82.4]) {
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 300;
      o.connect(lp).connect(this.drone);
      o.start();
      this.droneOsc.push(o);
    }
  }

  setVolume(v: number): void {
    this.volume = v;
    localStorage.setItem('we.vol', String(v));
    if (this.ac) this.master.gain.value = v * 0.6;
  }

  attach(g: Game): void {
    for (const u of this.unsub) u();
    this.g = g;
    this.unsub = [
      g.events.on('sfx', ({ name, x, y, id }) => this.sfx(name, x, y, id)),
      g.events.on('phase', ({ phase }) => phase === 'dusk' && this.sting('dusk')),
      g.events.on('newDay', () => this.sting('dawn')),
      g.events.on('crafted', ({ prototyped }) => prototyped && this.sting('proto')),
    ];
  }

  private loopNoise(freq: number, q: number): GainNode {
    const ac = this.ac!;
    const src = ac.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const gn = ac.createGain();
    gn.gain.value = 0;
    src.connect(f).connect(gn).connect(this.master);
    src.start();
    return gn;
  }

  private out(x?: number, y?: number, vol = 1): AudioNode | null {
    const ac = this.ac;
    if (!ac || !this.g) return null;
    const p = this.g.player;
    let gain = vol;
    let pan = 0;
    if (x !== undefined && y !== undefined && (x || y)) {
      const dx = x - p.x;
      const dy = y - p.y;
      const d = Math.hypot(dx, dy);
      gain *= Math.max(0, 1 - d / 40);
      pan = Math.max(-1, Math.min(1, dx / 20));
    }
    if (gain <= 0.01) return null;
    const gn = ac.createGain();
    gn.gain.value = gain;
    const pn = ac.createStereoPanner();
    pn.pan.value = pan;
    gn.connect(pn).connect(this.master);
    return gn;
  }

  private tone(dest: AudioNode, type: OscillatorType, f0: number, f1: number, t: number, vol: number, delay = 0): void {
    const ac = this.ac!;
    const now = ac.currentTime + delay;
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, now);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), now + t);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t);
    o.connect(g).connect(dest);
    o.start(now);
    o.stop(now + t + 0.05);
  }

  private burst(dest: AudioNode, freq: number, q: number, t: number, vol: number, delay = 0, type: BiquadFilterType = 'bandpass'): void {
    const ac = this.ac!;
    const now = ac.currentTime + delay;
    const src = ac.createBufferSource();
    src.buffer = this.noise;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t);
    src.connect(f).connect(g).connect(dest);
    src.start(now, Math.random() * 1.5);
    src.stop(now + t + 0.05);
  }

  sfx(name: string, x?: number, y?: number, param?: number): void {
    if (!this.ac) return;
    if (name.startsWith('attack_') || name.startsWith('death_')) {
      const who = name.split('_').slice(1).join('_');
      const d = this.out(x, y, 0.7);
      if (!d) return;
      if (who === 'hound') this.tone(d, 'sawtooth', 180, 90, 0.25, 0.25);
      else if (who.startsWith('spider')) this.tone(d, 'square', 900, 500, 0.12, 0.08);
      else if (who === 'hog') this.tone(d, 'sawtooth', 220, 140, 0.18, 0.15);
      else if (who === 'shagbeast') this.tone(d, 'sawtooth', 90, 60, 0.5, 0.3);
      else if (who === 'frog') this.tone(d, 'square', 160, 120, 0.12, 0.12);
      else if (who === 'player') this.tone(d, 'sine', 220, 55, 1.2, 0.4);
      else this.burst(d, 600, 1, 0.15, 0.2);
      return;
    }
    const d = this.out(x, y, 1);
    if (!d) return;
    switch (name) {
      case 'chop':
        this.burst(d, 900, 2, 0.12, 0.5);
        this.tone(d, 'triangle', 160, 80, 0.12, 0.35);
        break;
      case 'mine':
        this.burst(d, 3000, 3, 0.08, 0.4);
        this.tone(d, 'square', 1200, 600, 0.06, 0.1);
        break;
      case 'dig':
        this.burst(d, 500, 1, 0.18, 0.4);
        break;
      case 'hammer':
        this.tone(d, 'triangle', 200, 90, 0.15, 0.4);
        this.burst(d, 1200, 2, 0.08, 0.3);
        break;
      case 'treefall':
        this.burst(d, 300, 0.7, 0.9, 0.5, 0.3, 'lowpass');
        break;
      case 'collapse':
        this.burst(d, 400, 0.6, 0.6, 0.5, 0, 'lowpass');
        break;
      case 'pickup':
      case 'pick':
        this.tone(d, 'sine', 500, 900, 0.09, 0.18);
        if (name === 'pick') this.burst(d, 2500, 1, 0.1, 0.15);
        break;
      case 'drop':
        this.tone(d, 'sine', 400, 200, 0.08, 0.12);
        break;
      case 'craft':
      case 'build':
        this.tone(d, 'triangle', 520, 520, 0.18, 0.2);
        this.tone(d, 'triangle', 780, 780, 0.25, 0.18, 0.08);
        break;
      case 'prototype':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(d, 'sine', f, f, 0.35, 0.18, i * 0.08));
        break;
      case 'equip':
        this.burst(d, 1500, 1.5, 0.08, 0.2);
        break;
      case 'swing':
      case 'miss':
        this.burst(d, 1400, 0.8, 0.14, 0.25);
        break;
      case 'hit':
        this.tone(d, 'triangle', 180, 60, 0.12, 0.45);
        this.burst(d, 800, 1, 0.08, 0.3);
        break;
      case 'hurt':
        this.tone(d, 'sawtooth', 160, 70, 0.22, 0.3);
        this.burst(d, 600, 1, 0.12, 0.35);
        break;
      case 'eat':
        for (let i = 0; i < 3; i++) this.burst(d, 2200, 2, 0.06, 0.25, i * 0.12);
        break;
      case 'heal':
        this.tone(d, 'sine', 600, 900, 0.3, 0.15);
        break;
      case 'cook':
      case 'cookpot':
        this.burst(d, 3500, 0.5, 0.6, 0.12);
        break;
      case 'cooked':
        this.tone(d, 'sine', 880, 880, 0.2, 0.15);
        this.tone(d, 'sine', 1320, 1320, 0.3, 0.12, 0.12);
        break;
      case 'fuel':
      case 'ignite':
        this.burst(d, 500, 0.5, 0.5, 0.35, 0, 'lowpass');
        break;
      case 'fireout':
        this.burst(d, 2000, 0.4, 0.5, 0.1);
        break;
      case 'smolder':
        this.burst(d, 2800, 1, 0.3, 0.08);
        break;
      case 'stomp':
        this.tone(d, 'triangle', 120, 60, 0.12, 0.3);
        break;
      case 'shave':
        this.burst(d, 5000, 2, 0.3, 0.15);
        break;
      case 'trap':
        this.tone(d, 'square', 300, 200, 0.1, 0.1);
        break;
      case 'open':
        this.tone(d, 'triangle', 300, 380, 0.12, 0.15);
        break;
      case 'flap':
        for (let i = 0; i < 3; i++) this.burst(d, 700, 1, 0.07, 0.15, i * 0.07);
        break;
      case 'sleep':
        this.tone(d, 'sine', 440, 330, 0.8, 0.12);
        break;
      case 'growl': {
        const loud = Math.min(1, 0.25 + (param ?? 50) / 110);
        const o = this.out(undefined, undefined, loud)!;
        this.tone(o, 'sawtooth', 70, 55, 1.4, 0.35);
        this.tone(o, 'sawtooth', 73, 50, 1.4, 0.25);
        this.burst(o, 250, 2, 1.2, 0.2);
        break;
      }
      case 'hush_warn': {
        const o = this.out(undefined, undefined, 0.8)!;
        this.burst(o, 4000, 6, 1.5, 0.12);
        this.tone(o, 'sine', 90, 45, 2, 0.2);
        break;
      }
      case 'hush': {
        const o = this.out(undefined, undefined, 1)!;
        this.burst(o, 1200, 0.5, 0.5, 0.6);
        this.tone(o, 'sawtooth', 400, 60, 0.6, 0.35);
        break;
      }
      case 'thunder': {
        const o = this.out(undefined, undefined, 1)!;
        this.burst(o, 120, 0.5, 2.5, 0.8, 0.2, 'lowpass');
        this.burst(o, 2000, 0.3, 0.3, 0.3);
        break;
      }
      case 'insane':
        this.tone(d, 'sawtooth', 110, 55, 2, 0.2);
        break;
      case 'sane':
        this.tone(d, 'sine', 440, 660, 0.8, 0.12);
        break;
      case 'roar': {
        const loud = Math.min(1, 0.35 + (param ?? 50) / 120);
        const o = this.out(undefined, undefined, loud)!;
        this.tone(o, 'sawtooth', 110, 38, 2.2, 0.45);
        this.tone(o, 'square', 82, 30, 2.0, 0.2);
        this.burst(o, 300, 0.8, 1.8, 0.35, 0, 'lowpass');
        break;
      }
      case 'slam':
        this.burst(d, 90, 0.7, 1.0, 0.9, 0, 'lowpass');
        this.tone(d, 'sine', 60, 30, 0.6, 0.6);
        break;
      case 'rain_start':
        break;
    }
  }

  private sting(kind: 'dusk' | 'dawn' | 'proto'): void {
    if (!this.ac) return;
    const o = this.out(undefined, undefined, 0.5);
    if (!o) return;
    if (kind === 'dusk') [392, 349, 311, 262].forEach((f, i) => this.tone(o, 'triangle', f, f, 0.9, 0.12, i * 0.35));
    if (kind === 'dawn') [262, 330, 392, 523].forEach((f, i) => this.tone(o, 'sine', f, f, 0.8, 0.1, i * 0.25));
  }

  /** Continuous ambience; called every frame. */
  update(g: Game, dt: number): void {
    if (!this.ac) return;
    const t = this.ac.currentTime;
    const c = g.clock;
    const p = g.player;
    const smooth = (node: GainNode, v: number) => node.gain.setTargetAtTime(v, t, 0.5);
    smooth(this.rain, g.weather.precip * 0.35);
    smooth(this.wind, (c.season === 'winter' ? 0.12 : 0.04) + g.weather.precip * 0.05);
    const sanity = p.sanity ? p.sanity.cur / p.sanity.max : 1;
    smooth(this.drone, Math.max(0, 0.5 - sanity) * 0.35);
    // ambient life
    this.nextAmbient -= dt;
    if (this.nextAmbient <= 0) {
      this.nextAmbient = 0.6 + Math.random() * 2.5;
      const o = this.out(undefined, undefined, 0.35);
      if (o && g.weather.precip < 0.3) {
        if (c.phase === 'day' && c.season !== 'winter') {
          const f = 1800 + Math.random() * 1400;
          this.tone(o, 'sine', f, f * 1.3, 0.08, 0.06);
          this.tone(o, 'sine', f * 1.1, f * 0.9, 0.08, 0.05, 0.1);
        } else if (c.phase !== 'day' && c.season !== 'winter') {
          for (let i = 0; i < 3; i++) this.tone(o, 'sine', 4200, 4300, 0.03, 0.03, i * 0.06);
        }
      }
    }
    // fire crackle near lit fires
    this.nextCrackle -= dt;
    if (this.nextCrackle <= 0) {
      this.nextCrackle = 0.05 + Math.random() * 0.25;
      let near: { x: number; y: number } | null = null;
      g.world.spatial.forEachInRadius(p.x, p.y, 12, (e) => {
        if ((e.fueled && e.fueled.fuel > 0) || e.burnable?.burning) near = e;
      });
      if (near) {
        const n = near as { x: number; y: number };
        const o = this.out(n.x, n.y, 0.5);
        if (o) this.burst(o, 2500 + Math.random() * 2500, 4, 0.03, 0.2);
      }
    }
  }
}
