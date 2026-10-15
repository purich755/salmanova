// Собирает страницы из src/pages + src/partials в корень сайта.
// Первую страницу каталога и витрину новинок пререндерит тем же шаблоном, что и браузер (js/tpl.js).
//   node tools/build-html.mjs
//   BASE=/salmanova node tools/build-html.mjs   — для GitHub Pages (сайт живёт в подпапке)
import fs from 'node:fs';
import { cardHTML, esc, plural, img, PAGE, NEW_PART } from '../js/tpl.js';

const cat = JSON.parse(fs.readFileSync('data/catalog.json', 'utf8'));
const P = cat.products;
const partById = Object.fromEntries(cat.parts.map((p) => [p.id, p]));

// Порядок по умолчанию, как у магазина: сначала то, что в наличии
const byDefault = P.map((p, i) => [p, i]).sort((a, b) => (a[0].q === 0) - (b[0].q === 0) || a[1] - b[1]).map(([p]) => p);

const SERVICE_PARTS = new Set([NEW_PART, '505674165742']); // «Новинки» и «Комплекты» — разделы, а не коллекции
const collections = cat.parts.filter((p) => !SERVICE_PARTS.has(p.id));
const prices = P.map((p) => p.p).filter(Boolean);
const PRICE_MIN = Math.floor(Math.min(...prices) / 100) * 100;
const PRICE_MAX = Math.ceil(Math.max(...prices) / 100) * 100;

/* ---------- Соцсети: у каждого адреса свой набор, как на исходном сайте ---------- */
const SOC = {
  tg: ['https://t.me/Salmanova_Svetlana', 'Telegram', 'i-tg'],
  max: ['https://max.ru/join/mts7jApp1SAEUwBg2Y9RZBMe9csZqtNUP7iGYI5Pa5I', 'MAX', 'i-max'],
  ig: ['https://www.instagram.com/salmanovas', 'Instagram', 'i-ig'],
  wa: ['https://wa.me/79277282224', 'WhatsApp', 'i-wa'],
  vk: ['https://vk.com/shopsalmanova', 'ВКонтакте', 'i-vk'],
  yt: ['https://www.youtube.com/channel/UCP3f0D67o-llmwuUvKYE9Tw', 'YouTube', 'i-yt'],
};
const socials = (keys, cls = 'socials') =>
  `<ul class="${cls}">${keys.map((k) => `<li><a href="${SOC[k][0]}" target="_blank" rel="noopener" aria-label="${SOC[k][1]}"><svg aria-hidden="true"><use href="#${SOC[k][2]}"/></svg></a></li>`).join('')}</ul>`;

/* ---------- Магазины ----------
   Координаты — из OpenStreetMap (у исходного сайта карты стояли на заглушке с координатами Нью-Йорка). */
const STORES = [
  { city: 'Москва', name: 'Салон в Москве', addr: 'Ул. Лесная 10-16', note: 'Метро Белорусская',
    tel: ['+79252888018', '+7 (925) 288-80-18'], soc: ['tg', 'max', 'ig', 'wa'],
    map: 'Москва, улица Лесная, 10-16', ll: '37.589230,55.778535', z: 16, title: 'салон в Москве, ул. Лесная 10-16' },
  { city: 'Самара', name: 'Самара, Московское шоссе 9', addr: 'Московское шоссе 9', note: '1 этаж жилого дома, вход со стороны Московского шоссе',
    tel: ['+79277282224', '+7 927 728 22 24'], soc: ['ig', 'tg', 'wa', 'max', 'vk'],
    map: 'Самара, Московское шоссе, 9', ll: '50.152890,53.202950', z: 16, title: 'Самара, Московское шоссе 9' },
  { city: 'Аэропорт Курумоч', name: 'Международный аэропорт Курумоч', addr: 'Зона ВВЛ', note: 'Самарская область',
    tel: ['+79170196022', '+7 917 019 60 22'], soc: ['vk', 'tg', 'max'],
    map: 'Международный аэропорт Курумоч', ll: '50.156994,53.505751', z: 14, title: 'Международный аэропорт Курумоч, зона ВВЛ' },
];
const storesHTML = STORES.map((s, i) => `<li class="store${i === 0 ? ' is-active' : ''}" data-reveal data-map-q="${esc(s.map)}" data-ll="${s.ll}" data-z="${s.z}" data-map-title="${esc(s.title)}">
  <button class="store-btn" type="button" aria-pressed="${i === 0}"><span class="store-n">0${i + 1}</span><span class="store-city">${esc(s.city)}</span><svg class="store-pin" aria-hidden="true"><use href="#i-pin"/></svg></button>
  <div class="store-body">
    <p class="store-name">${esc(s.name)}</p>
    ${s.addr !== s.name ? `<p class="store-addr">${esc(s.addr)}</p>` : ''}
    <p class="store-note">${esc(s.note)}</p>
    <a class="store-tel" href="tel:${s.tel[0]}"><svg aria-hidden="true"><use href="#i-phone"/></svg>${esc(s.tel[1])}</a>
    ${socials(s.soc, 'socials socials--sm')}
  </div>
</li>`).join('\n');

/* ---------- Фрагменты каталога ---------- */
const typeChips = [`<button class="type is-active" type="button" data-type="all" aria-pressed="true">Все <sup>${P.length}</sup></button>`]
  .concat(cat.types.slice().sort((a, b) => b.n - a.n).map((t) => `<button class="type" type="button" data-type="${t.id}" aria-pressed="false">${esc(t.t)} <sup>${t.n}</sup></button>`))
  .join('');

const partList = cat.parts.map((p, i) => `<li${i >= 10 ? ' class="f-extra"' : ''}><button class="f-part" type="button" data-part="${p.id}" aria-pressed="false"><span>${esc(p.t)}</span><sup>${p.n}</sup></button></li>`).join('');

const marquee = (() => {
  const items = collections.map((p) => `<span class="mq-item">${esc(p.t)}</span><span class="mq-bead" aria-hidden="true"></span>`).join('');
  return `<div class="mq-group">${items}</div><div class="mq-group" aria-hidden="true">${items}</div>`;
})();

const newItems = byDefault.filter((p) => p.c.includes(NEW_PART) && p.q !== 0).slice(0, 14);
const newRail = newItems.map((p) => cardHTML(p, { cls: 'card--rail' })).join('');
const nNew = P.filter((p) => p.c.includes(NEW_PART)).length;

const cards = byDefault.slice(0, PAGE).map((p, i) => cardHTML(p, { eager: i < 3 })).join('');

// Камни и стекло — коллекции, названные по материалу
const STONE_PARTS = ['Муранское стекло', 'Жемчуг', 'Коралл', 'Черный агат', 'Бразильский агат', 'Лунный камень', 'Розовый кварц', 'Малахит', 'Сердолик', 'Аметист', 'Аквамарин'];
const stones = STONE_PARTS.map((name) => cat.parts.find((p) => p.t === name)).filter(Boolean).map((part) => {
  const pr = byDefault.find((p) => p.c.includes(part.id));
  return `<a class="stone" href="/?c=${part.id}#catalog"><img src="${img(pr.id)}" alt="" width="520" height="650" loading="lazy" decoding="async"><span>${esc(part.t)}</span><sup>${part.n}</sup></a>`;
}).join('');
const stonesTrack = `<div class="stones-group">${stones}</div><div class="stones-group" aria-hidden="true">${stones.replace(/<a /g, '<a tabindex="-1" ')}</div>`;

const TILE_TYPES = ['kole', 'brosh', 'kolco', 'braslet', 'sergi', 'podveska'];
const typeTiles = TILE_TYPES.map((id) => {
  const t = cat.types.find((x) => x.id === id);
  const pr = byDefault.find((p) => p.ty === id && p.q !== 0) || byDefault.find((p) => p.ty === id);
  return `<li data-reveal><a class="tile" href="/?type=${id}#catalog"><span class="tile-img"><img src="${img(pr.id)}" alt="" width="520" height="650" loading="lazy" decoding="async"></span><span class="tile-name">${esc(t.t)}</span><span class="tile-n">${t.n}</span></a></li>`;
}).join('');

const ld = {
  '@context': 'https://schema.org', '@type': 'JewelryStore', name: 'Салманова — авторские украшения',
  description: 'Эксклюзивные украшения из венецианского стекла и натуральных камней.',
  url: 'https://salmanova.ru/', image: 'https://salmanova.ru/assets/img/og.jpg',
  telephone: '+7 927 728-22-24', email: 'salmanova-shop@mail.ru', founder: { '@type': 'Person', name: 'Светлана Салманова' },
  address: { '@type': 'PostalAddress', streetAddress: 'Московское шоссе, 9', addressLocality: 'Самара', addressCountry: 'RU' },
  sameAs: [SOC.vk[0], SOC.tg[0], SOC.yt[0], SOC.ig[0]],
};

/* ---------- Страницы ---------- */
const PAGES = {
  index: { TITLE: 'Авторские украшения Светланы Салмановой', DESC: 'Украшения из муранского стекла и натуральных камней. Каталог, доставка по России, салоны в Москве и Самаре.', PATH: '/', HOME: '' },
  about: { TITLE: 'О Светлане — авторские украшения Светланы Салмановой', DESC: 'Светлана Салманова: муранское стекло, натуральные камни и 18 лет сотрудничества с итальянской мастерской Fabio.', PATH: '/about', HOME: '/', NAV_ABOUT: ' aria-current="page"' },
  info: { TITLE: 'Вопросы — авторские украшения Светланы Салмановой', DESC: 'Возврат, ремонт, юридическая информация и контакты магазина авторских украшений Светланы Салмановой.', PATH: '/info', HOME: '/', NAV_INFO: ' aria-current="page"' },
  404: { TITLE: 'Страница не найдена — Salmanova', DESC: 'Такой страницы нет. Каталог авторских украшений — на главной.', PATH: '/404', HOME: '/' },
};

const COMMON = {
  YEAR: String(new Date().getFullYear()),
  SOCIALS: socials(['tg', 'wa', 'max', 'vk', 'ig', 'yt']),
  SOCIALS_FOOTER: socials(['vk', 'tg', 'max', 'yt', 'wa', 'ig'], 'socials socials--ftr'),
  N_PRODUCTS: String(P.length), N_PRODUCTS_WORD: plural(P.length, 'изделие', 'изделия', 'изделий'),
  N_COLLECTIONS: String(collections.length), N_COLLECTIONS_WORD: plural(collections.length, 'коллекция', 'коллекции', 'коллекций'),
  N_NEW: String(nNew), N_NEW_WORD: plural(nNew, 'новое изделие', 'новых изделия', 'новых изделий'),
  PRICE_MIN: String(PRICE_MIN), PRICE_MAX: String(PRICE_MAX), PAGE: String(PAGE),
  MORE_PCT: ((PAGE / P.length) * 100).toFixed(2),
  CARDS: cards, NEW_RAIL: newRail, TYPE_CHIPS: typeChips, PART_LIST: partList, MARQUEE: marquee,
  STORES: storesHTML, STONES: stonesTrack, TYPE_TILES: typeTiles,
  LD_STORE: JSON.stringify(ld),
  NAV_ABOUT: '', NAV_INFO: '',
};

const BASE = (process.env.BASE || '').replace(/\/$/, '');
// Все корневые адреса в атрибутах (/assets/…, /about, /?c=…, /#catalog) получают префикс BASE
const rebase = (html) => !BASE ? html : html
  .replace(/(\s(?:href|src|data-src|srcset|imagesrcset)=")\/(?!\/)/g, `$1${BASE}/`)
  .replace(/, \/(assets\/)/g, `, ${BASE}/$1`);

const partial = (name) => fs.readFileSync(`src/partials/${name}.html`, 'utf8');
for (const [name, vars] of Object.entries(PAGES)) {
  let html = fs.readFileSync(`src/pages/${name}.html`, 'utf8');
  for (let k = 0; k < 3; k++) html = html.replace(/<!-- @include (\w+) -->/g, (_, n) => partial(n));
  const V = { ...COMMON, ...vars };
  html = html.replace(/\{\{(\w+)\}\}/g, (m, k) => {
    if (!(k in V)) throw new Error(`${name}: нет значения для ${m}`);
    return V[k];
  });
  html = rebase(html).replace('<html lang="ru">', `<html lang="ru" data-base="${BASE}">`);
  fs.writeFileSync(`${name}.html`, html);
  console.log('✓', `${name}.html`, (html.length / 1024).toFixed(0), 'KB');
}
console.log(`цены ${PRICE_MIN}…${PRICE_MAX}, коллекций ${collections.length}, новинок ${nNew}`);
