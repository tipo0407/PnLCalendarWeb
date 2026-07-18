// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { applyAccent, setAccent, getAccentId, applyHighContrast, ACCENTS } from './theme';

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('style');
    document.documentElement.removeAttribute('data-contrast');
  });

  it('applies an accent preset as CSS variables on :root', () => {
    const violet = ACCENTS.find((a) => a.id === 'violet')!;
    applyAccent('violet');
    expect(document.documentElement.style.getPropertyValue('--accent').trim()).toBe(violet.accent);
    expect(document.documentElement.style.getPropertyValue('--accent-rgb').trim()).toBe(violet.rgb);
  });

  it('removes accent overrides for the default preset', () => {
    applyAccent('violet');
    applyAccent('default');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('');
  });

  it('persists the selected accent id', () => {
    setAccent('emerald');
    expect(getAccentId()).toBe('emerald');
  });

  it('toggles the high-contrast data attribute', () => {
    applyHighContrast(true);
    expect(document.documentElement.getAttribute('data-contrast')).toBe('high');
    applyHighContrast(false);
    expect(document.documentElement.hasAttribute('data-contrast')).toBe(false);
  });
});
