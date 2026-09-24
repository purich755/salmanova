// Готовит ассеты сайта из raw/: WebP каталога, фото страниц, маску логотипа, data/catalog.json.
//   node tools/build-assets.mjs [--force]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const force = process.argv.includes('--force');
const cat = JSON.parse(fs.readFileSync('raw/catalog.full.json', 'utf8'));
fs.mkdirSync('assets/p', { recursive: true });
fs.mkdirSync('assets/img', { recursive: true });
fs.mkdirSync('data', { recursive: true });

const fresh = (out) => force || !fs.existsSync(out);
const hex = ({ r, g, b }) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/* ---------- Каталог ---------- */
const meta = {};
const jobs = [];
for (const p of cat.products) {
  p.gallery.forEach((u, i) => {
    const src = `raw/photos/${p.id}-${i}${path.extname(u).toLowerCase() || '.jpg'}`;
    jobs.push({ p, i, src });
  });
}
let n = 0;
async function work({ p, i, src }) {
  const base = `assets/p/${p.id}-${i}`;
  const img = sharp(src, { failOn: 'none' }).rotate();
  const m = await img.metadata();
  const w0 = m.autoOrient?.width || m.width, h0 = m.autoOrient?.height || m.height;
  // Фон почти у всех кадров — ворсистый фетр: его шум съедает половину веса WebP.
  // Медиана 3×3 гасит ворс и не размывает края украшений.
  if (fresh(`${base}-s.webp`)) await img.clone().resize({ width: Math.min(520, w0) }).median(3).webp({ quality: 64, effort: 5, smartSubsample: true }).toFile(`${base}-s.webp`);
  if (fresh(`${base}-l.webp`)) await img.clone().resize({ width: Math.min(1100, w0) }).median(3).webp({ quality: 68, effort: 5, smartSubsample: true }).toFile(`${base}-l.webp`);
  if (i === 0) {
    const st = await sharp(src, { failOn: 'none' }).rotate().resize(24, 24, { fit: 'cover' }).stats();
    meta[p.id] = { c: hex(st.dominant), r: +(h0 / w0).toFixed(3) };
  }
  if (++n % 100 === 0) console.log('  …', n, '/', jobs.length);
}
const q = jobs.slice();
await Promise.all(Array.from({ length: 4 }, async () => { while (q.length) await work(q.shift()); }));

// Компактный каталог для фронтенда: короткие ключи, без URL оригиналов
const out = {
  // пустые разделы магазина (например, «Аквамарин» без товаров) не показываем
  parts: cat.parts.map((x) => ({ id: x.id, t: x.title, n: cat.products.filter((p) => p.parts.includes(x.id)).length })).filter((x) => x.n),
  types: cat.types.map((t) => ({ id: t.id, t: t.label, n: t.n })),
  products: cat.products.map((p) => ({
    id: p.id, t: p.title, ty: p.type, d: p.text, p: p.price,
    ...(p.priceOld ? { o: p.priceOld } : {}),
    ...(p.mark ? { m: p.mark } : {}),
    ...(p.qty !== null ? { q: p.qty } : {}),
    c: p.parts, g: p.gallery.length, bg: meta[p.id].c, r: meta[p.id].r,
  })),
};
fs.writeFileSync('data/catalog.json', JSON.stringify(out));
console.log('✓ data/catalog.json', (fs.statSync('data/catalog.json').size / 1024).toFixed(0), 'KB');

/* ---------- Фото страниц ---------- */
const SITE = [
  ['hero1', [720, 1200]], ['hero2', [720, 1200]], ['hero3', [720, 1200]],
  ['about', [720, 1200]], ['info', [960, 1920]],
];
for (const [name, widths] of SITE) {
  for (const w of widths) {
    const o = `assets/img/${name}-${w}.webp`;
    if (fresh(o)) await sharp(`raw/site/${name}.jpeg`).rotate().resize({ width: w }).webp({ quality: 74, effort: 6 }).toFile(o);
  }
}

/* Логотип: белый фон → альфа. Используется как CSS-маска, цвет задаётся currentColor. */
{
  const { data, info } = await sharp('raw/site/logo.jpeg').greyscale().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let k = 0; k < info.width * info.height; k++) {
    // мягкий порог: сохраняем сглаживание росчерков
    const a = Math.max(0, Math.min(255, Math.round((235 - data[k]) * 255 / 205)));
    rgba[k * 4] = rgba[k * 4 + 1] = rgba[k * 4 + 2] = 0;
    rgba[k * 4 + 3] = a;
  }
  const full = sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } });
  const trimmed = await full.png().toBuffer().then((b) => sharp(b).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true }));
  await sharp(trimmed.data).resize({ width: 640 }).png({ compressionLevel: 9 }).toFile('assets/img/logo.png');
  const lm = await sharp('assets/img/logo.png').metadata();
  console.log('✓ logo.png', lm.width, 'x', lm.height);

  // Только росчерк «Salmanova» без подписи — для favicon и крупного знака в подвале
  const wordH = Math.round(trimmed.info.height * 0.77);
  await sharp(trimmed.data).extract({ left: 0, top: 0, width: trimmed.info.width, height: wordH }).trim({ threshold: 1 })
    .resize({ width: 1200 }).png({ compressionLevel: 9 }).toFile('assets/img/logo-word.png');
}

/* Favicon: буква S из логотипа на цвете бумаги */
{
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1b1714"/><text x="32" y="46" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="42" fill="#d9b779">S</text></svg>`;
  fs.writeFileSync('assets/img/favicon.svg', svg);
  await sharp(Buffer.from(svg)).resize(180, 180).png().toFile('assets/img/apple-touch-icon.png');
  await sharp(Buffer.from(svg)).resize(32, 32).png().toFile('assets/img/favicon-32.png');
}

/* OG-картинка 1200×630: фото + логотип */
{
  const photo = await sharp('raw/site/hero2.jpeg').rotate().resize(520, 630, { fit: 'cover', position: 'top' }).toBuffer();
  const logo = await sharp('assets/img/logo.png').resize({ width: 520 }).toBuffer();
  const lm = await sharp(logo).metadata();
  const txt = Buffer.from(`<svg width="680" height="630" xmlns="http://www.w3.org/2000/svg"><text x="340" y="540" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="#4a433c">Муранское стекло · натуральные камни</text></svg>`);
  await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#f4efe8' } })
    .composite([{ input: photo, left: 680, top: 0 }, { input: logo, left: 80, top: Math.round((630 - lm.height) / 2) - 30 }, { input: txt, left: 0, top: 0 }])
    .jpeg({ quality: 84, mozjpeg: true }).toFile('assets/img/og.jpg');
}

const size = (dir) => fs.readdirSync(dir).reduce((s, f) => s + fs.statSync(path.join(dir, f)).size, 0);
console.log('assets/p', (size('assets/p') / 1048576).toFixed(1), 'MB,', fs.readdirSync('assets/p').length, 'файлов');
console.log('assets/img', (size('assets/img') / 1048576).toFixed(1), 'MB');
