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
const zlib = require('zlib');
const path = require('path');
const { execFile } = require('child_process');
const { URL } = require('url');
const licenseApi = require('./api.cjs');

const PORT = Number(process.env.PORT) || 4173;
const DIST = path.join(__dirname, '..', 'dist');
// The live trades workbook (defaults to ../../Trading.xlsx, i.e. the GHCPProject root).
const TRADES_FILE = process.env.TRADES_FILE || path.join(__dirname, '..', '..', 'Trading.xlsx');
// Set ALLOW_REMOTE_LOCAL_ENDPOINTS=1 to expose the live-workbook download and the
// sync trigger to non-loopback clients (off by default — these are single-user,
// local-first endpoints that would otherwise leak the user's workbook / let any
// caller spawn the sync child process).
const ALLOW_REMOTE_LOCAL = /^(1|true|yes)$/i.test(process.env.ALLOW_REMOTE_LOCAL_ENDPOINTS || '');
let syncing = false;

/** True when the request originates from the loopback interface. */
function isLoopback(req) {
  const addr = (req.socket && req.socket.remoteAddress) || '';
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

/** Guard for single-user local endpoints; returns true if the request may proceed. */
function localOnly(req, res) {
  if (ALLOW_REMOTE_LOCAL || isLoopback(req)) return true;
  res.writeHead(403, { 'Content-Type': 'application/json', ...securityHeaders() });
  res.end(JSON.stringify({ error: 'forbidden: local-only endpoint' }));
  return false;
}

// Hosts the proxies are allowed to reach. Redirects that leave these hosts are
// rejected to prevent SSRF into internal/metadata addresses.
const ALLOWED_PROXY_HOSTS = new Set(['query1.finance.yahoo.com', 'docs.google.com']);

/** Reject IP-literal hosts that fall in loopback/private/link-local ranges. */
function isPrivateHost(hostname) {
  const h = String(hostname).replace(/^\[|\]$/g, '');
  if (/^(localhost)$/i.test(h)) return true;
  // IPv4 literal ranges.
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;                 // link-local
    if (a === 172 && b >= 16 && b <= 31) return true;         // 172.16/12
    if (a === 192 && b === 168) return true;                  // 192.168/16
    if (a === 100 && b >= 64 && b <= 127) return true;        // CGNAT
    return false;
  }
  // IPv6 loopback / unique-local / link-local.
  if (h === '::1' || /^f[cd][0-9a-f]{2}:/i.test(h) || /^fe80:/i.test(h)) return true;
  if (/^::ffff:127\./i.test(h)) return true;
  return false;
}

// Conservative security headers for the static app shell.
const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': CSP,
  };
}

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

// Text-based assets worth compressing on the fly.
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.map', '.webmanifest']);

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

const PROXIES = [
  { prefix: '/yahoo', target: 'https://query1.finance.yahoo.com', host: 'query1.finance.yahoo.com', headers: { 'User-Agent': UA } },
  { prefix: '/gsheet', target: 'https://docs.google.com', host: 'docs.google.com', headers: {} },
];

function forward(urlStr, extraHeaders, clientRes, depth, allowedHost) {
  if (depth > 5) {
    clientRes.writeHead(508, securityHeaders());
    return clientRes.end('Too many redirects');
  }
  let u;
  try {
    u = new URL(urlStr);
  } catch {
    clientRes.writeHead(400, securityHeaders());
    return clientRes.end('Bad proxy URL');
  }
  // SSRF guard: only https, only the allow-listed host, never private/loopback IPs.
  if (u.protocol !== 'https:' || u.hostname !== allowedHost || isPrivateHost(u.hostname)) {
    clientRes.writeHead(403, securityHeaders());
    return clientRes.end('Proxy target not allowed');
  }
  const opts = {
    method: 'GET',
    headers: { Accept: '*/*', ...extraHeaders, host: u.host },
  };
  const upstream = https.request(u, opts, (up) => {
    const sc = up.statusCode || 502;
    if (sc >= 300 && sc < 400 && up.headers.location) {
      up.resume();
      let next;
      try {
        next = new URL(up.headers.location, u);
      } catch {
        clientRes.writeHead(502, securityHeaders());
        return clientRes.end('Bad redirect');
      }
      // Only follow redirects that stay on the same allow-listed host.
      if (next.protocol !== 'https:' || next.hostname !== allowedHost || isPrivateHost(next.hostname)) {
        clientRes.writeHead(403, securityHeaders());
        return clientRes.end('Redirect target not allowed');
      }
      return forward(next.toString(), extraHeaders, clientRes, depth + 1, allowedHost);
    }
    const headers = { ...up.headers, ...securityHeaders() };
    delete headers['content-security-policy'];
    delete headers['set-cookie'];
    headers['access-control-allow-origin'] = '*';
    clientRes.writeHead(sc, headers);
    up.pipe(clientRes);
  });
  upstream.on('error', (e) => {
    if (!clientRes.headersSent) clientRes.writeHead(502, securityHeaders());
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
    res.writeHead(403, securityHeaders());
    return res.end('Forbidden');
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      file = path.join(DIST, 'index.html'); // SPA fallback
    }
    const ext = path.extname(file).toLowerCase();
    // Hashed build assets are content-addressed and safe to cache forever;
    // the HTML shell must stay fresh so new deploys are picked up.
    const cache = pathname.startsWith('/assets/')
      ? 'public, max-age=31536000, immutable'
      : 'no-cache';
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': cache,
      ...securityHeaders(),
    };
    // Transparently compress text-based assets when the client supports it.
    const accept = String(req.headers['accept-encoding'] || '');
    const encoder = COMPRESSIBLE.has(ext) && /\bbr\b/.test(accept)
      ? { enc: 'br', stream: () => zlib.createBrotliCompress() }
      : COMPRESSIBLE.has(ext) && /\bgzip\b/.test(accept)
        ? { enc: 'gzip', stream: () => zlib.createGzip() }
        : null;
    if (encoder) {
      headers['Content-Encoding'] = encoder.enc;
      headers['Vary'] = 'Accept-Encoding';
      res.writeHead(200, headers);
      fs.createReadStream(file).pipe(encoder.stream()).pipe(res);
    } else {
      res.writeHead(200, headers);
      fs.createReadStream(file).pipe(res);
    }
  });
}

// Minimal structured logger: timestamped, leveled, single-line JSON-ish output.
function log(level, msg, extra) {
  const rec = { ts: new Date().toISOString(), level, msg, ...(extra || {}) };
  const line = `${rec.ts} [${level.toUpperCase()}] ${msg}` + (extra ? ` ${JSON.stringify(extra)}` : '');
  (level === 'error' ? console.error : console.log)(line);
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
    if (!localOnly(req, res)) return;
    if (syncing) {
      res.writeHead(200, { 'Content-Type': 'application/json', ...securityHeaders() });
      return res.end(JSON.stringify({ ok: true, already: true }));
    }
    syncing = true;
    const bat = path.join(__dirname, 'sync-sheet.bat');
    execFile('cmd.exe', ['/c', bat, TRADES_FILE], { windowsHide: true, timeout: 60000 }, (err) => {
      syncing = false;
      if (!res.headersSent) {
        res.writeHead(err ? 500 : 200, { 'Content-Type': 'application/json', ...securityHeaders() });
        res.end(JSON.stringify({ ok: !err, error: err ? String(err.message || err) : undefined }));
      }
    });
    return;
  }
  // Auto-load endpoint: stream the live trades workbook.
  if (url === '/data/trades.xlsx') {
    if (!localOnly(req, res)) return;
    fs.stat(TRADES_FILE, (err, st) => {
      if (err || !st.isFile()) {
        res.writeHead(404, securityHeaders());
        return res.end('trades file not found');
      }
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Cache-Control': 'no-store',
        ...securityHeaders(),
      });
      fs.createReadStream(TRADES_FILE).pipe(res);
    });
    return;
  }
  for (const p of PROXIES) {
    if (url === p.prefix || url.startsWith(p.prefix + '/')) {
      const rest = url.slice(p.prefix.length) || '/';
      return forward(p.target + rest, p.headers, res, 0, p.host);
    }
  }
  serveStatic(req, res);
});

// Graceful shutdown: stop accepting connections and let in-flight requests drain.
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('info', `received ${signal}, shutting down`);
  server.close(() => {
    log('info', 'http server closed');
    process.exit(0);
  });
  // Force-exit if connections don't drain in time.
  setTimeout(() => {
    log('error', 'forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}

// Only bind the port + signal handlers when run directly (keeps the module
// importable from tests without side effects).
if (require.main === module) {
  server.listen(PORT, () => {
    log('info', `PnL Calendar running at http://localhost:${PORT}`);
  });
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = { server, isPrivateHost, isLoopback };
