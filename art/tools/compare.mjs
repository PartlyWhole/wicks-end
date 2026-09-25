#!/usr/bin/env node
/** Side-by-side comparison of SVG studies: large view + game-scale (64px) + solid silhouette of the central figure area.
 *   node art/tools/compare.mjs art/studies/*.svg --out art/renders/studies/compare.png */
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
const argv = process.argv.slice(2);
const oi = argv.indexOf('--out');
const out = resolve(oi >= 0 ? argv[oi + 1] : 'art/renders/compare.png');
const files = argv.filter((a, i) => a.endsWith('.svg') && i !== oi + 1);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const fr = (svg, w, t, style = '') => `<iframe data-t="${t}" style="width:${w}px;height:${w}px;border:0;${style}" srcdoc="${esc(`<body style="margin:0">${svg.replace(/<svg\b/, `<svg style="width:${w}px;height:${w}px;display:block"`)}</body>`)}"></iframe>`;
const cols = files.map((f) => {
  const svg = readFileSync(f, 'utf8');
  const title = (/<!-- (.*?) -->/.exec(svg)?.[1] ?? basename(f)).replace(/:.*/, '');
  return `<div class="c"><h2>${title}</h2>${fr(svg, 300, 0.4)}<div class="row">${fr(svg, 96, 1.1)}${fr(svg, 64, 1.7)}${fr(svg, 96, 1.1, 'filter:grayscale(1)')}</div></div>`;
}).join('');
const html = `<body style="margin:0;padding:18px;background:#2a231d;font:14px Georgia,serif;color:#e9dfc7;width:max-content"><style>.c{display:inline-block;vertical-align:top;margin-right:14px;width:300px}h2{font-size:15px;font-weight:normal;color:#d9b45a;margin:0 0 6px;height:36px}.row{display:flex;gap:6px;align-items:flex-end;margin-top:6px}</style>${cols}<div style="color:#b3a58a;margin-top:10px">each: hero · 96px · 64px · greyscale</div></body>`;
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage();
await p.setViewport({ width: 1700, height: 700 });
await p.setContent(html, { waitUntil: 'load' });
await p.evaluate(() => { for (const f of document.querySelectorAll('iframe')) { const s = f.contentDocument.querySelector('svg'); try { s.pauseAnimations(); s.setCurrentTime(+f.dataset.t); } catch {} } });
await new Promise((r) => setTimeout(r, 200));
await (await p.$('body')).screenshot({ path: out });
await b.close();
console.log(out);
