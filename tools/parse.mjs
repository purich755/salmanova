// Разбор выгрузки Tilda Store (raw/products*.json) в компактный каталог.
//   node tools/parse.mjs  → raw/catalog.full.json (с URL оригиналов фото)
import fs from 'node:fs';

const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const a = read('raw/products.json');
const b = read('raw/products2.json');
const all = [...a.products, ...b.products];

const clean = (html) =>
  String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&laquo;/g, '«').replace(/&raquo;/g, '»')
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();

// Коллекции в порядке сортировки магазина
const parts = a.parts
  .slice()
  .sort((x, y) => x.sort - y.sort)
  .map((p) => ({ id: String(p.uid), title: p.title.trim() }));
const partIds = new Set(parts.map((p) => p.id));

// Тип изделия выводим из названия товара — как оно записано у магазина
const TYPES = [
  ['kole', /^(колье|многонитное колье|колье-галстук)/i, 'Колье'],
  ['choker', /^чокер/i, 'Чокеры'],
  ['busy', /^бусы/i, 'Бусы'],
  ['podveska', /^подвеска/i, 'Подвески'],
  ['sergi', /^серьг/i, 'Серьги'],
  ['braslet', /^браслет/i, 'Браслеты'],
  ['kolco', /^кольцо/i, 'Кольца'],
  ['brosh', /^брошь/i, 'Броши'],
  ['komplekt', /^(комплект|набор)/i, 'Комплекты'],
];
const typeOf = (title) => (TYPES.find(([, re]) => re.test(title)) || ['other'])[0];

const products = all
  .slice()
  .sort((x, y) => x.sort - y.sort)
  .map((p) => {
    const gallery = JSON.parse(p.gallery || '[]').map((g) => g.img).filter(Boolean);
    const text = clean(p.text);
    const descr = clean(p.descr);
    const qty = p.quantity === '' ? null : Number(p.quantity);
    const priceOld = p.priceold ? Number(String(p.priceold).replace(',', '.')) : null;
    // у магазина описание лежит то в «text», то в «descr»; берём оба, без повторов
    let body = [text, descr].filter((t, i, arr) => t && arr.indexOf(t) === i).join('\n');
    let price = Math.round(Number(p.price));
    // у пары товаров цена поля пустая, а сумма вписана строкой в описание — переносим её в цену
    if (!price) {
      const m = body.match(/(?:^|\n)\s*(\d[\d\s]*)\s*₽\s*$/);
      if (m) { price = Number(m[1].replace(/\s/g, '')); body = body.slice(0, m.index).trim(); }
    }
    return {
      id: String(p.uid),
      title: p.title.trim(),
      type: typeOf(p.title.trim()),
      text: body,
      price,
      priceOld: priceOld ? Math.round(priceOld) : null,
      mark: p.mark || '',
      qty,
      parts: JSON.parse(p.partuids || '[]').map(String).filter((u) => partIds.has(u)),
      gallery,
      url: p.url,
      sort: p.sort,
    };
  });

const types = TYPES.map(([id, , label]) => ({ id, label, n: products.filter((p) => p.type === id).length })).filter((t) => t.n);
const other = products.filter((p) => p.type === 'other');
if (other.length) console.warn('Без типа:', other.map((p) => p.title));

fs.writeFileSync('raw/catalog.full.json', JSON.stringify({ parts, types, products }, null, 1));
console.log('товаров', products.length, 'коллекций', parts.length, 'фото', products.reduce((s, p) => s + p.gallery.length, 0));
console.log(types.map((t) => `${t.label} ${t.n}`).join(', '));
console.log('нет в наличии', products.filter((p) => p.qty === 0).length, '· со скидкой', products.filter((p) => p.priceOld).length);
const prices = products.map((p) => p.price);
console.log('цены', Math.min(...prices), '…', Math.max(...prices));
