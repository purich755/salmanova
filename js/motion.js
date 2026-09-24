// Движение: Lenis, шапка, якоря, прелоадер, интро первого экрана, появления, параллакс, бегущая строка.
import { $, $$, reduced, lockScroll } from './ui.js';

const fmt = (n, money) => (money ? String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : String(Math.round(n)));

export function initMotion(page) {
  const g = window.gsap, ST = window.ScrollTrigger, Split = window.SplitText, L = window.Lenis;
  const ok = !!(g && ST && Split) && !reduced;
  if (ok) { g.registerPlugin(ST, Split); document.body.classList.add('motion'); }

  /* ---------- Плавная прокрутка ---------- */
  let lenis = null;
  if (ok && L) {
    lenis = new L({ lerp: 0.11, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1.4 });
    window.__lenis = lenis;
    lenis.on('scroll', ST.update);
    g.ticker.add((t) => lenis.raf(t * 1000));
    g.ticker.lagSmoothing(0);
  }

  const hdr = $('[data-hdr]');
  function scrollTo(target, { immediate = false } = {}) {
    const el = typeof target === 'string' ? (target === '#top' || target === '#' ? document.body : $(target)) : target;
    if (!el) return;
    const pad = el === document.body ? 0 : parseFloat(getComputedStyle(el).paddingTop) || 0;
    const offset = -Math.max(0, (hdr?.offsetHeight || 0) - pad + 12);
    if (lenis) lenis.scrollTo(el === document.body ? 0 : el, { offset, immediate, duration: 1.5, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else {
      const y = el === document.body ? 0 : el.getBoundingClientRect().top + scrollY + offset;
      scrollTo.native(y, immediate);
    }
  }
  scrollTo.native = (y, immediate) => window.scrollTo({ top: y, behavior: immediate || reduced ? 'auto' : 'smooth' });
  window.__scrollTo = scrollTo;

  /* ---------- Меню ---------- */
  const menu = $('#menu'), burger = $('[data-menu-toggle]');
  function setMenu(open) {
    if (!menu || open === !menu.hidden) return;
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    document.body.classList.toggle('menu-open', open);
    lockScroll(open);
    hdr.classList.remove('is-hidden');
    if (open) {
      menu.hidden = false;
      if (ok) {
        g.fromTo(menu, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: .7, ease: 'expo.inOut' });
        g.fromTo($$('.menu-nav a, .menu-foot > *', menu), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: .8, stagger: .05, delay: .25, ease: 'expo.out' });
      }
    } else if (ok) {
      g.to(menu, { clipPath: 'inset(0 0 100% 0)', duration: .5, ease: 'expo.inOut', onComplete: () => { menu.hidden = true; g.set(menu, { clearProps: 'clipPath' }); } });
    } else menu.hidden = true;
  }
  burger?.addEventListener('click', () => setMenu(menu.hidden));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu && !menu.hidden) { setMenu(false); burger.focus(); } });
  matchMedia('(min-width: 981px)').addEventListener('change', (m) => { if (m.matches) setMenu(false); });

  /* ---------- Якоря (#catalog, /#delivery …) ---------- */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href*="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
    const url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname || !url.hash || url.hash.startsWith('#p-')) return;
    const target = url.hash === '#top' ? document.body : $(url.hash);
    if (!target) return;
    e.preventDefault();
    const wasMenu = menu && !menu.hidden;
    if (wasMenu) setMenu(false);
    setTimeout(() => scrollTo(target), wasMenu ? 420 : 0);
  });
  $$('[data-top]').forEach((b) => b.addEventListener('click', () => scrollTo(document.body)));

  /* ---------- Шапка: прячется при прокрутке вниз, возвращается при прокрутке вверх ---------- */
  let lastY = 0;
  const onScroll = (y) => {
    hdr.classList.toggle('is-solid', y > 24);
    if (document.body.classList.contains('menu-open') || document.body.classList.contains('is-locked')) return;
    const dy = y - lastY;
    if (y > 240 && dy > 6) hdr.classList.add('is-hidden');
    else if (dy < -6 || y < 240) hdr.classList.remove('is-hidden');
    lastY = y;
  };
  if (lenis) lenis.on('scroll', ({ scroll }) => onScroll(scroll));
  else addEventListener('scroll', () => onScroll(scrollY), { passive: true });
  onScroll(scrollY);
  hdr.addEventListener('focusin', () => hdr.classList.remove('is-hidden'));

  // подсветка текущего раздела в меню (главная)
  if (ok) {
    for (const id of ['catalog', 'delivery', 'address']) {
      const sec = document.getElementById(id), link = $(`.nav [data-nav="${id}"]`);
      if (!sec || !link) continue;
      ST.create({ trigger: sec, start: 'top 45%', end: 'bottom 45%', onToggle: (s) => link.classList.toggle('is-current', s.isActive) });
    }
  }

  /* ---------- Счётчики ---------- */
  const countUp = (el, delay = 0) => {
    const to = +el.dataset.countTo, money = el.dataset.format === 'money';
    const o = { v: 0 };
    el.textContent = fmt(0, money);
    g.to(o, { v: to, duration: to > 100 ? 2 : 1.6, delay, ease: 'power3.out', onUpdate: () => (el.textContent = fmt(o.v, money)) });
  };

  if (!ok) {
    $('#pre')?.classList.add('is-skip');
    return { scrollTo, lenis };
  }

  /* ---------- Интро первого экрана ---------- */
  const intro = g.timeline({ paused: true, defaults: { ease: 'expo.out' } });
  const title = $('.hero-title');
  let chars = null;
  if (title) {
    chars = Split.create($$('.ht-line', title), { type: 'chars', charsClass: 'ch', aria: 'none' });
    g.set(chars.chars, { yPercent: 118 });
    intro.to(chars.chars, { yPercent: 0, duration: 1.4, stagger: .032, onComplete: () => chars.revert() }, .3);
  }
  const arch = $('[data-hero-arch]');
  if (arch) {
    intro.fromTo(arch, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.6, ease: 'expo.inOut', clearProps: 'clipPath' }, 0)
      .fromTo($('img', arch), { scale: 1.35 }, { scale: 1, duration: 2.4 }, .2);
  }
  if ($$('[data-hero-frame]').length) intro.from('[data-hero-frame]', { opacity: 0, y: 70, rotate: (i) => (i ? 4 : -4), duration: 1.5, stagger: .16 }, .75);
  if ($$('[data-bead]').length) intro.from('[data-bead]', { scale: 0, duration: 1.3, stagger: .12, ease: 'back.out(2)' }, 1.15);
  if ($$('[data-hero-fade]').length) intro.to('[data-hero-fade]', { opacity: 1, y: 0, duration: 1.1, stagger: .09, onStart() { $$('[data-hero-fade]').forEach((e) => e.classList.add('is-in')); } }, .75);
  const heroSplit = $('[data-hero-split]');
  if (heroSplit) {
    const s = Split.create(heroSplit, { type: 'words,lines', linesClass: 'split-line' });
    g.set(heroSplit, { visibility: 'visible' });
    intro.from(s.words, { yPercent: 115, duration: 1.3, stagger: .04, onComplete: () => s.revert() }, .2);
  }
  $$('.hero [data-count-to]').forEach((el) => intro.add(() => countUp(el), 1.1));
  const cover = $('[data-cover] img');
  if (cover) intro.fromTo(cover, { scale: 1.25 }, { scale: 1.08, duration: 2.6 }, 0);

  const pre = $('#pre');
  if (pre && !sessionStorage.getItem('salmanova-pre')) {
    try { sessionStorage.setItem('salmanova-pre', '1'); } catch { /* приватный режим */ }
    pre.style.animation = 'none';
    lenis?.stop();
    g.timeline({ onComplete: () => { pre.remove(); lenis?.start(); } })
      .to('.pre-mark', { clipPath: 'inset(0 0% 0 0)', duration: 1.25, ease: 'power2.inOut' }, .1)
      .to(pre, { '--p': 1, duration: 1.35, ease: 'power2.inOut' }, 0)
      .to(pre, { yPercent: -100, duration: 1, ease: 'expo.inOut' }, '+=.1')
      .add(() => intro.play(), '-=.6');
  } else {
    pre?.remove();
    intro.play();
  }

  /* ---------- Заголовки секций: слова выезжают из-под строки ---------- */
  for (const h of $$('[data-split]')) {
    const s = Split.create(h, { type: 'words,lines', linesClass: 'split-line' });
    g.set(h, { visibility: 'visible' });
    g.set(s.words, { yPercent: 115 });
    ST.create({
      trigger: h, start: 'top 88%', once: true,
      onEnter: () => g.to(s.words, { yPercent: 0, duration: 1.25, stagger: .05, ease: 'expo.out', onComplete: () => s.revert() }),
    });
  }

  /* ---------- Появления блоков ---------- */
  ST.batch('[data-reveal]', {
    start: 'top 90%', once: true,
    onEnter: (els) => {
      els.forEach((e) => e.classList.add('is-in'));
      g.to(els, { opacity: 1, y: 0, duration: 1.15, ease: 'expo.out', stagger: .09, overwrite: true });
    },
  });
  $$('.sec-head .eyebrow, .a-split-head .eyebrow').forEach((e) => ST.create({ trigger: e, start: 'top 90%', once: true, onEnter: () => e.classList.add('is-in') }));

  // счётчики вне первого экрана
  $$('[data-count-to]').filter((el) => !el.closest('.hero')).forEach((el) =>
    ST.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => countUp(el) }));

  /* ---------- Параллакс ---------- */
  const hero = $('.hero');
  if (hero) {
    $$('[data-speed]', hero).forEach((el) => g.to(el, { yPercent: +el.dataset.speed * 100, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } }));
    g.to('.arch--hero img', { scale: 1.14, yPercent: 6, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    g.to('.hero-copy', { y: -70, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
  }
  $$('[data-parallax-img]').forEach((f) => g.fromTo($('img', f), { yPercent: -7 }, { yPercent: 7, ease: 'none', scrollTrigger: { trigger: f, start: 'top bottom', end: 'bottom top', scrub: true } }));
  if (cover) g.to(cover, { yPercent: 12, ease: 'none', scrollTrigger: { trigger: '.i-cover', start: 'top top', end: 'bottom top', scrub: true } });
  $$('.arch--about img').forEach((im) => g.to(im, { yPercent: 8, scale: 1.08, ease: 'none', scrollTrigger: { trigger: im.parentElement, start: 'top top', end: 'bottom top', scrub: true } }));

  // световые пятна за курсором
  const glow = $('.hero-glow');
  if (glow && matchMedia('(pointer: fine)').matches) {
    const xs = g.quickTo(glow, 'x', { duration: 1.6, ease: 'power3' }), ys = g.quickTo(glow, 'y', { duration: 1.6, ease: 'power3' });
    addEventListener('pointermove', (e) => { xs((e.clientX / innerWidth - .5) * 50); ys((e.clientY / innerHeight - .5) * 40); }, { passive: true });
  }

  /* ---------- Бегущая строка коллекций: ускоряется от прокрутки и меняет направление ---------- */
  const track = $('[data-marquee]');
  if (track) {
    const tw = g.to(track, { xPercent: -50, ease: 'none', duration: 70, repeat: -1 });
    tw.totalTime(tw.duration() * 400); // запас назад, чтобы можно было крутить в обратную сторону
    let back;
    ST.create({
      start: 0, end: 'max',
      onUpdate: (s) => {
        const v = Math.abs(s.getVelocity());
        tw.timeScale(s.direction * Math.min(1 + v / 260, 10));
        clearTimeout(back);
        back = setTimeout(() => g.to(tw, { timeScale: s.direction, duration: 1.4, ease: 'power2.out' }), 90);
      },
    });
    ST.create({ trigger: '.marquee', start: 'top bottom', end: 'bottom top', onToggle: (s) => (s.isActive ? tw.resume() : tw.pause()) });
  }

  /* ---------- Доставка: линия бесплатной доставки заполняется по прокрутке ---------- */
  const fl = $('[data-free-line]');
  if (fl) g.fromTo(fl, { '--fl': 0 }, { '--fl': 1, ease: 'none', scrollTrigger: { trigger: '[data-free]', start: 'top 85%', end: 'bottom 55%', scrub: .6 } });

  /* ---------- Текст «проявляется» словами по мере чтения ---------- */
  for (const p of $$('[data-words]')) {
    const s = Split.create(p, { type: 'words', wordsClass: 'w' });
    const n = s.words.length;
    ST.create({
      trigger: p, start: 'top 82%', end: 'bottom 50%', scrub: true,
      onUpdate: (st) => { const k = Math.round(st.progress * n); s.words.forEach((w, i) => w.classList.toggle('is-lit', i < k)); },
    });
  }

  /* ---------- Подвал: росчерк логотипа «пишется» слева направо ---------- */
  const mark = $('.ftr-mark');
  if (mark) g.fromTo(mark, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: { trigger: '.ftr', start: 'top 92%', end: 'top 25%', scrub: .8 } });

  /* ---------- Инфо: активный раздел в оглавлении ---------- */
  for (const it of $$('.i-item')) {
    const link = $(`.i-toc a[href="#${it.id}"]`);
    ST.create({ trigger: it, start: 'top 55%', end: 'bottom 55%', onToggle: (s) => link?.classList.toggle('is-current', s.isActive) });
  }

  // пересчитать триггеры после загрузки шрифтов и картинок
  document.fonts?.ready.then(() => ST.refresh());
  addEventListener('load', () => ST.refresh());
  return { scrollTo, lenis };
}
