'use strict';

/*
 * Dependency-free licensing / checkout API for PnL Calendar.
 *
 * Endpoints (JSON):
 *   POST /api/checkout         -> { ok, url?, message }   (Stripe-ready stub)
 *   POST /api/license/verify   -> { valid, plan }         (HMAC license check)
 *
 * License keys look like  PNLCAL-<PAYLOAD>-<SIG>  where SIG is the first 8 hex
 * chars (upper-cased) of HMAC_SHA256(secret, PAYLOAD). Keys are issued offline
 * with `node server/api.cjs --gen [payload]` so no key database is required.
 *
 * Run:  LICENSE_SECRET=... node server/api.cjs   (default port 8788)
 */

const http = require('node:http');
const crypto = require('node:crypto');

const SECRET = process.env.LICENSE_SECRET || 'pnlcal-dev-secret-change-me';
const PORT = Number(process.env.API_PORT || 8788);
// Demo key is always accepted so reviewers can try Pro without a real key.
const DEMO_KEY = 'PNLCAL-PRO-DEMO';

function sigFor(payload) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex').slice(0, 8).toUpperCase();
}

function generateKey(payload) {
  const p = (payload || crypto.randomBytes(4).toString('hex')).toUpperCase();
  return `PNLCAL-${p}-${sigFor(p)}`;
}

function verifyKey(key) {
  if (typeof key !== 'string') return false;
  const k = key.trim().toUpperCase();
  if (k === DEMO_KEY) return true;
  const parts = k.split('-');
  if (parts.length !== 3 || parts[0] !== 'PNLCAL') return false;
  const [, payload, sig] = parts;
  if (!/^[A-Z0-9]{4,}$/.test(payload)) return false;
  // Constant-time compare to avoid leaking timing info.
  const expected = sigFor(payload);
  if (expected.length !== sig.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  });
  res.end(json);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
    });
  });
}

/** Route a request; exported so it can be embedded in another server too. */
async function handle(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});

  const url = (req.url || '').split('?')[0];

  if (req.method === 'POST' && url === '/api/checkout') {
    const stripeReady = Boolean(process.env.STRIPE_SECRET_KEY);
    if (!stripeReady) {
      return send(res, 200, {
        ok: false,
        message: 'Online checkout is not configured yet. Use a license key (or the demo key) to activate Pro.',
      });
    }
    // Future: create a real Stripe Checkout Session and return its URL here.
    return send(res, 200, { ok: true, url: 'https://checkout.stripe.com/pay/REPLACE_ME' });
  }

  if (req.method === 'POST' && url === '/api/license/verify') {
    const body = await readBody(req);
    const valid = verifyKey(body && body.key);
    return send(res, 200, { valid, plan: valid ? 'pro' : 'free' });
  }

  return send(res, 404, { error: 'not found' });
}

module.exports = { handle, verifyKey, generateKey, sigFor };

// CLI: key generator + standalone server.
if (require.main === module) {
  if (process.argv.includes('--gen')) {
    const payload = process.argv[process.argv.indexOf('--gen') + 1];
    process.stdout.write(generateKey(payload && !payload.startsWith('--') ? payload : undefined) + '\n');
    process.exit(0);
  }
  http.createServer(handle).listen(PORT, () => {
    console.log(`[api] license/checkout API listening on http://localhost:${PORT}`);
  });
}
