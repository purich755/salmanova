// Функциональная проверка: фильтры, «показать ещё», карточка товара, заявка, меню, глубокие ссылки.
//   node tools/interact.mjs [--w 1440]
import { chromium } from 'playwright-core';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i === -1 ? d : process.argv[i + 1]; };
const W = parseInt(arg('w', '1440'), 10);
const mobile = W < 768;
const BASE = 'http://localhost:8517';
const out = 'raw/shots'; fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = [], bad = [];
const check = (cond, msg) => (cond ? ok : bad).push(msg);

const ctx = await chromium.launchPersistentContext(path.join(os.tmpdir(), 'salmanova-int-' + W), {
  channel: 'chrome', headless: true, viewport: { width: W, height: mobile ? 844 : 900 }, locale: 'ru-RU', isMobile: mobile, hasTouch: mobile,
});
await ctx.addInitScript(() => { try { sessionStorage.setItem('salmanova-pre', '1'); localStorage.removeItem('salmanova-cart-v1'); } catch {} });
const page = ctx.pages()[0] || (await ctx.newPage());
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const tag = `int-${W}`;
const go = async (sel, block = 'start') => {
  await page.evaluate(([s, b]) => {
    const el = document.querySelector(s); if (!el) return;
    const y = el.getBoundingClientRect().top + scrollY - (b === 'center' ? innerHeight / 2 - el.offsetHeight / 2 : 90);
    window.__lenis ? window.__lenis.scrollTo(y, { immediate: true, force: true }) : scrollTo(0, y);
  }, [sel, block]);
  await sleep(700);
};
const count = () => page.$$eval('[data-grid] .card', (a) => a.length);
const clickReal = async (sel) => {
  const b = await page.$(sel); if (!b) throw new Error('нет ' + sel);
  await b.scrollIntoViewIfNeeded(); await sleep(250);
  const box = await b.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};

await page.goto(BASE + '/', { waitUntil: 'load' });
await sleep(2500);

/* ---------- Каталог ---------- */
await go('#catalog');
check(await count() === 18, `Первая страница каталога: ${await count()} карточек (ждём 18)`);
await page.click('[data-more]'); await sleep(600);
check(await count() === 36, `«Показать ещё»: ${await count()} (ждём 36)`);

await go('#catalog');
await page.click('.type[data-type="sergi"]'); await sleep(700);
const sergi = await page.$$eval('[data-grid] .card-title', (a) => a.map((x) => x.textContent));
check(sergi.length && sergi.every((t) => /^Серьг/.test(t)), `Тип «Серьги»: ${sergi.length} карточек, все серьги`);
check(/102/.test(await page.textContent('[data-count]')), `Счётчик «Серьги»: ${await page.textContent('[data-count]')}`);
check(page.url().includes('type=sergi'), 'Фильтр попал в адрес: ' + page.url());

await page.click('.type[data-type="all"]'); await sleep(500);
if (mobile) { await page.click('[data-filters-open]'); await sleep(700); }
await page.fill('[data-q]', 'коралл'); await sleep(900);
const coral = await page.$$eval('[data-grid] .card', (a) => a.length);
check(coral > 0, `Поиск «коралл»: ${coral} карточек`);
await page.fill('[data-q]', 'ъъъъ'); await sleep(900);
check(await page.isVisible('[data-empty]'), 'Пустой результат показывает заглушку');
await page.fill('[data-q]', ''); await sleep(900);
await page.check('[data-instock]', { force: true }); await sleep(700);
const outShown = await page.$$eval('[data-grid] .card.is-out', (a) => a.length);
check(outShown === 0, `«Только в наличии» скрывает «нет в наличии»: ${outShown}`);
await page.uncheck('[data-instock]', { force: true }); await sleep(500);
// коллекция
if (!mobile) {
  await page.click('[data-parts-more]'); await sleep(300);
  await page.click('.f-part[data-part="150301429752"]'); await sleep(800);
  check(/30/.test(await page.textContent('[data-count]')), `Коллекция «Коралл»: ${await page.textContent('[data-count]')}`);
  await page.click('[data-chips] [data-unset="part"]'); await sleep(700);
}
// цена
await page.fill('[data-pmin-n]', '10000'); await page.press('[data-pmin-n]', 'Tab'); await sleep(800);
const pr = await page.$$eval('[data-grid] .price:not(.price--ask)', (a) => a.map((x) => +x.textContent.replace(/\D/g, '')));
check(pr.length && pr.every((p) => p >= 10000), `Цена от 10 000: ${pr.length} карточек, мин ${Math.min(...pr)}`);
if (mobile) { await page.screenshot({ path: `${out}/${tag}-filters.png` }); await page.click('.f-foot [data-filters-close]'); await sleep(700); }
await page.click('[data-chips] [data-unset="price"]'); await sleep(700);
check(/523/.test(await page.textContent('[data-count]')), 'Сброс цены вернул все 523');

// сортировка
await page.selectOption('[data-sort]', 'asc'); await sleep(700);
const asc = await page.$$eval('[data-grid] .price:not(.price--ask)', (a) => a.map((x) => +x.textContent.replace(/\D/g, '')));
check(asc.every((v, i) => !i || v >= asc[i - 1]), `Сортировка по возрастанию: ${asc.slice(0, 5).join(', ')}…`);
await page.selectOption('[data-sort]', 'default'); await sleep(600);

/* ---------- Карточка товара ---------- */
await go('#catalog');
const firstId = await page.$eval('[data-grid] .card', (c) => c.dataset.id);
await clickReal('[data-grid] .card .card-link');
await sleep(1100);
check(await page.evaluate(() => document.getElementById('product').open), 'Карточка товара открывается по клику');
check(page.url().includes('#p-' + firstId), 'В адресе #p-' + firstId);
const big = await page.$eval('[data-main]', (i) => i.currentSrc || i.src);
check(/-l\.webp$/.test(big), 'Крупное фото подгружено: ' + big.split('/').pop());
await page.screenshot({ path: `${out}/${tag}-product.png` });
await page.keyboard.press('Escape'); await sleep(800);
check(!(await page.evaluate(() => document.getElementById('product').open)), 'Esc закрывает карточку');
check(!page.url().includes('#p-'), 'Хэш товара убран после закрытия: ' + page.url());

// товар с несколькими фото
const multi = await page.evaluate(() => fetch('/data/catalog.json').then((r) => r.json()).then((d) => d.products.find((p) => p.g > 2 && p.q !== 0).id));
await page.goto(`${BASE}/#p-${multi}`, { waitUntil: 'load' }); await sleep(2200);
check(await page.evaluate(() => document.getElementById('product').open), 'Прямая ссылка /#p-… открывает карточку');
const nThumbs = await page.$$eval('.pd-thumb', (a) => a.length);
await page.click('[data-next]'); await sleep(900);
const cur = await page.$eval('.pd-thumb[aria-current="true"]', (b) => b.dataset.i);
check(nThumbs > 2 && cur === '1', `Галерея: ${nThumbs} фото, «вперёд» → кадр ${cur}`);
// в заявку
await page.click('[data-pd-add]'); await sleep(1400);
check(await page.evaluate(() => document.getElementById('cart').open), '«Оставить заявку» в карточке открывает заявку');
check((await page.textContent('[data-cart-count]')).trim() === '1', 'Счётчик в шапке: ' + (await page.textContent('[data-cart-count]')));
await page.click('.ci [data-inc]'); await sleep(400);
const qty = await page.textContent('.ci output');
check(qty.trim() === '2' || qty.trim() === '1', `Количество +1: ${qty} (ограничено остатком)`);
// пустая форма → ошибки
await page.click('.order [type="submit"]'); await sleep(400);
const errs = await page.$$eval('.field-err', (a) => a.filter((x) => x.textContent).length);
check(errs === 3, `Пустая форма: ${errs} ошибки`);
await page.fill('#f-phone', '89271234567');
check((await page.inputValue('#f-phone')) === '+7 (927) 123-45-67', 'Маска телефона: ' + (await page.inputValue('#f-phone')));
await page.fill('#f-name', 'Тестова Анна'); await page.fill('#f-addr', 'Самара, ПВЗ СДЭК на Московском шоссе');
await page.click('.pill:has(input[value="Telegram"])');
await page.screenshot({ path: `${out}/${tag}-cart.png` });
await page.click('.order [type="submit"]'); await sleep(600);
check(await page.isVisible('[data-done]'), 'Валидная форма показывает экран «Заявка собрана»');
const firstBtn = await page.$eval('[data-done-actions] .btn', (a) => a.textContent.trim());
check(/Telegram/.test(firstBtn), 'Первой кнопкой — выбранный мессенджер: ' + firstBtn);
const wa = await page.$eval('[data-done-actions] a[href*="wa.me"]', (a) => a.href);
check(/wa\.me\/79277282224\?text=/.test(wa), 'Ссылка WhatsApp с текстом заявки');
await page.screenshot({ path: `${out}/${tag}-done.png` });
await page.keyboard.press('Escape'); await sleep(900);

/* ---------- Быстрое добавление с карточки ---------- */
await page.evaluate(() => localStorage.removeItem('salmanova-cart-v1'));
await page.goto(BASE + '/', { waitUntil: 'load' }); await sleep(2200);
await go('#catalog');
if (!mobile) await page.hover('[data-grid] .card');
await clickReal('[data-grid] .card [data-add]'); await sleep(1200);
check((await page.textContent('[data-cart-count]')).trim() === '1', 'Кнопка «+» на карточке добавляет в заявку');
check(await page.isVisible('[data-toast].is-on'), 'Показан тост');

/* ---------- Меню (мобильные) ---------- */
if (mobile) {
  await page.evaluate(() => window.__lenis ? window.__lenis.scrollTo(0, { immediate: true }) : scrollTo(0, 0)); await sleep(500);
  await page.click('[data-menu-toggle]'); await sleep(1000);
  check(await page.isVisible('#menu'), 'Бургер открывает меню');
  await page.screenshot({ path: `${out}/${tag}-menu.png` });
  await page.click('.menu-nav a[href="#delivery"]'); await sleep(2200);
  check(await page.isHidden('#menu'), 'Пункт меню закрывает меню');
  const top = await page.$eval('#delivery', (s) => Math.round(s.getBoundingClientRect().top));
  check(Math.abs(top) < 120, `Якорь «Доставка» доехал: top=${top}`);
} else {
  // шапка прячется при прокрутке вниз — как пользователь, сначала поднимаемся наверх
  await page.evaluate(() => window.__lenis ? window.__lenis.scrollTo(0, { immediate: true }) : scrollTo(0, 0)); await sleep(600);
  await page.click('.nav a[href="#address"]'); await sleep(2200);
  const top = await page.$eval('#address', (s) => Math.round(s.getBoundingClientRect().top));
  check(Math.abs(top) < 120, `Якорь «Адреса» доехал: top=${top}`);
}

/* ---------- Адреса: переключение карты ---------- */
await go('#address');
await page.click('.store:nth-child(2) .store-btn'); await sleep(900);
const src = await page.$eval('[data-map-frame]', (f) => f.src);
check(src.includes('50.152890'), 'Карта переключилась на Самару');

/* ---------- Глубокая ссылка с фильтром с другой страницы ---------- */
await page.goto(BASE + '/?type=kole#catalog', { waitUntil: 'load' }); await sleep(2500);
const kole = await page.$$eval('[data-grid] .card-title', (a) => a.map((x) => x.textContent));
check(kole.length && kole.every((t) => /^(Колье|Многонитное)/.test(t)), `/?type=kole: ${kole.length} карточек колье`);
const ctop = await page.$eval('#catalog', (s) => Math.round(s.getBoundingClientRect().top));
check(Math.abs(ctop) < 140, `…и прокрутка к каталогу: top=${ctop}`);

/* ---------- Горизонтальный скролл ---------- */
for (const u of ['/', '/about', '/info']) {
  await page.goto(BASE + u, { waitUntil: 'load' }); await sleep(1500);
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  check(m.sw <= m.iw, `${u}: ширина документа ${m.sw} при ${m.iw}`);
}

console.log('\nOK:\n  ' + ok.join('\n  '));
console.log(bad.length ? '\nПРОБЛЕМЫ:\n  ' + bad.join('\n  ') : '\nпроблем нет');
console.log(errors.length ? '\nКОНСОЛЬ:\n  ' + [...new Set(errors)].join('\n  ') : 'консоль чистая');
await ctx.close();
