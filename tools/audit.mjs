// Аудит страниц: картинки, ссылки, доступные имена, дубли id, контраст, горизонтальный скролл, вес первого экрана.
//   node tools/audit.mjs [--w 1440] [--reduced]
import { chromium } from 'playwright-core';
import os from 'node:os'; import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i === -1 ? d : process.argv[i + 1]; };
const W = parseInt(arg('w', '1440'), 10);
const reduced = process.argv.includes('--reduced');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ctx = await chromium.launchPersistentContext(path.join(os.tmpdir(), 'salmanova-audit-' + W + reduced), {
  channel: 'chrome', headless: true, viewport: { width: W, height: W < 700 ? 844 : 900 }, isMobile: W < 700, hasTouch: W < 700,
  locale: 'ru-RU', reducedMotion: reduced ? 'reduce' : 'no-preference',
});
await ctx.addInitScript(() => { try { sessionStorage.setItem('salmanova-pre', '1'); } catch {} });
const page = ctx.pages()[0] || (await ctx.newPage());
let bad = 0;

for (const url of ['/', '/about', '/info', '/nope']) {
  const errors = [], failed = [];
  let bytes = 0;
  const onErr = (e) => errors.push(e.message || e.text());
  const onCon = (m) => m.type() === 'error' && errors.push(m.text());
  const onResp = async (r) => {
    if (r.status() >= 400 && !r.url().includes('/nope')) failed.push(`${r.status()} ${r.url()}`);
    try { if (r.url().startsWith('http://localhost')) bytes += (await r.body()).length; } catch {}
  };
  page.on('pageerror', onErr); page.on('console', onCon); page.on('response', onResp);
  await page.goto('http://localhost:8517' + url, { waitUntil: 'load' });
  await sleep(2500);
  const firstLoad = bytes;
  for (let i = 0; i < 40; i++) { await page.evaluate(() => window.__lenis ? window.__lenis.scrollTo(scrollY + 700, { immediate: true, force: true }) : scrollBy(0, 700)); await sleep(90); }
  await sleep(1500);

  const r = await page.evaluate(() => {
    const out = [];
    const vis = (el) => !el.closest('[hidden], dialog:not([open]), .sprite');
    // картинки
    for (const i of document.images) {
      if (!vis(i)) continue;
      if (i.closest('.stones-group[aria-hidden]')) continue;
      if (i.getAttribute('alt') === null) out.push('img без alt: ' + i.src.split('/').pop());
      if (!i.getAttribute('width') || !i.getAttribute('height')) out.push('img без размеров: ' + i.src.split('/').pop());
      if (i.complete && i.naturalWidth === 0 && i.getAttribute('src')) out.push('битая img: ' + i.src.split('/').pop());
    }
    // ссылки и кнопки
    for (const a of document.querySelectorAll('a')) {
      const h = a.getAttribute('href');
      if (!h || h === '#') out.push('ссылка в никуда: ' + a.outerHTML.slice(0, 80));
      if (h && /^#[a-z]/.test(h) && !h.startsWith('#p-') && !document.querySelector(h)) out.push('битый якорь: ' + h);
      if (a.target === '_blank' && !/noopener/.test(a.rel)) out.push('_blank без noopener: ' + h);
      if (!a.textContent.trim() && !a.getAttribute('aria-label')) out.push('ссылка без имени: ' + h);
    }
    for (const b of document.querySelectorAll('button')) if (!b.textContent.trim() && !b.getAttribute('aria-label')) out.push('кнопка без имени: ' + b.className);
    for (const i of document.querySelectorAll('input, select, textarea')) {
      if (i.type === 'hidden' || i.type === 'radio' || i.type === 'checkbox' && i.closest('label')) continue;
      if (!i.getAttribute('aria-label') && !i.closest('label') && !(i.id && document.querySelector(`label[for="${i.id}"]`))) out.push('поле без подписи: ' + (i.name || i.className));
    }
    // дубли id
    const ids = {}; for (const e of document.querySelectorAll('[id]')) ids[e.id] = (ids[e.id] || 0) + 1;
    for (const [k, v] of Object.entries(ids)) if (v > 1) out.push(`дубль id: ${k} ×${v}`);
    // h1
    const h1 = document.querySelectorAll('h1').length; if (h1 !== 1) out.push('h1 на странице: ' + h1);
    // контраст видимого текста
    const lin = (c) => (c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
    const L = ([r, g, b]) => .2126 * lin(r / 255) + .7152 * lin(g / 255) + .0722 * lin(b / 255);
    const num = (s) => (s.match(/[\d.]+/g) || []).map(Number);
    const bgOf = (el) => { for (let n = el; n; n = n.parentElement) { const c = num(getComputedStyle(n).backgroundColor); if (c.length >= 3 && (c[3] ?? 1) > .6) return c; if (getComputedStyle(n).backgroundImage.includes('url')) return null; } return [244, 239, 232]; };
    const low = new Set();
    for (const el of document.querySelectorAll('p, a, span, li, dt, dd, button, label, h1, h2, h3, legend, sup, b, em')) {
      if (!vis(el) || el.closest('[aria-hidden="true"]') || el.closest('.hero-art, .i-cover, .tile, .card-media, .map, .mat-art')) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || +cs.opacity === 0 || el.closest('.w')) continue;
      const fg = num(cs.color); const bg = bgOf(el); if (!bg || fg.length < 3) continue;
      const a = fg[3] ?? 1; const f = fg.slice(0, 3).map((c, i) => c * a + bg[i] * (1 - a));
      const r1 = L(f), r2 = L(bg.slice(0, 3)); const cr = (Math.max(r1, r2) + .05) / (Math.min(r1, r2) + .05);
      const big = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.6 && +cs.fontWeight >= 700);
      if (cr < (big ? 3 : 4.5)) low.add(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} «${el.textContent.trim().slice(0, 24)}» ${cr.toFixed(2)}`);
    }
    out.push(...[...low].slice(0, 12).map((x) => 'контраст: ' + x));
    // скрытые анимацией блоки, которые так и не появились
    const stuck = [...document.querySelectorAll('[data-reveal], [data-hero-fade], [data-split]')].filter((e) => vis(e) && (+getComputedStyle(e).opacity < .5 || getComputedStyle(e).visibility === 'hidden'));
    if (stuck.length) out.push(`не проявились: ${stuck.length} → ` + stuck.slice(0, 4).map((e) => e.className || e.tagName).join(', '));
    const sw = document.documentElement.scrollWidth; if (sw > innerWidth) out.push(`горизонтальный скролл ${sw} > ${innerWidth}`);
    return out;
  });
  const all = [...r, ...failed, ...errors.map((e) => 'консоль: ' + e)];
  bad += all.length;
  console.log(`\n${url} (${W}${reduced ? ', reduced' : ''}) — первая загрузка ${(firstLoad / 1024).toFixed(0)} КБ с локального сервера`);
  console.log(all.length ? '  ' + [...new Set(all)].join('\n  ') : '  ✓ замечаний нет');
  page.off('pageerror', onErr); page.off('console', onCon); page.off('response', onResp);
}
await ctx.close();
process.exitCode = bad ? 1 : 0;
