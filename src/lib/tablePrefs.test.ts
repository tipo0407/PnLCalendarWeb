import { describe, it, expect } from 'vitest';
import { sanitizePrefs } from './tablePrefs';

describe('sanitizePrefs', () => {
  it('passes through valid prefs', () => {
    expect(sanitizePrefs({ sortKey: 'profitLoss', dir: 'asc' })).toEqual({ sortKey: 'profitLoss', dir: 'asc' });
  });
  it('falls back to defaults for invalid values', () => {
    expect(sanitizePrefs({ sortKey: 'bogus', dir: 'sideways' })).toEqual({ sortKey: 'date', dir: 'desc' });
    expect(sanitizePrefs(null)).toEqual({ sortKey: 'date', dir: 'desc' });
    expect(sanitizePrefs('nope')).toEqual({ sortKey: 'date', dir: 'desc' });
  });
  it('keeps a valid key while defaulting an invalid dir', () => {
    expect(sanitizePrefs({ sortKey: 'symbol', dir: 'x' })).toEqual({ sortKey: 'symbol', dir: 'desc' });
  });
});
