/*
 * Dependency-free static server for the built PnL Calendar app (dist/).
 * Also replicates the Vite dev proxies so intraday market data and Google
 * Sheet imports keep working in production:
 *   /yahoo/*  -> https://query1.finance.yahoo.com/*
 *   /gsheet/* -> https://docs.google.com/*
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { URL } = require('url');
const licenseApi = require('./api.cjs');

const PORT = Number(process.env.PORT) || 4173;
const DIST = path.join(__dirname, '..', 'dist');
// The live trades workbook (defaults to ../../Trading.xlsx, i.e. the GHCPProject root).
const TRADES_FILE = process.env.TRADES_FILE || path.join(__dirname, '..', '..', 'Trading.xlsx');
let syncing = false;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

const PROXIES = [
  { prefix: '/yahoo', target: 'https://query1.finance.yahoo.com', headers: { 'User-Agent': UA } },
  { prefix: '/gsheet', target: 'https://docs.google.com', headers: {} },
];

function forward(urlStr, extraHeaders, clientRes, depth) {
  if (depth > 5) {
    clientRes.writeHead(508);
    return clientRes.end('Too many redirects');
  }
  const u = new URL(urlStr);
  const opts = {
    method: 'GET',
    headers: { Accept: '*/*', ...extraHeaders, host: u.host },
  };
  const upstream = https.request(u, opts, (up) => {
    const sc = up.statusCode || 502;
    if (sc >= 300 && sc < 400 && up.headers.location) {
      up.resume();
      const next = new URL(up.headers.location, u).toString();
      return forward(next, extraHeaders, clientRes, depth + 1);
    }
    const headers = { ...up.headers };
    delete headers['content-security-policy'];
    delete headers['set-cookie'];
    headers['access-control-allow-origin'] = '*';
    clientRes.writeHead(sc, headers);
    up.pipe(clientRes);
  });
  upstream.on('error', (e) => {
    if (!clientRes.headersSent) clientRes.writeHead(502);
    clientRes.end('Proxy error: ' + e.message);
  });
  upstream.end();
}

function serveStatic(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    pathname = '/';
  }
  if (pathname === '/') pathname = '/index.html';
  let file = path.join(DIST, pathname);
  if (!file.startsWith(DIST)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      file = path.join(DIST, 'index.html'); // SPA fallback
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = req.url || '/';
  // License / checkout / ops API (handled by the shared dependency-free module).
  if (url === '/api/checkout' || url.startsWith('/api/license') || url.startsWith('/api/stripe')
      || url.startsWith('/api/health') || url.startsWith('/api/version') || url.startsWith('/api/auth')
      || url.startsWith('/api/sync/')) {
    licenseApi.handle(req, res);
    return;
  }
  // Trigger a Google Sheet sync (downloads via the logged-in browser session).
  if (url === '/api/sync') {
    if (syncing) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, already: true }));
    }
    syncing = true;
    const bat = path.join(__dirname, 'sync-sheet.bat');
    execFile('cmd.exe', ['/c', bat, TRADES_FILE], { windowsHide: true, timeout: 60000 }, (err) => {
      syncing = false;
      if (!res.headersSent) {
        res.writeHead(err ? 500 : 200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: !err, error: err ? String(err.message || err) : undefined }));
      }
    });
    return;
  }
  // Auto-load endpoint: stream the live trades workbook.
  if (url === '/data/trades.xlsx') {
    fs.stat(TRADES_FILE, (err, st) => {
      if (err || !st.isFile()) {
        res.writeHead(404);
        return res.end('trades file not found');
      }
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(TRADES_FILE).pipe(res);
    });
    return;
  }
  for (const p of PROXIES) {
    if (url === p.prefix || url.startsWith(p.prefix + '/')) {
      const rest = url.slice(p.prefix.length) || '/';
      return forward(p.target + rest, p.headers, res, 0);
    }
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`PnL Calendar running at http://localhost:${PORT}`);
});
