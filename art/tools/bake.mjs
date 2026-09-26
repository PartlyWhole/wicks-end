#!/usr/bin/env node
/**
 * Bakes every art/assets/*.svg into two transparent sprite sheets for the game:
 *   public/sprites/<id>.sil.webp  — the #silhouette layer (always drawn)
 *   public/sprites/<id>.col.webp  — the #colour layer (revealed by light at runtime)
 * plus src/render/sprites/baked.json (frame counts, fps, grid, world scale).
 *
 * Frames are sampled at 12 fps (puppets, "on 2s") or 24 fps for smooth light/shadow assets.
 * Each frame is its own srcdoc iframe paused at an exact time, laid out in a grid and
 * captured in one screenshot with a transparent background.
 *   npm run bake
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SIZE = 256;
const COLS = 8;
/** assets whose motion is smooth by design (light, flame, shadow creatures) */
const SMOOTH = new Set(['campfire', 'shadow-puppet']);

const dir = resolve('art/assets');
const outDir = resolve('public/sprites');
mkdirSync(outDir, { recursive: true });
const manifest = {};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
try {
  const page = await browser.newPage();
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.svg')).sort()) {
    const id = f.replace(/\.svg$/, '');
    const svg = readFileSync(join(dir, f), 'utf8');
    const duration = +(/data-duration="([\d.]+)/.exec(svg)?.[1] ?? 1);
    const worldScale = +(/data-world-scale="([\d.]+)/.exec(svg)?.[1] ?? 1);
    const fps = SMOOTH.has(id) ? 24 : 12;
    const frames = Math.max(1, Math.round(duration * fps));
    const cols = Math.min(COLS, frames);
    const rows = Math.ceil(frames / cols);
    const body = svg.replace(/<svg\b/, `<svg style="width:${SIZE}px;height:${SIZE}px;display:block"`);
    for (const [layer, hide] of [
      ['sil', '#colour'],
      ['col', '#silhouette'],
    ]) {
      const cells = Array.from({ length: frames }, (_, i) => {
        const doc = `<!doctype html><html><head><style>html,body{margin:0;background:transparent}${hide}{display:none}</style></head><body>${body}</body></html>`;
        return `<iframe data-t="${(i / fps).toFixed(4)}" style="width:${SIZE}px;height:${SIZE}px;border:0;display:block;background:transparent" srcdoc="${esc(doc)}"></iframe>`;
      }).join('');
      await page.setViewport({ width: cols * SIZE, height: rows * SIZE });
      await page.setContent(
        `<!doctype html><html><head><style>html,body{margin:0;background:transparent}#g{display:grid;grid-template-columns:repeat(${cols},${SIZE}px);width:${cols * SIZE}px}</style></head><body><div id="g">${cells}</div></body></html>`,
        { waitUntil: 'load' },
      );
      await page.evaluate(async () => {
        const fr = [...document.querySelectorAll('iframe')];
        await Promise.all(fr.map((x) => (x.contentDocument?.readyState === 'complete' ? 0 : new Promise((r) => x.addEventListener('load', r)))));
        for (const x of fr) {
          const t = +x.dataset.t;
          const doc = x.contentDocument;
          const s = doc.querySelector('svg');
          try {
            s.pauseAnimations();
            s.setCurrentTime(t);
          } catch {}
          for (const a of doc.getAnimations()) {
            a.pause();
            a.currentTime = t * 1000;
          }
        }
      });
      await new Promise((r) => setTimeout(r, 120));
      const el = await page.$('#g');
      await el.screenshot({ path: join(outDir, `${id}.${layer}.webp`), type: 'webp', quality: 92, omitBackground: true });
    }
    manifest[id] = { frames, fps, cols, size: SIZE, worldScale, duration };
    console.log(`${id}: ${frames} frames @ ${fps} fps, scale ${worldScale}`);
  }
} finally {
  await browser.close();
}
writeFileSync(resolve('src/render/sprites/baked.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('wrote src/render/sprites/baked.json');
