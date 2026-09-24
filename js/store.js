// Данные каталога и корзина-заявка (хранится в localStorage).

let catalog = null;
let loading = null;

export function loadCatalog() {
  if (catalog) return Promise.resolve(catalog);
  if (!loading) {
    loading = fetch('/data/catalog.json')
      .then((r) => { if (!r.ok) throw new Error('catalog ' + r.status); return r.json(); })
      .then((d) => {
        d.byId = new Map(d.products.map((p, i) => { p.i = i; return [p.id, p]; }));
        d.partById = new Map(d.parts.map((p) => [p.id, p]));
        catalog = d;
        return d;
      })
      .catch((e) => { loading = null; throw e; });
  }
  return loading;
}

const KEY = 'salmanova-cart-v1';
const bus = new EventTarget();
let items = read();

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => x && typeof x.id === 'string' && x.n > 0) : [];
  } catch { return []; }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* приватный режим — заявка живёт до перезагрузки */ }
  bus.dispatchEvent(new Event('change'));
}

// Чужая вкладка поменяла заявку — подхватываем
window.addEventListener('storage', (e) => { if (e.key === KEY) { items = read(); bus.dispatchEvent(new Event('change')); } });

export const cart = {
  on: (fn) => bus.addEventListener('change', fn),
  items: () => items.slice(),
  count: () => items.reduce((s, x) => s + x.n, 0),
  has: (id) => items.some((x) => x.id === id),
  add(id, max) {
    const it = items.find((x) => x.id === id);
    if (it) it.n = Math.min(it.n + 1, max || 99);
    else items.push({ id, n: 1 });
    save();
  },
  set(id, n) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    if (n <= 0) items = items.filter((x) => x.id !== id);
    else it.n = n;
    save();
  },
  remove(id) { items = items.filter((x) => x.id !== id); save(); },
  clear() { items = []; save(); },
  // Удаляем то, чего больше нет в каталоге
  prune(byId) { const before = items.length; items = items.filter((x) => byId.has(x.id)); if (items.length !== before) save(); },
};
