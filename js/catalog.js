// Каталог: фильтры, сетка, «показать ещё», витрины-ленты, карточка товара.
import { cardHTML, esc, money, img, plural, priceHTML, PAGE, NEW_PART } from './tpl.js';
import { loadCatalog, cart } from './store.js';
import { $, $$, setupDialog, toast, flyToCart, debounce, lockScroll, reduced } from './ui.js';

const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е');
const motionOn = () => document.body.classList.contains('motion');

/* ---------- Появление карточек ---------- */
const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  let k = 0;
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.style.setProperty('--d', `${Math.min(k++, 5) * 0.07}s`);
    e.target.classList.add('is-in');
    io.unobserve(e.target);
  }
}, { rootMargin: '0px 0px -6% 0px', threshold: 0.01 }) : null;

export function revealCards(scope) {
  const cards = $$('.card:not(.is-in)', scope);
  if (!io || !motionOn()) { cards.forEach((c) => c.classList.add('is-in')); return; }
  cards.forEach((c) => io.observe(c));
}

/* ---------- Второе фото при наведении ---------- */
function bindHoverAlt() {
  document.addEventListener('pointerover', (e) => {
    const alt = e.target.closest?.('.card')?.querySelector('.card-alt[data-src]');
    if (!alt) return;
    alt.addEventListener('load', () => alt.classList.add('is-ready'), { once: true });
    alt.src = alt.dataset.src;
    alt.removeAttribute('data-src');
  });
}

/* ---------- Ленты с перетаскиванием мышью ---------- */
export function initRails(scope = document) {
  for (const rail of $$('[data-rail], [data-pd-rail]', scope)) {
    if (rail._rail) continue;
    rail._rail = true;
    let down = false, sx = 0, sl = 0, moved = 0;
    rail.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('button')) return;
      down = true; moved = 0; sx = e.clientX; sl = rail.scrollLeft;
      e.preventDefault();
    });
    // слушаем окно, а не захватываем указатель — иначе клики по вложенным кнопкам уходят в ленту
    window.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - sx;
      moved = Math.max(moved, Math.abs(dx));
      if (moved > 6) rail.classList.add('is-dragging');
      rail.scrollLeft = sl - dx;
    });
    window.addEventListener('pointerup', () => {
      if (!down) return;
      down = false;
      if (moved > 6) {
        // гасим клик, который браузер пришлёт после перетаскивания
        rail.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); }, { capture: true, once: true });
        setTimeout(() => rail.classList.remove('is-dragging'), 0);
      } else rail.classList.remove('is-dragging');
    });
    rail.addEventListener('dragstart', (e) => e.preventDefault());

    const sec = rail.closest('section');
    const step = () => Math.max(rail.clientWidth * 0.8, 260);
    $('[data-rail-prev]', sec)?.addEventListener('click', () => rail.scrollBy({ left: -step(), behavior: reduced ? 'auto' : 'smooth' }));
    $('[data-rail-next]', sec)?.addEventListener('click', () => rail.scrollBy({ left: step(), behavior: reduced ? 'auto' : 'smooth' }));

    // карточки ленты показываем разом, когда лента въехала в экран
    if (motionOn() && 'IntersectionObserver' in window) {
      const ro = new IntersectionObserver((en) => {
        if (!en[0].isIntersecting) return;
        $$('.card', rail).forEach((c, i) => { c.style.setProperty('--d', `${Math.min(i, 6) * 0.08}s`); c.classList.add('is-in'); });
        ro.disconnect();
      }, { threshold: 0.15 });
      ro.observe(rail);
    } else $$('.card', rail).forEach((c) => c.classList.add('is-in'));
  }
}

/* ---------- Карточка товара ---------- */
function initProduct(data, api) {
  const dlg = $('#product');
  if (!dlg) return null;
  const el = {
    scroll: $('.pd-scroll', dlg), stage: $('[data-stage]', dlg), main: $('[data-main]', dlg), thumbs: $('[data-thumbs]', dlg),
    prev: $('[data-prev]', dlg), next: $('[data-next]', dlg), parts: $('[data-pd-parts]', dlg), title: $('[data-pd-title]', dlg),
    text: $('[data-pd-text]', dlg), price: $('[data-pd-price]', dlg), stock: $('[data-pd-stock]', dlg), add: $('[data-pd-add]', dlg),
    wa: $('[data-pd-wa]', dlg), related: $('[data-pd-related]', dlg), relH: $('[data-pd-related-h]', dlg), rail: $('[data-pd-rail]', dlg),
  };
  let cur = null, idx = 0, pushed = false, token = 0;

  const ctl = setupDialog(dlg, {
    panel: el.scroll,
    onClose() {
      el.stage.classList.remove('is-zoom');
      if (/^#p-/.test(location.hash)) {
        if (pushed) { pushed = false; history.back(); }
        else history.replaceState(history.state, '', location.pathname + location.search);
      }
      cur = null;
    },
  });

  function setImage(i, fade = true) {
    const n = cur.g;
    idx = (i + n) % n;
    const t = ++token;
    const url = img(cur.id, idx, 'l');
    $$('.pd-thumb', el.thumbs).forEach((b, k) => b.setAttribute('aria-current', String(k === idx)));
    el.stage.classList.remove('is-zoom');
    if (fade) el.main.classList.add('is-swap');
    const pre = new Image();
    pre.onload = pre.onerror = () => {
      if (t !== token) return;
      pre.onload = pre.onerror = null;
      el.main.src = url;
      requestAnimationFrame(() => el.main.classList.remove('is-swap'));
    };
    pre.src = url;
  }

  function fill(p) {
    cur = p;
    const first = (p.d || '').split('\n')[0];
    el.title.textContent = p.t;
    el.text.textContent = p.d || '';
    el.text.hidden = !p.d;
    el.price.innerHTML = priceHTML(p);
    el.stock.className = 'pd-stock' + (p.q === 0 ? ' is-out' : '');
    el.stock.textContent = p.q === 0 ? 'Нет в наличии' : p.q > 0 ? `В наличии: ${p.q} шт.` : '';
    el.parts.innerHTML = p.c.map((id) => data.partById.get(id)).filter(Boolean)
      .map((pt) => `<a href="/?c=${pt.id}#catalog" data-part-link="${pt.id}">${esc(pt.t)}</a>`).join('');
    updateAdd();
    const msg = `Здравствуйте! Интересует ${p.t.toLowerCase()}${first ? ` — ${first}` : ''}${p.p ? `, ${money(p.p)}` : ''}. ${location.origin}/#p-${p.id}`;
    el.wa.href = `https://wa.me/79277282224?text=${encodeURIComponent(msg)}`;

    // галерея: сразу показываем уже загруженную миниатюру, крупный кадр подменяем по готовности
    token++;
    el.main.classList.remove('is-swap');
    el.main.src = img(p.id, 0, 's');
    el.main.alt = `${p.t}${first ? ' — ' + first : ''}`;
    el.thumbs.innerHTML = p.g > 1 ? Array.from({ length: p.g }, (_, k) =>
      `<button class="pd-thumb" type="button" data-i="${k}" aria-label="Фото ${k + 1} из ${p.g}" aria-current="${k === 0}"><img src="${img(p.id, k)}" alt="" width="68" height="85" loading="lazy"></button>`).join('') : '';
    el.prev.hidden = el.next.hidden = p.g < 2;
    idx = 0;
    setImage(0, false);

    // ещё из той же коллекции
    const partId = p.c.find((c) => c !== NEW_PART) || p.c[0];
    const part = partId && data.partById.get(partId);
    const rel = part ? data.products.filter((x) => x.id !== p.id && x.c.includes(partId))
      .sort((a, b) => (a.q === 0) - (b.q === 0) || a.i - b.i).slice(0, 10) : [];
    el.related.hidden = !rel.length;
    if (rel.length) {
      el.relH.textContent = partId === NEW_PART ? 'Ещё новинки' : `Ещё из коллекции «${part.t}»`;
      el.rail.innerHTML = rel.map((x) => cardHTML(x, { cls: 'is-in' })).join('');
      el.rail.scrollLeft = 0;
    }
  }

  function updateAdd() {
    if (!cur) return;
    const span = $('span', el.add);
    el.add.disabled = cur.q === 0;
    span.textContent = cur.q === 0 ? 'Нет в наличии' : cart.has(cur.id) ? 'В заявке — открыть' : 'Оставить заявку';
  }
  cart.on(updateAdd);

  el.add.addEventListener('click', () => {
    if (!cur || cur.q === 0) return;
    if (!cart.has(cur.id)) cart.add(cur.id, cur.q || 99);
    ctl.close();
    setTimeout(() => api.openCart(), reduced ? 0 : 380);
  });
  el.thumbs.addEventListener('click', (e) => { const b = e.target.closest('.pd-thumb'); if (b) setImage(+b.dataset.i); });
  el.prev.addEventListener('click', (e) => { e.stopPropagation(); setImage(idx - 1); });
  el.next.addEventListener('click', (e) => { e.stopPropagation(); setImage(idx + 1); });

  // лупа: нажатие приближает, курсор/палец ведёт кадр
  const origin = (e) => {
    const r = el.stage.getBoundingClientRect();
    el.main.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
  };
  let sx = 0, sy = 0, swiped = false;
  el.stage.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; swiped = false; });
  el.stage.addEventListener('pointerup', (e) => {
    const dx = e.clientX - sx;
    if (!el.stage.classList.contains('is-zoom') && cur.g > 1 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - sy)) {
      swiped = true; setImage(idx + (dx < 0 ? 1 : -1));
    }
  });
  el.stage.addEventListener('click', (e) => {
    if (swiped || e.target.closest('button')) return;
    origin(e);
    el.stage.classList.toggle('is-zoom');
  });
  el.stage.addEventListener('pointermove', (e) => { if (el.stage.classList.contains('is-zoom')) origin(e); });
  el.stage.addEventListener('pointerleave', () => el.stage.classList.remove('is-zoom'));

  dlg.addEventListener('keydown', (e) => {
    if (!cur || cur.g < 2 || e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); setImage(idx + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setImage(idx - 1); }
  });

  // клик по коллекции внутри карточки: на главной — фильтруем, не уходя со страницы
  el.parts.addEventListener('click', (e) => {
    const a = e.target.closest('[data-part-link]');
    if (!a || !api.showPart) return;
    e.preventDefault();
    ctl.close();
    setTimeout(() => api.showPart(a.dataset.partLink), reduced ? 0 : 360);
  });

  function open(id, { push = false } = {}) {
    const p = data.byId.get(id);
    if (!p) return false;
    const wasOpen = ctl.isOpen();
    fill(p);
    if (wasOpen) {
      history.replaceState(history.state, '', '#p-' + id);
      window.gsap && !reduced ? window.gsap.to(el.scroll, { scrollTop: 0, duration: .5, ease: 'power2.out' }) : (el.scroll.scrollTop = 0);
      return true;
    }
    if (push) { history.pushState({ pd: id }, '', '#p-' + id); pushed = true; }
    el.scroll.scrollTop = 0;
    ctl.open();
    return true;
  }

  window.addEventListener('popstate', () => {
    const m = location.hash.match(/^#p-(\d+)$/);
    if (m) { if (!ctl.isOpen() || cur?.id !== m[1]) open(m[1]); }
    else if (ctl.isOpen()) { pushed = false; ctl.close(); }
  });

  // прямая ссылка на товар
  const m = location.hash.match(/^#p-(\d+)$/);
  if (m && !open(m[1])) history.replaceState(null, '', location.pathname + location.search);

  return { open, close: ctl.close, isOpen: ctl.isOpen };
}

/* ---------- Фильтры и сетка ---------- */
function initFilters(root, data, api) {
  const P = data.products;
  const typeLabel = new Map(data.types.map((t) => [t.id, t.t]));
  const hay = new Map(P.map((p) => [p.id, norm([p.t, p.d, typeLabel.get(p.ty), ...p.c.map((c) => data.partById.get(c)?.t)].join(' '))]));
  const prices = P.map((p) => p.p).filter(Boolean);

  const el = {
    grid: $('[data-grid]', root), types: $('[data-types]', root), parts: $('[data-parts]', root), partsMore: $('[data-parts-more]', root),
    q: $('[data-q]', root), instock: $('[data-instock]', root), range: $('[data-range]', root),
    pmin: $('[data-pmin]', root), pmax: $('[data-pmax]', root), pminN: $('[data-pmin-n]', root), pmaxN: $('[data-pmax-n]', root),
    sort: $('[data-sort]', root), chips: $('[data-chips]', root), count: $('[data-count]', root), empty: $('[data-empty]', root),
    moreWrap: $('[data-more-wrap]', root), more: $('[data-more]', root), shown: $('[data-shown]', root), total: $('[data-total]', root),
    bar: $('[data-more-bar]', root), filters: $('[data-filters]', root), fshow: $('[data-fshow]', root), fbadge: $('[data-fbadge]', root),
  };
  const MIN = +el.pmin.min, MAX = +el.pmin.max;
  const DEF = { type: 'all', part: null, q: '', stock: false, min: MIN, max: MAX, sort: 'default' };
  const S = { ...DEF };
  let list = [], shown = PAGE;

  // состояние из адреса: /?type=kole&c=…&q=…&stock=1&min=…&max=…&sort=asc
  const u = new URLSearchParams(location.search);
  if (u.get('type') && typeLabel.has(u.get('type'))) S.type = u.get('type');
  if (u.get('c') && data.partById.has(u.get('c'))) S.part = u.get('c');
  if (u.get('q')) S.q = u.get('q').slice(0, 60);
  if (u.get('stock') === '1') S.stock = true;
  if (+u.get('min') > MIN) S.min = Math.min(+u.get('min'), MAX);
  if (+u.get('max') && +u.get('max') < MAX) S.max = Math.max(+u.get('max'), S.min);
  if (['asc', 'desc'].includes(u.get('sort'))) S.sort = u.get('sort');

  const isDefault = () => Object.keys(DEF).every((k) => S[k] === DEF[k]);
  const priceOn = () => S.min > MIN || S.max < MAX;

  function compute() {
    const words = norm(S.q).split(/\s+/).filter(Boolean);
    let r = P.filter((p) =>
      (S.type === 'all' || p.ty === S.type) &&
      (!S.part || p.c.includes(S.part)) &&
      (!S.stock || p.q !== 0) &&
      (!priceOn() || (p.p && p.p >= S.min && p.p <= S.max)) &&
      (!words.length || words.every((w) => hay.get(p.id).includes(w))));
    if (S.sort === 'asc') r.sort((a, b) => (!a.p) - (!b.p) || a.p - b.p || a.i - b.i);
    else if (S.sort === 'desc') r.sort((a, b) => (!a.p) - (!b.p) || b.p - a.p || a.i - b.i);
    else r.sort((a, b) => (a.q === 0) - (b.q === 0) || a.i - b.i);
    return r;
  }

  function syncControls() {
    $$('.type', el.types).forEach((b) => { const on = b.dataset.type === S.type; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on); });
    $$('.f-part', el.parts).forEach((b) => { const on = b.dataset.part === S.part; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on); });
    // выбранная коллекция из «скрытых» — раскрываем список
    if (S.part && $(`.f-part[data-part="${S.part}"]`, el.parts)?.closest('.f-extra')) toggleParts(true);
    if (el.q.value !== S.q) el.q.value = S.q;
    el.instock.checked = S.stock;
    el.pmin.value = S.min; el.pmax.value = S.max;
    el.pminN.value = S.min; el.pmaxN.value = S.max;
    el.range.style.setProperty('--a', `${((S.min - MIN) / (MAX - MIN)) * 100}%`);
    el.range.style.setProperty('--b', `${((S.max - MIN) / (MAX - MIN)) * 100}%`);
    el.sort.value = S.sort;
  }

  function chips() {
    const c = [];
    const x = '<svg aria-hidden="true"><use href="#i-close"/></svg>';
    if (S.type !== 'all') c.push(['type', typeLabel.get(S.type)]);
    if (S.part) c.push(['part', data.partById.get(S.part).t]);
    if (S.q) c.push(['q', `«${S.q}»`]);
    if (S.stock) c.push(['stock', 'В наличии']);
    if (priceOn()) c.push(['price', `${money(S.min)} — ${money(S.max)}`]);
    el.chips.innerHTML = c.map(([k, t]) => `<button class="chip" type="button" data-unset="${k}" aria-label="Убрать фильтр: ${esc(t)}">${esc(t)}${x}</button>`).join('');
    const n = c.filter(([k]) => k !== 'type').length;
    el.fbadge.hidden = !n; el.fbadge.textContent = n;
  }

  function writeURL() {
    const q = new URLSearchParams();
    if (S.type !== 'all') q.set('type', S.type);
    if (S.part) q.set('c', S.part);
    if (S.q) q.set('q', S.q);
    if (S.stock) q.set('stock', '1');
    if (S.min > MIN) q.set('min', S.min);
    if (S.max < MAX) q.set('max', S.max);
    if (S.sort !== 'default') q.set('sort', S.sort);
    const s = q.toString();
    history.replaceState(history.state, '', location.pathname + (s ? '?' + s : '') + location.hash);
  }

  function meta() {
    const n = list.length;
    el.count.textContent = `${n} ${plural(n, 'изделие', 'изделия', 'изделий')}`;
    el.fshow.textContent = n;
    const s = Math.min(shown, n);
    el.shown.textContent = s; el.total.textContent = n;
    el.bar.style.width = n ? `${(s / n) * 100}%` : '0%';
    el.more.hidden = s >= n;
    el.moreWrap.hidden = !n;
    el.empty.hidden = !!n;
    const rest = Math.min(PAGE, n - s);
    el.more.textContent = rest > 0 ? `Показать ещё ${rest}` : 'Показать ещё';
  }

  let busyT;
  function apply({ scroll = false } = {}) {
    list = compute();
    shown = PAGE;
    syncControls(); chips(); writeURL(); meta();
    const render = () => {
      el.grid.innerHTML = list.slice(0, shown).map((p, i) => cardHTML(p, { eager: i < 3 })).join('');
      el.grid.classList.remove('is-busy');
      revealCards(el.grid);
    };
    clearTimeout(busyT);
    if (reduced || !motionOn()) render();
    else { el.grid.classList.add('is-busy'); busyT = setTimeout(render, 260); }
    if (scroll) api.scrollTo?.(root);
  }

  function more() {
    const from = shown;
    shown = Math.min(shown + PAGE, list.length);
    el.grid.insertAdjacentHTML('beforeend', list.slice(from, shown).map((p) => cardHTML(p)).join(''));
    revealCards(el.grid);
    meta();
    window.ScrollTrigger?.refresh();
  }

  const toggleParts = (force) => {
    const open = force ?? !el.parts.classList.contains('is-open');
    el.parts.classList.toggle('is-open', open);
    el.partsMore.setAttribute('aria-expanded', open);
    el.partsMore.textContent = open ? 'Свернуть' : 'Показать все коллекции';
  };

  // события
  el.types.addEventListener('click', (e) => {
    const b = e.target.closest('.type'); if (!b) return;
    S.type = b.dataset.type; apply();
  });
  el.parts.addEventListener('click', (e) => {
    const b = e.target.closest('.f-part'); if (!b) return;
    S.part = S.part === b.dataset.part ? null : b.dataset.part; apply();
  });
  el.partsMore.addEventListener('click', () => toggleParts());
  el.q.addEventListener('input', debounce(() => { S.q = el.q.value.trim(); apply(); }, 280));
  el.q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); S.q = el.q.value.trim(); apply(); closeSheet(); } });
  el.instock.addEventListener('change', () => { S.stock = el.instock.checked; apply(); });
  el.sort.addEventListener('change', () => { S.sort = el.sort.value; apply(); });

  const applyPrice = debounce(apply, 220);
  const onRange = (which) => {
    let a = +el.pmin.value, b = +el.pmax.value;
    if (a > b - 100) { if (which === 'min') a = b - 100; else b = a + 100; }
    S.min = Math.max(MIN, a); S.max = Math.min(MAX, b);
    syncControls(); applyPrice();
  };
  el.pmin.addEventListener('input', () => onRange('min'));
  el.pmax.addEventListener('input', () => onRange('max'));
  const onNum = () => {
    const a = parseInt(el.pminN.value.replace(/\D/g, ''), 10), b = parseInt(el.pmaxN.value.replace(/\D/g, ''), 10);
    S.min = Number.isFinite(a) ? Math.min(Math.max(a, MIN), MAX) : MIN;
    S.max = Number.isFinite(b) ? Math.max(Math.min(b, MAX), S.min) : MAX;
    apply();
  };
  el.pminN.addEventListener('change', onNum);
  el.pmaxN.addEventListener('change', onNum);

  el.chips.addEventListener('click', (e) => {
    const b = e.target.closest('[data-unset]'); if (!b) return;
    const k = b.dataset.unset;
    if (k === 'type') S.type = 'all';
    if (k === 'part') S.part = null;
    if (k === 'q') S.q = '';
    if (k === 'stock') S.stock = false;
    if (k === 'price') { S.min = MIN; S.max = MAX; }
    apply();
  });
  $$('[data-reset]', root).forEach((b) => b.addEventListener('click', () => { Object.assign(S, DEF, { sort: S.sort }); apply(); }));
  el.more.addEventListener('click', more);

  // нижний лист фильтров на мобильных
  let scrim = null;
  const mq = matchMedia('(max-width: 980px)');
  function openSheet() {
    if (!mq.matches) return;
    scrim ||= Object.assign(document.createElement('div'), { className: 'sheet-scrim' });
    if (!scrim.isConnected) { document.body.append(scrim); scrim.addEventListener('click', closeSheet); }
    requestAnimationFrame(() => scrim.classList.add('is-on'));
    el.filters.classList.add('is-open');
    lockScroll(true);
    setTimeout(() => el.q.focus({ preventScroll: true }), 350);
  }
  function closeSheet() {
    if (!el.filters.classList.contains('is-open')) return;
    el.filters.classList.remove('is-open');
    scrim?.classList.remove('is-on');
    lockScroll(false);
    $('[data-filters-open]', root)?.focus({ preventScroll: true });
  }
  $('[data-filters-open]', root)?.addEventListener('click', openSheet);
  $$('[data-filters-close]', root).forEach((b) => b.addEventListener('click', closeSheet));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
  mq.addEventListener('change', () => { if (!mq.matches) closeSheet(); });

  // «Все новинки» и коллекции из карточки товара
  function showPart(id) {
    Object.assign(S, DEF, { part: id });
    apply({ scroll: true });
  }
  $$('[data-show-part]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); showPart(a.dataset.showPart); }));

  // первая отрисовка: если фильтров в адресе нет — сетка уже пререндерена сервером
  list = compute();
  syncControls(); chips(); meta();
  if (!isDefault()) apply();
  else revealCards(el.grid);

  return { showPart, setType(t) { S.type = t; apply({ scroll: true }); } };
}

/* ---------- Сборка ---------- */
export async function initCatalog(api) {
  bindHoverAlt();
  revealCards(document);
  let data;
  try {
    data = await loadCatalog();
  } catch {
    toast('Не удалось загрузить каталог. Обновите страницу.');
    return null;
  }
  cart.prune(data.byId);

  const root = $('#catalog');
  const f = root ? initFilters(root, data, api) : null;
  if (f) api.showPart = f.showPart;
  const product = initProduct(data, api);
  initRails();

  // карточки: открыть товар / добавить в заявку
  document.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) {
      e.preventDefault();
      const p = data.byId.get(add.dataset.add);
      if (!p) return;
      cart.add(p.id, p.q || 99);
      add.classList.add('is-added');
      add.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-check"/></svg>';
      add.setAttribute('aria-label', `В заявке: ${p.t}`);
      flyToCart(add.closest('.card')?.querySelector('.card-media img'));
      toast(`${p.t} — в заявке`, { label: 'Открыть заявку', run: api.openCart });
      return;
    }
    const link = e.target.closest('.card-link');
    if (link && product && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      product.open(link.closest('.card').dataset.id, { push: !product.isOpen() });
    }
  });
  return { data, product };
}
