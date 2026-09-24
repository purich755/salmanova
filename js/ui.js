// Общие UI-механики: модальные окна поверх Lenis, тост, «полёт» товара в заявку.

export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const G = () => window.gsap;

let locks = 0;
export function lockScroll(on) {
  locks = Math.max(0, locks + (on ? 1 : -1));
  const locked = locks > 0;
  document.body.classList.toggle('is-locked', locked);
  const l = window.__lenis;
  if (l) locked ? l.stop() : l.start();
}

/* ---------- <dialog> с анимацией ---------- */
export function setupDialog(dlg, { panel, from = 'up', onClose } = {}) {
  const inner = panel || dlg.firstElementChild;
  let closing = false;

  function open() {
    if (dlg.open) return;
    dlg.showModal();
    lockScroll(true);
    const g = G();
    if (g && !reduced) {
      g.fromTo(inner,
        from === 'right' ? { xPercent: 100 } : { y: 40, opacity: 0, scale: .985 },
        from === 'right' ? { xPercent: 0, duration: .7, ease: 'expo.out' } : { y: 0, opacity: 1, scale: 1, duration: .6, ease: 'expo.out', clearProps: 'transform' });
      g.fromTo(dlg, { opacity: 0 }, { opacity: 1, duration: .35, ease: 'power1.out', clearProps: 'opacity' });
    }
  }
  function close() {
    if (!dlg.open || closing) return;
    closing = true;
    const done = () => { dlg.close(); closing = false; lockScroll(false); onClose && onClose(); };
    const g = G();
    if (g && !reduced) {
      g.to(inner, from === 'right' ? { xPercent: 100, duration: .45, ease: 'power3.in' } : { y: 30, opacity: 0, duration: .3, ease: 'power2.in' });
      g.to(dlg, { opacity: 0, duration: .32, delay: from === 'right' ? .15 : 0, onComplete: () => { g.set([dlg, inner], { clearProps: 'all' }); done(); } });
    } else done();
  }
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  // клик по подложке
  dlg.addEventListener('pointerdown', (e) => { dlg._downOnBackdrop = e.target === dlg; });
  dlg.addEventListener('click', (e) => { if (e.target === dlg && dlg._downOnBackdrop) close(); });
  return { open, close, isOpen: () => dlg.open };
}

/* ---------- Тост ---------- */
let toastT;
export function toast(msg, action) {
  const t = $('[data-toast]');
  if (!t) return;
  t.innerHTML = '';
  const s = document.createElement('span');
  s.textContent = msg;
  t.append(s);
  if (action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = action.label;
    b.addEventListener('click', () => { t.classList.remove('is-on'); action.run(); });
    t.append(b);
  }
  t.classList.add('is-on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('is-on'), 3800);
}

/* ---------- Картинка товара летит в кнопку заявки ---------- */
export function flyToCart(srcImg) {
  const btn = $('.cart-btn');
  if (!btn) return;
  const bump = () => { btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump'); };
  const g = G();
  if (!srcImg || !g || reduced) return bump();
  const a = srcImg.getBoundingClientRect();
  const b = btn.getBoundingClientRect();
  if (!a.width || a.bottom < 0 || a.top > innerHeight) return bump();
  const fly = document.createElement('div');
  fly.className = 'fly';
  fly.innerHTML = `<img src="${srcImg.currentSrc || srcImg.src}" alt="">`;
  Object.assign(fly.style, { left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px' });
  document.body.append(fly);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const tl = g.timeline({ onComplete: () => { fly.remove(); bump(); } });
  tl.to(fly, { x: dx * .35, y: dy * .35 - 60, scale: .55, duration: .38, ease: 'power2.out' })
    .to(fly, { x: dx, y: dy, scale: .08, borderRadius: '50%', opacity: .6, duration: .5, ease: 'power3.in' });
}

export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
