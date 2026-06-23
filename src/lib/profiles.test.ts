import { describe, it, expect } from 'vitest';
import { profileTradesKey, DEFAULT_PROFILE } from './profiles';

describe('profiles', () => {
  it('keeps the legacy trades key for the default profile', () => {
    expect(profileTradesKey(DEFAULT_PROFILE.id)).toBe('pnlcalendar.trades.v1');
  });
  it('namespaces non-default profiles', () => {
    expect(profileTradesKey('funded')).toBe('pnlcalendar.trades.v1::funded');
  });
});
