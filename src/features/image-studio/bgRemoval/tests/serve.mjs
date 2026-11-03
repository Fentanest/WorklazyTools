import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd(), host = path.join(root, 'scratch/ie-bg/harness-dist');
http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  if (pathname.includes('..')) { res.writeHead(403).end(); return; }
  const file = pathname.startsWith('/vendor/') ? path.join(root, 'public', pathname) : path.join(host, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
  const ext = path.extname(file), mime = { '.html': 'text/html', '.js': 'application/javascript', '.wasm': 'application/wasm', '.onnx': 'application/octet-stream' }[ext] ?? 'application/octet-stream';
  const size = fs.statSync(file).size;
  res.writeHead(200, { 'Content-Type': mime, 'Content-Length': size, 'Cache-Control': pathname.startsWith('/assets/') ? 'public,max-age=31536000,immutable' : 'no-store' });
  const stream = fs.createReadStream(file); stream.pipe(res); res.on('close', () => stream.destroy());
}).listen(4192, '127.0.0.1', () => console.log('IE-BG harness http://127.0.0.1:4192 (SW uncontrolled, no cross-origin isolation)'));
