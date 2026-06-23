'use strict';

/*
 * Tiny in-memory rate limiter + login-lockout. Fine for a single instance; for
 * multi-node, back these maps with Redis. Buckets/failures self-expire.
 */

const buckets = new Map();
const failures = new Map();

/** Fixed-window limiter: true if this hit is within `max` per `windowMs`. */
function allow(key, max, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now > b.reset) {
    b = { count: 0, reset: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  return b.count <= max;
}

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

/** Record a failed login; returns the current failure count within the window. */
function recordFailure(key, lockMs) {
  const now = Date.now();
  let f = failures.get(key);
  if (!f || now > f.until) f = { count: 0, until: now + lockMs };
  f.count += 1;
  failures.set(key, f);
  return f.count;
}

function isLocked(key, maxFails) {
  const f = failures.get(key);
  if (!f) return false;
  if (Date.now() > f.until) { failures.delete(key); return false; }
  return f.count >= maxFails;
}

function clearFailures(key) {
  failures.delete(key);
}

// Periodic cleanup so the maps don't grow unbounded.
if (typeof setInterval === 'function') {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) if (now > b.reset) buckets.delete(k);
    for (const [k, f] of failures) if (now > f.until) failures.delete(k);
  }, 60_000);
  if (timer.unref) timer.unref();
}

module.exports = { allow, clientIp, recordFailure, isLocked, clearFailures };
