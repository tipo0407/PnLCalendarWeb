'use strict';

/*
 * Token-scoped cloud backup store. Each account gets one JSON blob (the client's
 * backup object). This is a pragmatic file-backed stub — swap for object storage
 * or a database before scaling. Auth is required for all routes.
 */

const auth = require('./auth.cjs');
const store = require('./store.cjs');

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB

function readRaw(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let aborted = false;
    req.on('data', (c) => {
      data += c;
      if (data.length > MAX_BYTES && !aborted) { aborted = true; req.destroy(); reject(new Error('too large')); }
    });
    req.on('end', () => { if (!aborted) resolve(data); });
    req.on('error', reject);
  });
}

/** Handle /api/sync/* routes. Returns true if it handled the request. */
async function route(req, res, { send }) {
  const url = (req.url || '').split('?')[0];
  if (!url.startsWith('/api/sync/')) return false;

  const session = auth.verifySession(auth.bearer(req));
  if (!session) return send(res, 401, { error: 'unauthorized' }), true;

  if (req.method === 'POST' && url === '/api/sync/push') {
    let raw;
    try { raw = await readRaw(req); } catch { return send(res, 413, { error: 'payload too large' }), true; }
    let blob;
    try { blob = JSON.parse(raw || 'null'); } catch { return send(res, 400, { error: 'invalid json' }), true; }
    const updatedAt = new Date().toISOString();
    try {
      store.setBlob(session.email, { updatedAt, blob });
    } catch {
      return send(res, 500, { error: 'store failed' }), true;
    }
    return send(res, 200, { ok: true, updatedAt }), true;
  }

  if (req.method === 'GET' && url === '/api/sync/pull') {
    const data = store.getBlob(session.email);
    if (!data) return send(res, 200, { blob: null, updatedAt: null }), true;
    return send(res, 200, { blob: data.blob, updatedAt: data.updatedAt }), true;
  }

  return send(res, 404, { error: 'not found' }), true;
}

module.exports = { route };
