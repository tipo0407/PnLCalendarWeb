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
  assert.deepEqual(auth.verifyToken(token), { email: 'a@b.com' });
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
