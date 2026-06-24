'use strict';

/* Server tests using Node's built-in test runner (no deps): `npm run test:server`. */

const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const crypto = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert');

// Point persistence at throwaway temp files before requiring the modules.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pnlcal-test-'));
process.env.USERS_FILE = path.join(tmp, 'users.json');
process.env.BLOB_DIR = path.join(tmp, 'blobs');
process.env.AUTH_SECRET = 'test-secret';
process.env.LICENSE_SECRET = 'test-secret';
process.env.AUTH_RATE_MAX = '10000'; // don't rate-limit the test suite's shared IP

const api = require('./api.cjs');
const auth = require('./auth.cjs');

let server;
let base;

test.before(async () => {
  server = http.createServer(api.handle);
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});

test.after(() => { server.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

const post = (p, body, headers) => fetch(base + p, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(headers || {}) }, body: JSON.stringify(body),
});
const get = (p, headers) => fetch(base + p, { headers: headers || {} });

test('license keys round-trip and reject tampering', () => {
  const key = api.generateKey('order1');
  assert.equal(api.verifyKey(key), true);
  assert.equal(api.verifyKey('PNLCAL-ORDER1-00000000'), false);
  assert.equal(api.verifyKey('PNLCAL-PRO-DEMO'), true);
});

test('stripe signature verification', () => {
  const secret = 'whsec_x';
  const body = '{"type":"x"}';
  const ts = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
  assert.equal(api.verifyStripeSignature(body, `t=${ts},v1=${sig}`, secret), true);
  assert.equal(api.verifyStripeSignature(body, `t=${ts},v1=deadbeef`, secret), false);
});

test('auth token round-trip', () => {
  const token = auth.signToken('a@b.com', 60);
  const claims = auth.verifyToken(token);
  assert.equal(claims.email, 'a@b.com');
  assert.equal(auth.verifyToken('bad.token'), null);
});

test('signup, login and me flow', async () => {
  const su = await post('/api/auth/signup', { email: 'flow@example.com', password: 'supersecret' });
  assert.equal(su.status, 200);
  const { token } = await su.json();
  const me = await get('/api/auth/me', { Authorization: `Bearer ${token}` });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).email, 'flow@example.com');

  const badLogin = await post('/api/auth/login', { email: 'flow@example.com', password: 'nope' });
  assert.equal(badLogin.status, 401);
  const goodLogin = await post('/api/auth/login', { email: 'flow@example.com', password: 'supersecret' });
  assert.equal(goodLogin.status, 200);
});

test('login lockout after repeated failures', async () => {
  await post('/api/auth/signup', { email: 'lock@example.com', password: 'supersecret' });
  let last = 0;
  for (let i = 0; i < 6; i++) {
    const r = await post('/api/auth/login', { email: 'lock@example.com', password: 'wrong' });
    last = r.status;
  }
  assert.equal(last, 429); // locked out
});

test('cloud sync push/pull is token-scoped', async () => {
  const su = await post('/api/auth/signup', { email: 'sync@example.com', password: 'supersecret' });
  const { token } = await su.json();
  const h = { Authorization: `Bearer ${token}` };

  const noAuth = await get('/api/sync/pull');
  assert.equal(noAuth.status, 401);

  const empty = await get('/api/sync/pull', h);
  assert.equal((await empty.json()).blob, null);

  const push = await post('/api/sync/push', { app: 'pnlcalendar', trades: [{ date: '2025-03-03', profitLoss: 12 }] }, h);
  assert.equal(push.status, 200);

  const pull = await get('/api/sync/pull', h);
  const data = await pull.json();
  assert.equal(data.blob.trades.length, 1);
});

test('health and version endpoints', async () => {
  const h = await get('/api/health');
  assert.equal(h.status, 200);
  assert.equal((await h.json()).ok, true);
  const v = await get('/api/version');
  assert.equal(v.status, 200);
});

test('change password requires the current one', async () => {
  const su = await post('/api/auth/signup', { email: 'pw@example.com', password: 'originalpw' });
  const { token } = await su.json();
  const h = { Authorization: `Bearer ${token}` };

  const bad = await post('/api/auth/change-password', { currentPassword: 'wrong', newPassword: 'newpassword' }, h);
  assert.equal(bad.status, 401);

  const ok = await post('/api/auth/change-password', { currentPassword: 'originalpw', newPassword: 'newpassword' }, h);
  assert.equal(ok.status, 200);

  // Old password no longer works; new one does.
  assert.equal((await post('/api/auth/login', { email: 'pw@example.com', password: 'originalpw' })).status, 401);
  assert.equal((await post('/api/auth/login', { email: 'pw@example.com', password: 'newpassword' })).status, 200);
});

test('password reset via token', async () => {
  await post('/api/auth/signup', { email: 'reset@example.com', password: 'originalpw' });
  const reqReset = await post('/api/auth/request-reset', { email: 'reset@example.com' });
  const { resetToken } = await reqReset.json();
  assert.ok(resetToken);

  const reset = await post('/api/auth/reset', { token: resetToken, newPassword: 'brandnewpw' });
  assert.equal(reset.status, 200);
  assert.equal((await post('/api/auth/login', { email: 'reset@example.com', password: 'brandnewpw' })).status, 200);

  // A reset token cannot be used as an auth token.
  const me = await get('/api/auth/me', { Authorization: `Bearer ${resetToken}` });
  assert.equal(me.status, 401);
});

test('sign-out-all revokes existing tokens', async () => {
  const su = await post('/api/auth/signup', { email: 'revoke@example.com', password: 'supersecret' });
  const { token: oldToken } = await su.json();
  const h = { Authorization: `Bearer ${oldToken}` };

  assert.equal((await get('/api/auth/me', h)).status, 200);

  const so = await post('/api/auth/signout-all', {}, h);
  assert.equal(so.status, 200);
  const { token: newToken } = await so.json();

  // The old token is now revoked; the freshly issued one still works.
  assert.equal((await get('/api/auth/me', h)).status, 401);
  assert.equal((await get('/api/auth/me', { Authorization: `Bearer ${newToken}` })).status, 200);
});

test('reset revokes existing sessions', async () => {
  const su = await post('/api/auth/signup', { email: 'revreset@example.com', password: 'originalpw' });
  const { token } = await su.json();
  assert.equal((await get('/api/auth/me', { Authorization: `Bearer ${token}` })).status, 200);
  const { resetToken } = await (await post('/api/auth/request-reset', { email: 'revreset@example.com' })).json();
  await post('/api/auth/reset', { token: resetToken, newPassword: 'afterresetpw' });
  // Old session token no longer valid after reset.
  assert.equal((await get('/api/auth/me', { Authorization: `Bearer ${token}` })).status, 401);
});

test('export and delete account', async () => {  const su = await post('/api/auth/signup', { email: 'gdpr@example.com', password: 'supersecret' });
  const { token } = await su.json();
  const h = { Authorization: `Bearer ${token}` };
  await post('/api/sync/push', { app: 'pnlcalendar', trades: [{ date: '2025-01-01', profitLoss: 5 }] }, h);

  const exp = await get('/api/auth/export', h);
  assert.equal(exp.status, 200);
  const data = await exp.json();
  assert.equal(data.email, 'gdpr@example.com');
  assert.equal(data.cloudBackup.trades.length, 1);

  // Wrong password is rejected; correct one deletes the account.
  assert.equal((await post('/api/auth/delete', { password: 'nope' }, h)).status, 401);
  assert.equal((await post('/api/auth/delete', { password: 'supersecret' }, h)).status, 200);
  // After deletion the session and login no longer work.
  assert.equal((await get('/api/auth/me', h)).status, 401);
  assert.equal((await post('/api/auth/login', { email: 'gdpr@example.com', password: 'supersecret' })).status, 401);
});

test('me reports free plan by default and pro after a verified Stripe checkout', async () => {
  const su = await post('/api/auth/signup', { email: 'buyer@example.com', password: 'supersecret' });
  const { token } = await su.json();
  const h = { Authorization: `Bearer ${token}` };

  // New accounts are free.
  assert.equal((await (await get('/api/auth/me', h)).json()).plan, 'free');

  // Simulate Stripe's checkout.session.completed webhook for this buyer.
  const event = JSON.stringify({
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_1', customer_details: { email: 'buyer@example.com' } } },
  });
  const hook = await post('/api/stripe/webhook', JSON.parse(event));
  assert.equal(hook.status, 200);
  assert.equal((await hook.json()).upgraded, true);

  // The backend now reports the account as Pro.
  assert.equal((await (await get('/api/auth/me', h)).json()).plan, 'pro');
});

test('Stripe subscription cancellation downgrades the account to free', async () => {  const su = await post('/api/auth/signup', { email: 'churn@example.com', password: 'supersecret' });
  const { token } = await su.json();
  const h = { Authorization: `Bearer ${token}` };

  // Grant Pro via an invoice.paid event.
  await post('/api/stripe/webhook', {
    type: 'invoice.paid',
    data: { object: { id: 'in_1', customer_email: 'churn@example.com' } },
  });
  assert.equal((await (await get('/api/auth/me', h)).json()).plan, 'pro');

  // Cancellation revokes Pro.
  const cancel = await post('/api/stripe/webhook', {
    type: 'customer.subscription.deleted',
    data: { object: { id: 'sub_1', customer_email: 'churn@example.com' } },
  });
  assert.equal((await cancel.json()).downgraded, true);
  assert.equal((await (await get('/api/auth/me', h)).json()).plan, 'free');
});

test('price->tier mapping: extractPriceIds + isProPurchase', () => {  const invoice = { lines: { data: [{ price: { id: 'price_pro_monthly' } }] } };
  const session = { line_items: { data: [{ price: { id: 'price_other' } }] } };
  assert.deepEqual(api.extractPriceIds(invoice), ['price_pro_monthly']);

  // No allow-list configured -> any purchase counts as Pro (single-product mode).
  assert.equal(api.isProPurchase(invoice, ''), true);
  // Allow-list match / miss.
  assert.equal(api.isProPurchase(invoice, 'price_pro_monthly,price_pro_yearly'), true);
  assert.equal(api.isProPurchase(session, 'price_pro_monthly,price_pro_yearly'), false);
});

test('billingFromObject derives lifetime vs subscription + expiry', () => {
  assert.deepEqual(api.billingFromObject({ mode: 'payment' }), { planType: 'lifetime', planUntil: null });
  const sub = api.billingFromObject({ mode: 'subscription' });
  assert.equal(sub.planType, 'subscription');
  const end = Math.floor(Date.UTC(2026, 0, 1) / 1000);
  const inv = api.billingFromObject({ current_period_end: end });
  assert.equal(inv.planType, 'subscription');
  assert.equal(inv.planUntil, new Date(end * 1000).toISOString());
});

test('billing portal requires auth and reports unconfigured state', async () => {
  // Unauthenticated is rejected.
  assert.equal((await post('/api/billing/portal', {})).status, 401);

  const su = await post('/api/auth/signup', { email: 'billing@example.com', password: 'supersecret' });
  const { token } = await su.json();
  const r = await post('/api/billing/portal', {}, { Authorization: `Bearer ${token}` });
  assert.equal(r.status, 200);
  // STRIPE_PORTAL_URL isn't set in tests, so it reports ok:false with a message.
  const data = await r.json();
  assert.equal(data.ok, false);
  assert.ok(data.message);
});
