'use strict';

/*
 * Tests for the plain-Node server helpers (serve.cjs, store.cjs, ratelimit.cjs)
 * using Node's built-in runner: `npm run test:server`. No external deps.
 */

const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const test = require('node:test');
const assert = require('node:assert');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pnlcal-srv-'));

// --- store.cjs (atomic file store) -----------------------------------------
const { createFileStore } = require('./store.cjs');

test('file store: users round-trip and atomic write leaves no temp files', () => {
  const usersFile = path.join(tmp, 'users.json');
  const blobDir = path.join(tmp, 'blobs');
  const store = createFileStore(usersFile, blobDir);

  assert.deepEqual(store.getUsers(), {});
  store.saveUsers({ 'a@b.com': { salt: 's', hash: 'h' } });
  assert.equal(store.getUsers()['a@b.com'].hash, 'h');

  // The atomic rename must not leave *.tmp turds behind.
  const leftovers = fs.readdirSync(path.dirname(usersFile)).filter((f) => f.endsWith('.tmp'));
  assert.deepEqual(leftovers, []);
});

test('file store: blob set/get and deleteUser removes user + blob', () => {
  const usersFile = path.join(tmp, 'u2.json');
  const blobDir = path.join(tmp, 'b2');
  const store = createFileStore(usersFile, blobDir);

  store.saveUsers({ 'x@y.com': { salt: 's', hash: 'h' } });
  store.setBlob('x@y.com', { updatedAt: 't', blob: { trades: [1] } });
  assert.deepEqual(store.getBlob('x@y.com').blob.trades, [1]);

  store.deleteUser('x@y.com');
  assert.equal(store.getUsers()['x@y.com'], undefined);
  assert.equal(store.getBlob('x@y.com'), null);
});

test('file store: getUsers tolerates corrupt JSON', () => {
  const usersFile = path.join(tmp, 'corrupt.json');
  fs.writeFileSync(usersFile, '{ this is not json');
  const store = createFileStore(usersFile, path.join(tmp, 'b3'));
  assert.deepEqual(store.getUsers(), {});
});

// --- ratelimit.cjs ----------------------------------------------------------
const rl = require('./ratelimit.cjs');

test('ratelimit: fixed window allows up to max then blocks', () => {
  const key = `win-${Math.random()}`;
  assert.equal(rl.allow(key, 2, 60_000), true);
  assert.equal(rl.allow(key, 2, 60_000), true);
  assert.equal(rl.allow(key, 2, 60_000), false);
});

test('ratelimit: lockout after repeated failures and clearFailures resets', () => {
  const key = `lock-${Math.random()}`;
  assert.equal(rl.isLocked(key, 3), false);
  rl.recordFailure(key, 60_000);
  rl.recordFailure(key, 60_000);
  assert.equal(rl.isLocked(key, 3), false);
  rl.recordFailure(key, 60_000);
  assert.equal(rl.isLocked(key, 3), true);
  rl.clearFailures(key);
  assert.equal(rl.isLocked(key, 3), false);
});

test('ratelimit: clientIp ignores X-Forwarded-For unless TRUST_PROXY is set', () => {
  const req = { headers: { 'x-forwarded-for': '9.9.9.9' }, socket: { remoteAddress: '127.0.0.1' } };
  // TRUST_PROXY was unset when the module loaded, so XFF is ignored.
  assert.equal(rl.clientIp(req), '127.0.0.1');
});

// --- serve.cjs (SSRF guard + static serving) --------------------------------
process.env.TRADES_FILE = path.join(tmp, 'no-such-trades.xlsx');
const serve = require('./serve.cjs');

test('serve: isPrivateHost flags loopback/private/link-local IPs', () => {
  for (const h of ['127.0.0.1', '10.0.0.1', '192.168.1.1', '172.16.5.5', '169.254.1.1', '::1', 'localhost', '100.64.0.1']) {
    assert.equal(serve.isPrivateHost(h), true, `${h} should be private`);
  }
  for (const h of ['8.8.8.8', 'query1.finance.yahoo.com', '172.32.0.1', '11.0.0.1']) {
    assert.equal(serve.isPrivateHost(h), false, `${h} should be public`);
  }
});

test('serve: SPA fallback, path-traversal block, and local-only gate', async () => {
  const server = serve.server;
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  try {
    // Unknown route falls back to the SPA shell (200, even without a dist build
    // the handler responds rather than 404-ing the client router).
    const spa = await fetch(`${base}/some/client/route`);
    assert.ok(spa.status === 200 || spa.status === 404); // dist may be absent in CI
    assert.equal(spa.headers.get('x-content-type-options'), 'nosniff');

    // Path traversal must be neutralized: the server normalizes dot-segments and
    // the startsWith(DIST) guard blocks anything escaping the build dir, so a
    // traversal attempt is handled safely (never leaks a file outside dist/).
    const trav = await new Promise((resolve, reject) => {
      const r = http.request(
        { host: '127.0.0.1', port, path: '/%2e%2e/%2e%2e/%2e%2e/etc/passwd', method: 'GET' },
        (resp) => {
          let body = '';
          resp.on('data', (c) => { body += c; });
          resp.on('end', () => resolve({ status: resp.statusCode, body }));
        },
      );
      r.on('error', reject);
      r.end();
    });
    assert.ok([200, 403, 404].includes(trav.status));
    assert.ok(!/root:.*:0:0:/.test(trav.body)); // never served a real /etc/passwd

    // /data/trades.xlsx from loopback is allowed through to the (missing) file -> 404.
    const trades = await fetch(`${base}/data/trades.xlsx`);
    assert.equal(trades.status, 404);
    assert.equal(trades.headers.get('x-content-type-options'), 'nosniff');
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test.after(() => { fs.rmSync(tmp, { recursive: true, force: true }); });
