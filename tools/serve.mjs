// Статический сервер для разработки и самопроверки: чистые URL (/about → about.html), gzip, 404.
//   node tools/serve.mjs [port] [base]   — base, например /salmanova, чтобы проверить сборку под GitHub Pages
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.argv[2] || 8517);
const BASE = (process.argv[3] || '').replace(/\/$/, '');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};
const BLOCK = /^\/(raw|tools|node_modules|src)(\/|$)/;

function resolve(p) {
  if (BLOCK.test(p)) return null;
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) return null;
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  if (!path.extname(p) && fs.existsSync(file + '.html')) return file + '.html';
  return null;
}

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (BASE) p = p === BASE ? '/' : p.startsWith(BASE + '/') ? p.slice(BASE.length) : '/__nope__';
  let file = resolve(p), status = 200;
  if (!file) { file = path.join(ROOT, '404.html'); status = 404; }
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const gz = /text|javascript|json|svg|xml/.test(type) && /gzip/.test(req.headers['accept-encoding'] || '');
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-cache', ...(gz ? { 'Content-Encoding': 'gzip' } : {}) });
  const s = fs.createReadStream(file);
  gz ? s.pipe(zlib.createGzip()).pipe(res) : s.pipe(res);
}).listen(PORT, () => console.log(`http://localhost:${PORT}/`));
