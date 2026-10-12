import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { snapshot } from './git.js';
const assets = new Map([['/', ['index.html', 'text/html']], ['/app.js', ['app.js', 'text/javascript']], ['/style.css', ['style.css', 'text/css']], ['/demo.json', ['demo.json', 'application/json']], ['/favicon.svg', ['favicon.svg', 'image/svg+xml']]]);
export function createServer({ cwd = process.cwd() } = {}) {
  let pending = null;
  return http.createServer(async (req, res) => {
    const address = `127.0.0.1:${req.socket.localPort}`;
    const headers = { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" };
    const send = (status, body, type = 'application/json') => { res.writeHead(status, { ...headers, 'Content-Type': `${type}; charset=utf-8` }); res.end(body); };
    if (req.headers.host !== address || (req.headers.origin && req.headers.origin !== `http://${address}`) || req.headers['sec-fetch-site'] === 'cross-site') return send(403, JSON.stringify({ error: 'Only same-origin loopback requests are allowed.' }));
    if (req.method !== 'GET') return send(405, JSON.stringify({ error: 'Read-only server' }));
    try {
      const url = new URL(req.url, `http://${address}`);
      if (url.pathname === '/api/snapshot') {
        const mode = url.searchParams.get('mode') || 'working';
        if (!['working', 'staged'].includes(mode)) return send(400, JSON.stringify({ error: 'Invalid mode' }));
        if (pending) return send(429, JSON.stringify({ error: 'A refresh is already running. Try again shortly.' }));
        pending = snapshot(cwd, mode);
        try { return send(200, JSON.stringify(await pending)); } finally { pending = null; }
      }
      const asset = assets.get(url.pathname);
      if (!asset) return send(404, JSON.stringify({ error: 'Not found' }));
      const bytes = await readFile(fileURLToPath(new URL(`../docs/${asset[0]}`, import.meta.url)));
      return send(200, bytes, asset[1]);
    } catch { return send(500, JSON.stringify({ error: 'Could not read this Git repository. Check that Git is installed and the directory is a repository. Very large diffs may exceed the read limit.' })); }
  });
}
