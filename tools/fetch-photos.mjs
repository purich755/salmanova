// Скачивает оригиналы фото каталога и страниц в raw/photos и raw/site.
//   node tools/fetch-photos.mjs
import fs from 'node:fs';
import path from 'node:path';

const cat = JSON.parse(fs.readFileSync('raw/catalog.full.json', 'utf8'));
const SITE = {
  logo: 'https://static.tildacdn.com/tild3832-6236-4662-b237-323165323039/E7F4A3AD-8227-499C-8.jpeg',
  og: 'https://static.tildacdn.com/tild6135-3837-4261-a134-306661333830/245AA4CC-9776-4D6D-A.jpeg',
  hero1: 'https://static.tildacdn.com/tild6435-3165-4139-a634-303234613332/IMG_4426.jpeg',
  hero2: 'https://static.tildacdn.com/tild6438-3566-4437-a461-643266313333/IMG_4452.jpeg',
  hero3: 'https://static.tildacdn.com/tild3561-3265-4061-b136-653438663539/IMG_4460.jpeg',
  about: 'https://static.tildacdn.com/tild3432-6633-4832-b137-393639303930/IMG_4487.jpeg',
};

const jobs = [];
for (const [k, u] of Object.entries(SITE)) jobs.push([u, `raw/site/${k}${path.extname(u)}`]);
for (const p of cat.products) p.gallery.forEach((u, i) => jobs.push([u, `raw/photos/${p.id}-${i}${path.extname(u).toLowerCase() || '.jpg'}`]));

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
let done = 0, skip = 0;
const failed = [];
async function get([u, out]) {
  if (fs.existsSync(out) && fs.statSync(out).size > 1000) { skip++; return; }
  for (let t = 0; t < 4; t++) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': UA, Referer: 'https://salmanova.ru/' } });
      if (!r.ok) throw new Error(r.status);
      fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
      done++;
      return;
    } catch (e) {
      await new Promise((r) => setTimeout(r, 800 * (t + 1)));
      if (t === 3) failed.push(`${u} (${e.message})`);
    }
  }
}
const queue = jobs.slice();
await Promise.all(Array.from({ length: 8 }, async () => { while (queue.length) await get(queue.shift()); }));
console.log(`скачано ${done}, уже было ${skip}, ошибок ${failed.length} из ${jobs.length}`);
if (failed.length) console.log(failed.join('\n'));
