// Общие шаблоны карточек — используются и в браузере, и при сборке страниц (tools/build-html.mjs),
// поэтому здесь нет обращений к DOM.

export const FREE_DELIVERY = 15000;
export const PAGE = 18;

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// toLocaleString('ru-RU') не группирует четырёхзначные числа — группируем сами
export const money = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';

// Префикс адресов: '' на своём домене, '/salmanova' на GitHub Pages. Сборка пишет его в <html data-base>.
// При пререндере в Node документа нет — пути префиксует сама сборка (tools/build-html.mjs).
export const BASE = (typeof document !== 'undefined' && document.documentElement.dataset.base) || '';

export const img = (id, i = 0, size = 's') => `${BASE}/assets/p/${id}-${i}-${size}.webp`;

export const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many;
};

// «Новинки» — служебная коллекция магазина, по ней ставим метку на карточке
export const NEW_PART = '905133045582';

export const stock = (p) => (p.q === 0 ? 'out' : p.q > 0 ? 'in' : 'any');

export function priceHTML(p) {
  if (!p.p) return `<span class="price price--ask">Цена по запросу</span>`;
  return `<span class="price">${money(p.p)}</span>${p.o ? `<s class="price-old">${money(p.o)}</s>` : ''}`;
}

export function badgesHTML(p) {
  const b = [];
  if (p.m) b.push(`<span class="badge badge--sale">${esc(p.m)}</span>`);
  else if (p.c.includes(NEW_PART)) b.push(`<span class="badge">Новинка</span>`);
  if (p.q === 0) b.push(`<span class="badge badge--out">Нет в наличии</span>`);
  return b.length ? `<div class="card-badges">${b.join('')}</div>` : '';
}

// Карточка каталога. eager — для первых кадров первого экрана каталога.
export function cardHTML(p, { eager = false, cls = '' } = {}) {
  const alt = esc(`${p.t}${p.d ? ' — ' + p.d.split('\n')[0] : ''}`);
  const out = p.q === 0;
  return `<article class="card${out ? ' is-out' : ''}${cls ? ' ' + cls : ''}" data-id="${p.id}">
  <a class="card-link" href="#p-${p.id}" aria-label="${esc(p.t)}${p.p ? ', ' + money(p.p) : ''}">
    <figure class="card-media" style="--bg:${p.bg};--r:${p.r}">
      <img src="${img(p.id)}" alt="${alt}" width="520" height="${Math.round(520 * Math.min(p.r, 1.6))}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">
      ${p.g > 1 ? `<img class="card-alt" data-src="${img(p.id, 1)}" alt="" width="520" height="650" aria-hidden="true">` : ''}
      ${badgesHTML(p)}
    </figure>
    <div class="card-body">
      <h3 class="card-title">${esc(p.t)}</h3>
      ${p.d ? `<p class="card-text">${esc(p.d.split('\n')[0])}</p>` : ''}
      <div class="card-price">${priceHTML(p)}</div>
    </div>
  </a>
  ${out ? '' : `<button class="card-add" type="button" data-add="${p.id}" aria-label="Добавить в заявку: ${esc(p.t)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>`}
</article>`;
}
