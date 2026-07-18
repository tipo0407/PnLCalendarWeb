import { describe, it, expect, beforeEach } from 'vitest';
import * as storage from './safeStorage';

// The vitest node environment has no window.localStorage, so these exercise the
// in-memory fallback path (which is exactly what runs in privacy/blocked mode).
describe('safeStorage', () => {
  beforeEach(() => {
    storage.removeItem('ss-k');
    storage.removeItem('ss-missing');
    storage.removeItem('ss-corrupt');
    storage.removeItem('ss-obj');
  });

  it('round-trips string values', () => {
    storage.setItem('ss-k', 'v');
    expect(storage.getItem('ss-k')).toBe('v');
    storage.removeItem('ss-k');
    expect(storage.getItem('ss-k')).toBeNull();
  });

  it('getJSON returns the fallback for missing or corrupt values', () => {
    expect(storage.getJSON('ss-missing', { a: 1 })).toEqual({ a: 1 });
    storage.setItem('ss-corrupt', '{ not json');
    expect(storage.getJSON('ss-corrupt', 42)).toBe(42);
  });

  it('setJSON/getJSON round-trip structured data', () => {
    storage.setJSON('ss-obj', { x: [1, 2], y: 'z' });
    expect(storage.getJSON('ss-obj', null)).toEqual({ x: [1, 2], y: 'z' });
  });
});
