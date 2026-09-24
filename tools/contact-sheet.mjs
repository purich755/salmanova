// Контактный лист из raw/photos: сетка 6 колонок с подписанными id.
//   node tools/contact-sheet.mjs [srcDir] [outPrefix]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SRC = process.argv[2] || 'raw/photos';
const OUTP = process.argv[3] || 'raw/sheet';
const COLS = +(process.env.COLS||6), CELL = +(process.env.CELL||300), LABEL = 26, PER = 24;

const files = fs.readdirSync(SRC).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f)).sort();
const label = async (t) => sharp({ create: { width: CELL, height: LABEL, channels: 3, background: '#111' } })
  .composite([{ input: Buffer.from(`<svg width="${CELL}" height="${LABEL}"><text x="6" y="19" font-family="monospace" font-size="17" fill="#ffcc55">${t}</text></svg>`), top: 0, left: 0 }])
  .png().toBuffer();

let sheet = 0;
for (let i = 0; i < files.length; i += PER) {
  const chunk = files.slice(i, i + PER);
  const rows = Math.ceil(chunk.length / COLS);
  const comp = [];
  for (let k = 0; k < chunk.length; k++) {
    const f = chunk[k];
    const x = (k % COLS) * CELL, y = Math.floor(k / COLS) * (CELL + LABEL);
    const buf = await sharp(path.join(SRC, f)).rotate().resize(CELL, CELL, { fit: 'cover' }).toBuffer();
    comp.push({ input: buf, top: y + LABEL, left: x });
    comp.push({ input: await label(path.basename(f, path.extname(f))), top: y, left: x });
  }
  const out = `${OUTP}-${++sheet}.jpg`;
  await sharp({ create: { width: COLS * CELL, height: rows * (CELL + LABEL), channels: 3, background: '#000' } })
    .composite(comp).jpeg({ quality: 76 }).toFile(out);
  console.log('✓', out);
}
