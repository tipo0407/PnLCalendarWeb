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
const auth = require('./auth.cjs');
const sync = require('./sync.cjs');

const SECRET = process.env.LICENSE_SECRET || 'pnlcal-dev-secret-change-me';
const PORT = Number(process.env.API_PORT || 8788);
// Demo key is always accepted so reviewers can try Pro without a real key.
const DEMO_KEY = 'PNLCAL-PRO-DEMO';
const START = Date.now();
let VERSION = '0.0.0';
try { VERSION = require('../package.json').version; } catch { /* ignore */ }

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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

function readRaw(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1e6) req.destroy();
    });
    req.on('end', () => resolve(data));
  });
}

/**
 * Verify a Stripe webhook signature (the `Stripe-Signature` header) against the
 * raw body, following Stripe's scheme: signed_payload = `${t}.${rawBody}`,
 * expected = HMAC_SHA256(secret, signed_payload), compared to the `v1` value.
 */
function verifyStripeSignature(rawBody, header, secret, toleranceSec = 300) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(String(header).split(',').map((kv) => kv.split('=')));
  const ts = Number(parts.t);
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  if (Math.abs(Date.now() / 1000 - ts) > toleranceSec) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
  if (expected.length !== v1.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}

/**
 * Collect any Stripe price IDs referenced by a webhook object, across the shapes
 * Stripe uses for sessions, invoices and subscriptions. Used to map a payment to
 * a plan tier so we only grant Pro for recognized prices.
 */
function extractPriceIds(obj) {
  const ids = new Set();
  const add = (v) => { if (typeof v === 'string' && v) ids.add(v); };
  const fromLines = (lines) => {
    const data = (lines && lines.data) || [];
    for (const li of data) {
      add(li.price && li.price.id);
      add(li.plan && li.plan.id);
      add(li.pricing && li.pricing.price_details && li.pricing.price_details.price);
    }
  };
  if (obj) {
    fromLines(obj.lines);        // invoice.lines
    fromLines(obj.line_items);   // checkout session (expanded)
    fromLines(obj.items);        // subscription.items
    add(obj.price && (obj.price.id || obj.price));
    add(obj.plan && obj.plan.id);
    if (obj.metadata) { add(obj.metadata.price_id); add(obj.metadata.priceId); }
  }
  return [...ids];
}

/**
 * Decide whether a granting event is for the Pro tier. When no allow-list is
 * configured (STRIPE_PRO_PRICE_IDS unset) every successful payment grants Pro,
 * preserving the simple single-product setup. When configured, at least one of
 * the object's price IDs must be in the allow-list.
 */
function isProPurchase(obj, allowedCsv) {
  const allowed = String(allowedCsv || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (allowed.length === 0) return true;
  const ids = extractPriceIds(obj);
  return ids.some((id) => allowed.includes(id));
}

/** Route a request; exported so it can be embedded in another server too. */
async function handle(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});

  const url = (req.url || '').split('?')[0];

  // Health & version (GET, unauthenticated).
  if (req.method === 'GET' && (url === '/api/health' || url === '/api/healthz')) {
    return send(res, 200, { ok: true, uptime: Math.round((Date.now() - START) / 1000) });
  }
  if (req.method === 'GET' && url === '/api/version') {
    return send(res, 200, { version: VERSION, node: process.version, commit: process.env.GIT_COMMIT || null });
  }

  // Account auth (/api/auth/*).
  if (url.startsWith('/api/auth/')) {
    const handled = await auth.route(req, res, { send, readBody });
    if (handled) return;
  }

  // Cloud sync (/api/sync/*) — token-scoped.
  if (url.startsWith('/api/sync/')) {
    const handled = await sync.route(req, res, { send });
    if (handled) return;
  }

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

  // Admin-only key issuance. Intended to be called by a post-payment hook
  // (e.g. a Stripe webhook handler) or an operator. Requires ADMIN_TOKEN.
  //   curl -XPOST -H "x-admin-token: $ADMIN_TOKEN" -d '{"payload":"order_123"}' /api/license/issue
  if (req.method === 'POST' && url === '/api/license/issue') {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) return send(res, 403, { error: 'issuance disabled (set ADMIN_TOKEN)' });
    if (req.headers['x-admin-token'] !== adminToken) return send(res, 401, { error: 'unauthorized' });
    const body = await readBody(req);
    const raw = body && typeof body.payload === 'string' ? body.payload.replace(/[^A-Za-z0-9]/g, '') : undefined;
    const key = generateKey(raw && raw.length >= 4 ? raw : undefined);
    return send(res, 200, { key, plan: 'pro' });
  }

  // Stripe webhook: grant/revoke Pro on the buyer's account across the payment
  // lifecycle. Signature is verified when STRIPE_WEBHOOK_SECRET is set.
  if (req.method === 'POST' && url === '/api/stripe/webhook') {
    const rawBody = await readRaw(req);
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (secret && !verifyStripeSignature(rawBody, req.headers['stripe-signature'], secret)) {
      return send(res, 400, { error: 'invalid signature' });
    }
    let event;
    try { event = JSON.parse(rawBody || '{}'); } catch { return send(res, 400, { error: 'bad payload' }); }
    const obj = (event.data && event.data.object) || {};
    const emailOf = (o) =>
      (o.customer_details && o.customer_details.email) ||
      o.customer_email || o.receipt_email || '';

    // Events that GRANT Pro.
    if (event.type === 'checkout.session.completed' || event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') {
      const email = emailOf(obj);
      // Only honor recognized Pro prices when an allow-list is configured.
      if (!isProPurchase(obj, process.env.STRIPE_PRO_PRICE_IDS)) {
        console.log(`[stripe] ${event.type}: ignored (price not in STRIPE_PRO_PRICE_IDS) for ${email || 'unknown'}`);
        return send(res, 200, { received: true, upgraded: false, ignored: true });
      }
      const bind = email || obj.id || '';
      const payload = String(bind).replace(/[^A-Za-z0-9]/g, '').slice(0, 16);
      const key = generateKey(payload.length >= 4 ? payload : undefined);
      const granted = email ? auth.setPlan(email, 'pro') : false;
      console.log(`[stripe] ${event.type}: license ${key} for ${bind || 'unknown'}${granted ? ' (account upgraded)' : ''}`);
      return send(res, 200, { received: true, key, upgraded: granted });
    }

    // Events that REVOKE Pro (cancellation, full refund, terminal payment failure).
    if (event.type === 'customer.subscription.deleted' ||
        event.type === 'charge.refunded' ||
        event.type === 'invoice.payment_failed') {
      const email = emailOf(obj);
      const downgraded = email ? auth.setPlan(email, 'free') : false;
      console.log(`[stripe] ${event.type}: ${email || 'unknown'}${downgraded ? ' (account downgraded)' : ''}`);
      return send(res, 200, { received: true, downgraded });
    }

    return send(res, 200, { received: true });
  }

  return send(res, 404, { error: 'not found' });
}

module.exports = { handle, verifyKey, generateKey, sigFor, verifyStripeSignature, extractPriceIds, isProPurchase };

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
