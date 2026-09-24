// Точка входа: собирает модули под текущую страницу.
import { initMotion } from './motion.js';
import { initCart } from './cart.js';
import { initCatalog } from './catalog.js';
import { initStores } from './stores.js';
import { initMaterials } from './about.js';

const page = document.body.dataset.page;
const motion = initMotion(page);
const cart = initCart();

const api = {
  openCart: () => cart.open(),
  scrollTo: (el) => motion.scrollTo(el),
};

initCatalog(api).then((res) => {
  if (res?.product) window.__product = res.product;
  // пришли по ссылке вида /?c=…#catalog или /#delivery — доезжаем после того, как каталог отрисован
  const h = location.hash;
  if (h && !h.startsWith('#p-') && document.querySelector(h)) {
    requestAnimationFrame(() => motion.scrollTo(h, { immediate: true }));
  }
});

if (page === 'home') initStores();
if (page === 'about') initMaterials();
