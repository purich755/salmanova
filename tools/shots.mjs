// Скриншоты секций для самопроверки.
//   node tools/shots.mjs [--w 1440] [--page home|about|info|404] [--reduced] [--only hero,cat]
import { chromium } from 'playwright-core';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i === -1 ? d : process.argv[i + 1]; };
const W = parseInt(arg('w', '1440'), 10);
const H = parseInt(arg('h', W < 700 ? '844' : '900'), 10);
const PAGE = arg('page', 'home');
const reduced = process.argv.includes('--reduced');
const only = arg('only', '');
const BASE = 'http://localhost:8517';
const out = 'raw/shots'; fs.mkdirSync(out, { recursive: true });

const STOPS = {
  home: [['/', [
    ['01-hero', null, 0], ['02-new', '#new', 0], ['03-cat', '#catalog', 0], ['03b-cat-grid', '#catalog', 0.3],
    ['04-teaser', '.teaser', 0.1], ['05-delivery', '#delivery', 0], ['05b-steps', '.steps', -0.3], ['06-stores', '#address', 0.05], ['07-footer', '.ftr', 0],
  ]]],
  about: [['/about', [['01-hero', null, 0], ['02-intro', '.a-intro', 0], ['03-palette', '.a-palette', 0], ['03b-stones', '.stones', -0.4], ['04-range', '.a-range', 0], ['05-style', '.a-style', 0.1], ['06-italy', '.a-italy', 0], ['06b-mats', '.mats', -0.2], ['07-cta', '.a-cta', 0]]]],
  info: [['/info', [['01-cover', null, 0], ['02-body', '.i-body', 0], ['03-legal', '#legal', -0.1], ['04-q', '#questions', 0]]]],
  404: [['/nope', [['01', null, 0]]]],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ctx = await chromium.launchPersistentContext(path.join(os.tmpdir(), 'salmanova-shots-' + W + (reduced ? 'rm' : '')), {
  channel: 'chrome', headless: true, viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: 'ru-RU',
  reducedMotion: reduced ? 'reduce' : 'no-preference', hasTouch: W < 768, isMobile: W < 768,
});
await ctx.addInitScript(() => { try { sessionStorage.setItem('salmanova-pre', '1'); } catch {} });
const page = ctx.pages()[0] || (await ctx.newPage());
const errors = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('requestfailed', (r) => { if (!/yandex|mc\.yandex|fonts\.g/.test(r.url())) errors.push('FAILED ' + r.url()); });
page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/nope')) errors.push(`${r.status()} ${r.url()}`); });

for (const [url, stops] of STOPS[PAGE]) {
  await page.goto(BASE + url, { waitUntil: 'load', timeout: 60000 });
  await sleep(2600);
  const tag = `${PAGE}-${W}${reduced ? '-rm' : ''}`;
  for (const [name, sel, frac] of stops) {
    if (only && !only.split(',').some((o) => name.includes(o))) continue;
    const y = sel ? await page.evaluate(([s, f]) => {
      const el = document.querySelector(s); if (!el) return 0;
      const r = el.getBoundingClientRect();
      return r.top + scrollY + (f >= 0 ? r.height * f : innerHeight * f);
    }, [sel, frac]) : 0;
    // крутим шагами — чтобы сработали триггеры появления по пути
    const cur = await page.evaluate(() => scrollY);
    const steps = Math.min(12, Math.ceil(Math.abs(y - cur) / 700));
    for (let i = 1; i <= steps; i++) {
      await page.evaluate((v) => { window.__lenis ? window.__lenis.scrollTo(v, { immediate: true, force: true }) : scrollTo(0, v); }, cur + ((y - cur) * i) / steps);
      await sleep(90);
    }
    await page.evaluate((v) => { window.__lenis ? window.__lenis.scrollTo(v, { immediate: true, force: true }) : scrollTo(0, v); }, y);
    await sleep(1700);
    await page.screenshot({ path: `${out}/${tag}-${name}.png` });
  }
}
const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, h: document.documentElement.scrollHeight }));
console.log(errors.length ? 'КОНСОЛЬ:\n' + [...new Set(errors)].join('\n') : 'консоль чистая');
console.log('ширина', m.sw, '/', m.iw, 'высота', m.h);
await ctx.close();
