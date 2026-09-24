// Генеративные «срезы» итальянского стекла для страницы «О Светлане»: Simalto, Aventurine, Millefiori.
// Рисуются, только пока видны; при reduced motion — один статичный кадр.
import { $$, reduced } from './ui.js';

const TAU = Math.PI * 2;

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

const painters = {
  // Эмалевая бусина: концентрические пояса точечной росписи
  simalto(ctx, w, h, t, st) {
    const cx = w / 2, cy = h / 2, R = w / 2;
    const bg = ctx.createRadialGradient(cx * .8, cy * .7, R * .1, cx, cy, R);
    bg.addColorStop(0, '#5fb7b4'); bg.addColorStop(.55, '#23706f'); bg.addColorStop(1, '#0d3334');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    const rings = [[.18, 6, '#f6efe2', .045], [.34, 12, '#e6a07f', .04], [.5, 18, '#f6efe2', .035], [.66, 24, '#d9b779', .032], [.82, 30, '#f6efe2', .028]];
    rings.forEach(([rr, n, col, size], k) => {
      const rot = t * (k % 2 ? -.00006 : .00008) * (1 + k * .15);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rot;
        const x = cx + Math.cos(a) * R * rr, y = cy + Math.sin(a) * R * rr;
        const s = R * size * (1 + .12 * Math.sin(t * .002 + i + k));
        // «цветок» из пяти эмалевых капель
        ctx.fillStyle = col;
        for (let j = 0; j < 5; j++) {
          const b = a + (j / 5) * TAU;
          ctx.beginPath(); ctx.arc(x + Math.cos(b) * s * .9, y + Math.sin(b) * s * .9, s * .55, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = k % 2 ? '#8a2f22' : '#d9b779';
        ctx.beginPath(); ctx.arc(x, y, s * .45, 0, TAU); ctx.fill();
      }
    });
    // бегущий блик глазури
    const hx = cx + Math.cos(t * .0005) * R * .35, hy = cy * .55 + Math.sin(t * .0007) * R * .1;
    const hl = ctx.createRadialGradient(hx, hy, 0, hx, hy, R * .55);
    hl.addColorStop(0, 'rgba(255,255,255,.35)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl; ctx.fillRect(0, 0, w, h);
  },

  // Авантюрин: тёмное медовое стекло с мерцающими медными искрами
  aventurine(ctx, w, h, t, st) {
    if (!st.sparks) {
      const r = rng(7);
      st.sparks = Array.from({ length: 900 }, () => ({ x: r(), y: r(), z: .35 + r() * .65, p: r() * TAU, s: 1 + r() * 2.8, v: .00015 + r() * .0004 }));
    }
    const cx = w / 2, cy = h / 2, R = w / 2;
    const bg = ctx.createRadialGradient(cx * .85, cy * .75, R * .05, cx, cy, R);
    bg.addColorStop(0, '#9a4a1c'); bg.addColorStop(.5, '#5a2410'); bg.addColorStop(1, '#1f0a03');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    const k = w / 400;
    for (const p of st.sparks) {
      const y = ((p.y + t * p.v * .05) % 1) * h;
      const x = p.x * w + Math.sin(t * .0004 + p.p) * 6 * p.z;
      const tw = Math.max(0, Math.sin(t * .003 * p.z + p.p));
      const a = .35 + tw * tw * .65;
      ctx.fillStyle = `rgba(${240 + 15 * tw | 0},${180 + 50 * tw | 0},${90 + 60 * tw | 0},${a * p.z})`;
      ctx.save(); ctx.translate(x, y); ctx.rotate(p.p);
      ctx.fillRect(-p.s * k, -p.s * k * .35, p.s * 2 * k, p.s * .7 * k);
      ctx.restore();
      if (tw > .97) {
        ctx.strokeStyle = `rgba(255,236,190,${(tw - .97) * 20})`; ctx.lineWidth = k;
        ctx.beginPath(); ctx.moveTo(x - 6 * k, y); ctx.lineTo(x + 6 * k, y); ctx.moveTo(x, y - 6 * k); ctx.lineTo(x, y + 6 * k); ctx.stroke();
      }
    }
  },

  // Миллефиори: срезы стеклянных «тростинок» — концентрические цветы
  millefiori(ctx, w, h, t, st) {
    if (!st.canes) {
      const r = rng(11);
      const pal = [['#f3e6cf', '#c0392b', '#1f4e79'], ['#f6c945', '#2e7d6b', '#f3e6cf'], ['#e7a6b6', '#f3e6cf', '#6b2f5f'], ['#9fd6d2', '#1f4e79', '#f6c945'], ['#f08a4b', '#f3e6cf', '#2e7d6b']];
      st.canes = [];
      const step = w / 5.2;
      for (let row = -1; row < 7; row++) for (let col = -1; col < 7; col++) {
        st.canes.push({ x: col * step + (row % 2 ? step / 2 : 0), y: row * step * .87, r: step * (.46 + r() * .06), c: pal[(row * 3 + col * 2 + 20) % pal.length], petals: 6 + ((row + col + 10) % 4) * 2, rot: r() * TAU });
      }
    }
    ctx.fillStyle = '#20304a'; ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2); ctx.rotate(t * .00004); ctx.scale(1 + .03 * Math.sin(t * .0006), 1 + .03 * Math.sin(t * .0006)); ctx.translate(-w / 2, -h / 2);
    for (const c of st.canes) {
      const [a, b, d] = c.c;
      ctx.fillStyle = d; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, TAU); ctx.fill();
      ctx.fillStyle = a;
      for (let i = 0; i < c.petals; i++) {
        const ang = c.rot + (i / c.petals) * TAU + t * .00015;
        ctx.beginPath();
        ctx.ellipse(c.x + Math.cos(ang) * c.r * .55, c.y + Math.sin(ang) * c.r * .55, c.r * .32, c.r * .16, ang, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = b; ctx.beginPath(); ctx.arc(c.x, c.y, c.r * .3, 0, TAU); ctx.fill();
      ctx.fillStyle = a; ctx.beginPath(); ctx.arc(c.x, c.y, c.r * .12, 0, TAU); ctx.fill();
    }
    ctx.restore();
  },
};

export function initMaterials() {
  const items = $$('canvas[data-mat]').map((cv) => ({ cv, ctx: cv.getContext('2d'), paint: painters[cv.dataset.mat], st: {}, on: false, w: 0, h: 0 }));
  if (!items.length) return;
  const size = (it) => {
    const r = it.cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
    it.w = Math.round(r.width * d); it.h = Math.round(r.height * d);
    it.cv.width = it.w; it.cv.height = it.h; it.st = {};
  };
  items.forEach(size);
  addEventListener('resize', () => items.forEach((it) => { size(it); if (reduced) it.paint(it.ctx, it.w, it.h, 1200, it.st); }));
  if (reduced) { items.forEach((it) => it.paint(it.ctx, it.w, it.h, 1200, it.st)); return; }

  const io = new IntersectionObserver((en) => en.forEach((e) => { const it = items.find((x) => x.cv === e.target); it.on = e.isIntersecting; }), { rootMargin: '100px' });
  items.forEach((it) => { io.observe(it.cv); it.paint(it.ctx, it.w, it.h, 0, it.st); });
  const loop = (t) => {
    for (const it of items) if (it.on && !document.hidden) it.paint(it.ctx, it.w, it.h, t, it.st);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
