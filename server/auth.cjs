'use strict';

/*
 * Minimal account auth for PnL Calendar's optional cloud features. No external
 * deps: passwords are salted + scrypt-hashed, sessions are HMAC-signed bearer
 * tokens. Users persist to a JSON file (USERS_FILE). This is a pragmatic stub —
 * swap the file store for a real database before scaling.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const rl = require('./ratelimit.cjs');
const store = require('./store.cjs');

const AUTH_SECRET = process.env.AUTH_SECRET || process.env.LICENSE_SECRET || 'pnlcal-dev-secret-change-me';
const TOKEN_TTL = 30 * 24 * 3600; // 30 days
const MAX_PER_MIN = Number(process.env.AUTH_RATE_MAX || 20); // auth requests per IP per minute
const MAX_FAILS = 5;              // failed logins before lockout
const LOCK_MS = 15 * 60 * 1000;   // lockout window

function loadUsers() { return store.getUsers(); }
function saveUsers(users) { store.saveUsers(users); }

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function signToken(email, ttl = TOKEN_TTL, purpose = 'auth', tv = 1) {
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const payload = Buffer.from(JSON.stringify({ email, exp, purpose, tv })).toString('base64url');
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/** Low-level token check (signature + expiry + purpose). Returns claims, no store. */
function verifyToken(token, expectedPurpose = 'auth') {
  if (!token) return null;
  const [payload, sig] = String(token).split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
  if (expected.length !== sig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!data.exp || data.exp * 1000 < Date.now()) return null;
    if ((data.purpose || 'auth') !== expectedPurpose) return null;
    return { email: data.email, tv: data.tv || 1 };
  } catch {
    return null;
  }
}

function tokenVersionOf(email) {
  const u = loadUsers()[email];
  return u ? (u.tokenVersion || 1) : null;
}

/** Full session check: valid token AND matching token version (supports revocation). */
function verifySession(token, expectedPurpose = 'auth') {
  const data = verifyToken(token, expectedPurpose);
  if (!data) return null;
  const tv = tokenVersionOf(data.email);
  if (tv === null || data.tv !== tv) return null;
  return { email: data.email };
}

function bearer(req) {
  const h = req.headers['authorization'] || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}

/**
 * Set (or clear) a user's entitlement plan by email. Called server-side by the
 * Stripe webhook after a verified payment (or cancellation/refund) so Pro is
 * granted/revoked by the backend, not just a client-held license key. Records
 * when Pro began for display. Returns true if the user existed.
 */
function setPlan(email, plan) {
  const key = String(email || '').toLowerCase();
  const users = loadUsers();
  const user = users[key];
  if (!user) return false;
  if (plan === 'pro') {
    if (user.plan !== 'pro') user.planSince = new Date().toISOString();
    user.plan = 'pro';
  } else {
    delete user.plan;
    delete user.planSince;
  }
  saveUsers(users);
  return true;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Handle /api/auth/* routes. Returns true if it handled the request. */
async function route(req, res, { send, readBody }) {
  const url = (req.url || '').split('?')[0];
  const ip = rl.clientIp(req);

  // Throttle all auth endpoints per IP.
  if (url.startsWith('/api/auth/') && !rl.allow(`auth:${ip}`, MAX_PER_MIN, 60_000)) {
    return send(res, 429, { error: 'too many requests, slow down' }), true;
  }

  if (req.method === 'POST' && url === '/api/auth/signup') {
    const { email, password } = await readBody(req);
    if (!EMAIL_RE.test(email || '')) return send(res, 400, { error: 'invalid email' }), true;
    if (!password || String(password).length < 8) return send(res, 400, { error: 'password too short (min 8)' }), true;
    const users = loadUsers();
    const key = String(email).toLowerCase();
    if (users[key]) return send(res, 409, { error: 'account already exists' }), true;
    const salt = crypto.randomBytes(16).toString('hex');
    users[key] = { salt, hash: hashPassword(password, salt), created: Date.now(), tokenVersion: 1 };
    saveUsers(users);
    return send(res, 200, { token: signToken(key, TOKEN_TTL, 'auth', 1), email: key }), true;
  }

  if (req.method === 'POST' && url === '/api/auth/login') {
    const { email, password } = await readBody(req);
    const key = String(email || '').toLowerCase();
    const lockKey = `login:${key}:${ip}`;
    if (rl.isLocked(lockKey, MAX_FAILS)) {
      return send(res, 429, { error: 'too many failed attempts, try again later' }), true;
    }
    const user = loadUsers()[key];
    const ok = user && crypto.timingSafeEqual(
      Buffer.from(user.hash),
      Buffer.from(hashPassword(password || '', user.salt)),
    );
    if (!ok) {
      rl.recordFailure(lockKey, LOCK_MS);
      return send(res, 401, { error: 'invalid credentials' }), true;
    }
    rl.clearFailures(lockKey);
    return send(res, 200, { token: signToken(key, TOKEN_TTL, 'auth', user.tokenVersion || 1), email: key }), true;
  }

  if (req.method === 'GET' && url === '/api/auth/me') {
    const session = verifySession(bearer(req));
    if (!session) return send(res, 401, { error: 'unauthorized' }), true;
    const user = loadUsers()[session.email] || {};
    return send(res, 200, { email: session.email, plan: user.plan === 'pro' ? 'pro' : 'free' }), true;
  }

  // GDPR-style: download everything stored for this account.
  if (req.method === 'GET' && url === '/api/auth/export') {
    const session = verifySession(bearer(req));
    if (!session) return send(res, 401, { error: 'unauthorized' }), true;
    const user = loadUsers()[session.email] || {};
    const blob = store.getBlob(session.email);
    return send(res, 200, {
      email: session.email,
      created: user.created || null,
      cloudUpdatedAt: blob ? blob.updatedAt : null,
      cloudBackup: blob ? blob.blob : null,
    }), true;
  }

  // Delete the account and all its server-side data (requires password).
  if (req.method === 'POST' && url === '/api/auth/delete') {
    const session = verifySession(bearer(req));
    if (!session) return send(res, 401, { error: 'unauthorized' }), true;
    const { password } = await readBody(req);
    const user = loadUsers()[session.email];
    const ok = user && crypto.timingSafeEqual(
      Buffer.from(user.hash),
      Buffer.from(hashPassword(password || '', user.salt)),
    );
    if (!ok) return send(res, 401, { error: 'password is incorrect' }), true;
    store.deleteUser(session.email);
    return send(res, 200, { ok: true }), true;
  }

  if (req.method === 'POST' && url === '/api/auth/signout-all') {
    const session = verifySession(bearer(req));
    if (!session) return send(res, 401, { error: 'unauthorized' }), true;
    const users = loadUsers();
    const user = users[session.email];
    user.tokenVersion = (user.tokenVersion || 1) + 1;
    saveUsers(users);
    // Issue a fresh token for the current device so it stays signed in.
    return send(res, 200, { ok: true, token: signToken(session.email, TOKEN_TTL, 'auth', user.tokenVersion) }), true;
  }

  if (req.method === 'POST' && url === '/api/auth/change-password') {
    const session = verifySession(bearer(req));
    if (!session) return send(res, 401, { error: 'unauthorized' }), true;
    const { currentPassword, newPassword } = await readBody(req);
    if (!newPassword || String(newPassword).length < 8) return send(res, 400, { error: 'new password too short (min 8)' }), true;
    const users = loadUsers();
    const user = users[session.email];
    const ok = user && crypto.timingSafeEqual(
      Buffer.from(user.hash),
      Buffer.from(hashPassword(currentPassword || '', user.salt)),
    );
    if (!ok) return send(res, 401, { error: 'current password is incorrect' }), true;
    const salt = crypto.randomBytes(16).toString('hex');
    users[session.email] = { ...user, salt, hash: hashPassword(newPassword, salt) };
    saveUsers(users);
    return send(res, 200, { ok: true }), true;
  }

  if (req.method === 'POST' && url === '/api/auth/request-reset') {
    const { email } = await readBody(req);
    const key = String(email || '').toLowerCase();
    const user = loadUsers()[key];
    // Always 200 to avoid user enumeration; a real deployment emails the token.
    const body = { ok: true };
    if (user) body.resetToken = signToken(key, 3600, 'reset', user.tokenVersion || 1);
    return send(res, 200, body), true;
  }

  if (req.method === 'POST' && url === '/api/auth/reset') {
    const { token, newPassword } = await readBody(req);
    const session = verifySession(token, 'reset');
    if (!session) return send(res, 401, { error: 'invalid or expired reset token' }), true;
    if (!newPassword || String(newPassword).length < 8) return send(res, 400, { error: 'new password too short (min 8)' }), true;
    const users = loadUsers();
    const user = users[session.email];
    if (!user) return send(res, 404, { error: 'account not found' }), true;
    const salt = crypto.randomBytes(16).toString('hex');
    // Bump token version so a reset invalidates every existing session.
    users[session.email] = { ...user, salt, hash: hashPassword(newPassword, salt), tokenVersion: (user.tokenVersion || 1) + 1 };
    saveUsers(users);
    return send(res, 200, { ok: true }), true;
  }

  return false;
}

module.exports = { route, verifyToken, verifySession, signToken, bearer, setPlan };
