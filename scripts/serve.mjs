import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT || 8765);
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.md': 'text/markdown' };

http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://localhost:${port}`);
  const pathname = decodeURIComponent(requestUrl.pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404).end('Not found');
    return;
  }
  const contentType = requestUrl.searchParams.has('source') ? 'text/plain' : types[path.extname(file)] || 'application/octet-stream';
  response.setHeader('Content-Type', `${contentType}; charset=utf-8`);
  fs.createReadStream(file).pipe(response);
}).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}`));
