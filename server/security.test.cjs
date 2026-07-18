'use strict';

/* Security / branch coverage for the API, auth and sync modules. Runs under
 * `npm run test:server`. Env is set before requiring the modules so the CORS
 * allow-list and admin token are active for this file's process. */

const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pnlcal-sec-'));
process.env.USERS_FILE = path.join(tmp, 'users.json');
process.env.BLOB_DIR = path.join(tmp, 'blobs');
process.env.AUTH_SECRET = 'test-secret';
process.env.LICENSE_SECRET = 'test-secret';
process.env.AUTH_RATE_MAX = '10000';
process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com';
process.env.ADMIN_TOKEN = 'admintok';

const api = require('./api.cjs');

// Build an auth header via concatenation (avoids literal-token handling).
const authHeader = (tok) => ({ Authorization: 'Bearer '.concat(tok) });

let server;
let base;
test.before(async () => {
  server = http.createServer(api.handle);
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
test.after(() => { server.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

const post = (p, body, headers) => fetch(base + p, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(headers || {}) },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const get = (p, headers) => fetch(base + p, { headers: headers || {} });

test('signup validates email and password, and rejects duplicates', async () => {
  assert.equal((await post('/api/auth/signup', { email: 'nope', password: 'longenough' })).status, 400);
  assert.equal((await post('/api/auth/signup', { email: 'a@b.com', password: 'short' })).status, 400);
  assert.equal((await post('/api/auth/signup', { email: 'dup@b.com', password: 'longenough' })).status, 200);
  assert.equal((await post('/api/auth/signup', { email: 'dup@b.com', password: 'longenough' })).status, 409);
});

test('change-password rejects a too-short new password', async () => {
  const su = await post('/api/auth/signup', { email: 'cp@b.com', password: 'originalpw' });
  const { token } = await su.json();
  const r = await post('/api/auth/change-password',
    { currentPassword: 'originalpw', newPassword: 'x' }, authHeader(token));
  assert.equal(r.status, 400);
});

test('CORS: allow-listed origin is echoed, others are omitted', async () => {
  const ok = await get('/api/health', { Origin: 'https://app.example.com' });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://app.example.com');
  const denied = await get('/api/health', { Origin: 'https://evil.example.com' });
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
});

test('OPTIONS preflight returns 204 and security headers on responses', async () => {
  const opt = await fetch(base + '/api/health', { method: 'OPTIONS' });
  assert.equal(opt.status, 204);
  const h = await get('/api/health');
  assert.equal(h.headers.get('x-content-type-options'), 'nosniff');
});

test('license issuance is gated by ADMIN_TOKEN', async () => {
  assert.equal((await post('/api/license/issue', { payload: 'order1' })).status, 401);
  assert.equal((await post('/api/license/issue', { payload: 'order1' }, { 'x-admin-token': 'wrong' })).status, 401);
  const ok = await post('/api/license/issue', { payload: 'order1' }, { 'x-admin-token': 'admintok' });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).plan, 'pro');
});

test('sync routes reject unauth, bad json and unknown paths', async () => {
  assert.equal((await get('/api/sync/pull')).status, 401);
  const su = await post('/api/auth/signup', { email: 'syncbranch@b.com', password: 'longenough' });
  const { token } = await su.json();
  const auth = authHeader(token);
  const bad = await fetch(base + '/api/sync/push', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...auth }, body: '{not json',
  });
  assert.equal(bad.status, 400);
  assert.equal((await get('/api/sync/bogus', auth)).status, 404);
});

test('stripe signature rejects replayed (stale) timestamps', () => {
  const crypto = require('node:crypto');
  const secret = 'whsec_test';
  const body = '{"type":"x"}';
  const stale = Math.floor(Date.now() / 1000) - 10000;
  const sig = crypto.createHmac('sha256', secret).update(`${stale}.${body}`).digest('hex');
  assert.equal(api.verifyStripeSignature(body, `t=${stale},v1=${sig}`, secret), false);
});

test('stripe signature accepts any of multiple v1 values', () => {
  const crypto = require('node:crypto');
  const secret = 'whsec_test';
  const body = '{"type":"x"}';
  const ts = Math.floor(Date.now() / 1000);
  const good = crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
  assert.equal(api.verifyStripeSignature(body, `t=${ts},v1=deadbeef,v1=${good}`, secret), true);
});

test('production refuses to start with a default/unset secret', () => {
  const res = spawnSync(process.execPath, ['-e', "require('./server/auth.cjs')"], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'production', AUTH_SECRET: '', LICENSE_SECRET: '' },
    encoding: 'utf8',
  });
  assert.notEqual(res.status, 0);
  assert.match(String(res.stderr), /Refusing to start/);
});
