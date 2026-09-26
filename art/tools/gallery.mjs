#!/usr/bin/env node
/**
 * Builds art/gallery.html (every asset in art/assets, animating live, on day and night grounds)
 * and a screenshot art/renders/gallery.png for review.
 *   node art/tools/gallery.mjs
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const dir = resolve('art/assets');
const files = readdirSync(dir).filter((f) => f.endsWith('.svg')).sort();
const cards = files
  .map((f) => {
    const svg = readFileSync(join(dir, f), 'utf8').replace(/<svg\b/, '<svg style="width:100%;height:100%;display:block"');
    const id = f.replace(/\.svg$/, '');
    // each sprite in its own iframe so SVG ids (clipPaths, gradients) can't collide between assets
    const esc = (x) => x.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const fr = (css) => `<iframe style="width:100%;height:100%;border:0;display:block" srcdoc="${esc(`<!doctype html><html><head><style>html,body{margin:0;height:100%;background:transparent}${css}</style></head><body>${svg}</body></html>`)}"></iframe>`;
    return `<figure><div class="day">${fr('')}</div><div class="night">${fr('#colour{display:none}')}</div><figcaption>${id}</figcaption></figure>`;
  })
  .join('\n');
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Wick's End — Art Gallery</title>
<style>
  :root{--ink:#1a1410;--paper:#e9dfc7}
  body{margin:0;padding:24px;background:#2a231d;color:var(--paper);font:15px Georgia,serif}
  h1{font-weight:normal;color:#d9b45a;margin:0 0 16px}
  main{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}
  figure{margin:0;background:#1c1612;border:1px solid #6b5a44;border-radius:10px;overflow:hidden}
  figure>div{height:200px}
  .day{background:radial-gradient(#9aa556,#77843f)}
  .night{background:#2a2340}
  .night #colour{display:none}
  figcaption{padding:8px 12px;color:#b3a58a}
</style></head><body><h1>Wick's End — SVG art (${files.length}) · top: lit · bottom: unlit (night)</h1><main>${cards}</main></body></html>`;
writeFileSync(resolve('art/gallery.html'), html);
mkdirSync(resolve('art/renders'), { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setContent(html, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: resolve('art/renders/gallery.png'), fullPage: true });
} finally {
  await browser.close();
}
console.log(JSON.stringify({ gallery: resolve('art/gallery.html'), screenshot: resolve('art/renders/gallery.png'), assets: files.length }));
