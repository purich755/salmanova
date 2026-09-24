// Адреса магазинов: переключение точек и ленивая карта Яндекса.
import { $, $$ } from './ui.js';

// Метка по координатам: поиск по тексту в виджете выдаёт список из десятка «Лесных улиц»
const widget = (s) => `https://yandex.ru/map-widget/v1/?ll=${s.dataset.ll}&z=${s.dataset.z}&pt=${s.dataset.ll},pm2rdl`;
const maps = (s) => `https://yandex.ru/maps/?ll=${s.dataset.ll}&z=${+s.dataset.z + 1}&pt=${s.dataset.ll},pm2rdl`;

export function initStores() {
  const list = $('[data-stores]'), map = $('[data-map]');
  if (!list || !map) return;
  const frame = $('[data-map-frame]', map), ph = $('[data-map-ph]', map), open = $('[data-map-open]', map);
  const stores = $$('.store', list);
  let started = false, current = null;

  function load(store) {
    const q = store.dataset.mapQ;
    if (q === current) return;
    current = q;
    frame.title = `Карта: ${store.dataset.mapTitle}`;
    open.href = maps(store);
    if (!started) return;
    frame.classList.add('is-loading');
    ph.classList.remove('is-off');
    frame.onload = () => { frame.classList.remove('is-loading'); ph.classList.add('is-off'); };
    frame.src = widget(store);
  }
  function select(store) {
    stores.forEach((s) => {
      const on = s === store;
      s.classList.toggle('is-active', on);
      $('.store-btn', s).setAttribute('aria-pressed', on);
    });
    load(store);
  }
  list.addEventListener('click', (e) => {
    const b = e.target.closest('.store-btn');
    if (b) select(b.closest('.store'));
  });

  // карта грузится, только когда секция подъезжает к экрану
  const start = () => {
    if (started) return;
    started = true;
    const s = $('.store.is-active', list) || stores[0];
    current = null;
    load(s);
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((en) => { if (en[0].isIntersecting) { start(); io.disconnect(); } }, { rootMargin: '600px 0px' });
    io.observe(map);
  } else start();
  load($('.store.is-active', list) || stores[0]);
}
