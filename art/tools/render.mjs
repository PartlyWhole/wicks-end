#!/usr/bin/env node
/**
 * SVG art review harness: renders an (optionally animated) SVG into a single contact sheet
 * that a reviewer (human or agent) can judge at a glance, plus a preview GIF.
 *
 *   node art/tools/render.mjs art/assets/campfire.svg [--frames 8] [--duration 1.2] [--out art/renders]
 *
 * Contact sheet rows:
 *   1. Frames: the animation sampled evenly over one loop (t = 0 … duration)
 *   2. Motion: onion-skin overlay of all frames (arcs & spacing) + a greyscale silhouette test
 *   3. In context: sprite at real game scale on day ground and at night inside firelight
 *   4. Hero: one large still for detail and line quality
 *
 * Each SVG copy lives in its own srcdoc iframe, so SMIL and CSS timelines are independent and can be
 * paused at an exact time (svg.setCurrentTime + Animation.currentTime).
 * Prints a JSON report: file paths, byte size, element counts, warnings and console errors.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { basename, resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('usage: render.mjs <file.svg> [--frames N] [--duration S] [--out DIR] [--no-gif]');
  process.exit(2);
}
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const svgText = readFileSync(file, 'utf8');
const name = basename(file, '.svg');
const outDir = resolve(opt('out', 'art/renders'));
mkdirSync(outDir, { recursive: true });

// duration: --duration > data-duration on root > longest dur="…" / animation-duration found > 1s
const durAttr = /data-duration="([\d.]+)s?"/.exec(svgText)?.[1];
const durs = [...svgText.matchAll(/dur="([\d.]+)(ms|s)?"/g)].map((m) => (m[2] === 'ms' ? +m[1] / 1000 : +m[1]));
const cssDurs = [...svgText.matchAll(/animation(?:-duration)?:[^;"]*?([\d.]+)(ms|s)\b/g)].map((m) => (m[2] === 'ms' ? +m[1] / 1000 : +m[1]));
const duration = +(opt('duration', durAttr ?? Math.max(0, ...durs, ...cssDurs) ?? 1)) || 1;
const animated = durs.length + cssDurs.length > 0 || !!durAttr;
const N = animated ? +opt('frames', 8) : 1;

// ---------------------------------------------------------------- static lint
const warnings = [];
if (!/viewBox=/.test(svgText)) warnings.push('root <svg> has no viewBox (will not scale cleanly)');
if (/<image|href="http|url\(http/.test(svgText)) warnings.push('external/raster references found: keep art pure vector & self-contained');
if (/<script/i.test(svgText)) warnings.push('contains <script>: not allowed in art assets');
if (svgText.length > 40_000) warnings.push(`large file (${(svgText.length / 1024).toFixed(1)} KB): simplify paths`);
const elements = (svgText.match(/<[a-zA-Z][\w:-]*/g) ?? []).length;
const twoLayer = /id="silhouette"/.test(svgText) && /id="colour"/.test(svgText);
if (!twoLayer) warnings.push('missing <g id="silhouette"> and/or <g id="colour"> (Magic-Lantern two-layer sprite)');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const UNLIT = '#colour{display:none}';
const frame = (t, w, h, extra = '', css = '') =>
  `<iframe data-t="${t}" style="width:${w}px;height:${h}px;border:0;background:transparent;${extra}" srcdoc="${esc(
    `<!doctype html><html><head><style>${css}</style></head><body style="margin:0;background:transparent;overflow:hidden"><div style="width:${w}px;height:${h}px">${svgText.replace(
      /<svg\b/,
      '<svg style="width:100%;height:100%;display:block"',
    )}</div></body></html>`,
  )}"></iframe>`;

const ts = Array.from({ length: N }, (_, i) => +((i / N) * duration).toFixed(3));
const cell = (label, inner, bg = '#e9dfc7') =>
  `<div class="cell"><div class="lab">${label}</div><div class="box" style="background:${bg}">${inner}</div></div>`;
const sheet = `<!doctype html><html><head><style>
  body{margin:0;padding:16px;background:#2a231d;font:13px Georgia,serif;color:#e9dfc7;width:max-content}
  h1{font-size:16px;margin:0 0 10px;font-weight:normal;color:#d9b45a}
  .row{display:flex;gap:10px;margin-bottom:12px;align-items:flex-start}
  .lab{margin-bottom:4px;color:#b3a58a}.box{position:relative;border-radius:6px;overflow:hidden}
  .stack{position:relative}.stack iframe{position:absolute;left:0;top:0}
</style></head><body>
<h1>${name}.svg — ${animated ? `${N} frames over ${duration}s` : 'static'} · ${(svgText.length / 1024).toFixed(1)} KB · ${elements} elements</h1>
<div class="row">${ts.map((t) => cell(`t=${t}s`, frame(t, 150, 150))).join('')}</div>
<div class="row">
  ${cell('onion skin (all frames, lit)', `<div class="stack" style="width:220px;height:220px">${ts.map((t) => frame(t, 220, 220, `opacity:${Math.max(0.18, 1 / N + 0.1)}`)).join('')}</div>`)}
  ${cell('UNLIT · night outside the lamp', frame(ts[0], 220, 220, '', UNLIT), '#2a2340')}
  ${cell('solid silhouette', `<div style="filter:brightness(0)">${frame(ts[0], 220, 220)}</div>`, '#d8d0bc')}
  ${cell('game scale · day (lit)', `<div style="width:220px;height:220px;display:flex;align-items:flex-end;justify-content:center;gap:6px;padding-bottom:70px;box-sizing:border-box;background:radial-gradient(#b8ae84,#7a7d55)">${frame(ts[0], 64, 64)}${frame(ts[Math.floor(N / 2)], 48, 48)}</div>`, '#7a7d55')}
  ${cell('game scale · night: lit | unlit', `<div style="width:220px;height:220px;display:flex;align-items:center;justify-content:center;gap:14px;background:radial-gradient(circle at 30% 55%, #f2a94a 0%, #b4574a 22%, #2a2340 45%, #0b0907 80%)">${frame(ts[0], 64, 64)}${frame(ts[0], 64, 64, '', UNLIT)}</div>`, '#0b0907')}
</div>
<div class="row">${cell('hero · lit (detail & cut quality)', frame(ts[Math.min(1, N - 1)], 460, 460))}${cell('hero · unlit', frame(ts[Math.min(1, N - 1)], 300, 300, '', UNLIT), '#2a2340')}</div>
</body></html>`;

// ---------------------------------------------------------------- render
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars'] });
const errors = [];
try {
  const page = await browser.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewport({ width: 1600, height: 1200, deviceScaleFactor: 1 });
  await page.setContent(sheet, { waitUntil: 'load' });
  // pause every copy at its own time
  await page.evaluate(async () => {
    const frames = [...document.querySelectorAll('iframe')];
    await Promise.all(frames.map((f) => (f.contentDocument?.readyState === 'complete' ? 0 : new Promise((r) => f.addEventListener('load', r)))));
    for (const f of frames) {
      const t = +f.dataset.t;
      const doc = f.contentDocument;
      const svg = doc?.querySelector('svg');
      if (!svg) continue;
      try {
        svg.pauseAnimations();
        svg.setCurrentTime(t);
      } catch {}
      for (const a of doc.getAnimations()) {
        a.pause();
        a.currentTime = t * 1000;
      }
    }
  });
  await new Promise((r) => setTimeout(r, 150));
  const sheetPath = join(outDir, `${name}.sheet.png`);
  const body = await page.$('body');
  await body.screenshot({ path: sheetPath });

  // preview GIF for humans (24 fps over one loop)
  let gifPath = null;
  if (animated && !argv.includes('--no-gif')) {
    const tmp = join(outDir, `.${name}-frames`);
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp, { recursive: true });
    const fps = 24;
    const count = Math.max(2, Math.round(duration * fps));
    await page.setContent(`<body style="margin:0;background:#e9dfc7">${frame(0, 256, 256)}</body>`, { waitUntil: 'load' });
    const el = await page.$('iframe');
    for (let i = 0; i < count; i++) {
      const t = (i / count) * duration;
      await page.evaluate((t) => {
        const doc = document.querySelector('iframe').contentDocument;
        const svg = doc.querySelector('svg');
        try {
          svg.pauseAnimations();
          svg.setCurrentTime(t);
        } catch {}
        for (const a of doc.getAnimations()) {
          a.pause();
          a.currentTime = t * 1000;
        }
      }, t);
      await el.screenshot({ path: join(tmp, `f${String(i).padStart(3, '0')}.png`) });
    }
    gifPath = join(outDir, `${name}.gif`);
    try {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(tmp, 'f%03d.png'), '-vf', 'split[a][b];[a]palettegen[p];[b][p]paletteuse', gifPath]);
    } catch (e) {
      warnings.push(`gif failed: ${e.message.split('\n')[0]}`);
      gifPath = null;
    }
    rmSync(tmp, { recursive: true, force: true });
  }
  const report = { file, twoLayer, sheet: sheetPath, gif: gifPath, animated, duration, frames: N, bytes: svgText.length, elements, warnings, errors };
  writeFileSync(join(outDir, `${name}.report.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
