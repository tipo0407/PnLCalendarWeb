import { describe, it, expect } from 'vitest';
import { normalizeCheckoutResult } from './checkout';

describe('normalizeCheckoutResult', () => {
  it('accepts a valid successful result with an https url', () => {
    const r = normalizeCheckoutResult({ ok: true, url: 'https://checkout.stripe.com/pay/abc', message: 'go' });
    expect(r.ok).toBe(true);
    expect(r.url).toBe('https://checkout.stripe.com/pay/abc');
  });
  it('fails closed when ok is true but url is missing or not https', () => {
    expect(normalizeCheckoutResult({ ok: true }).ok).toBe(false);
    expect(normalizeCheckoutResult({ ok: true, url: 'http://insecure' }).ok).toBe(false);
    expect(normalizeCheckoutResult({ ok: true, url: 'javascript:alert(1)' }).ok).toBe(false);
  });
  it('passes through a well-formed ok:false result', () => {
    const r = normalizeCheckoutResult({ ok: false, message: 'not configured' });
    expect(r.ok).toBe(false);
    expect(r.message).toBe('not configured');
  });
  it('rejects non-object / malformed payloads', () => {
    expect(normalizeCheckoutResult(null).ok).toBe(false);
    expect(normalizeCheckoutResult('nope').ok).toBe(false);
    expect(normalizeCheckoutResult(42).ok).toBe(false);
  });
});
