import { describe, it, expect, beforeEach } from 'vitest';
import { isValidKey, activatePro, deactivatePro, getPlan, isPro, DEMO_KEY } from './plan';

describe('plan', () => {
  beforeEach(() => {
    deactivatePro();
  });

  it('accepts the demo key and well-formed license keys', () => {
    expect(isValidKey(DEMO_KEY)).toBe(true);
    expect(isValidKey('pnlcal-ab12-cd34')).toBe(true);
    expect(isValidKey('PNLCAL-ABCD-EFGH-IJKL')).toBe(true);
  });

  it('rejects malformed keys', () => {
    expect(isValidKey('')).toBe(false);
    expect(isValidKey('FREE-1234')).toBe(false);
    expect(isValidKey('PNLCAL-ABC')).toBe(false);
  });

  it('activates and deactivates pro', () => {
    expect(getPlan()).toBe('free');
    expect(activatePro(DEMO_KEY)).toBe(true);
    expect(isPro()).toBe(true);
    deactivatePro();
    expect(isPro()).toBe(false);
  });

  it('refuses to activate with an invalid key', () => {
    expect(activatePro('nope')).toBe(false);
    expect(isPro()).toBe(false);
  });
});
