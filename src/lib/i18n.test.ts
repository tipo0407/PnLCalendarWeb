import { describe, it, expect, beforeEach } from 'vitest';
import { t, setLang, getLang, getDict } from './i18n';

describe('i18n', () => {
  beforeEach(() => { setLang('en'); });

  it('returns English by default', () => {
    expect(getLang()).toBe('en');
    expect(t('tab.atlas')).toBe('Trade Atlas');
  });

  it('switches to Chinese', () => {
    setLang('zh');
    expect(t('tab.calendar')).toBe('日历');
    expect(t('settings.currency')).toBe('货币');
  });

  it('falls back to the key for unknown strings', () => {
    expect(t('does.not.exist')).toBe('does.not.exist');
  });

  it('interpolates {params}', () => {
    // Uses fallback string (the key) but still interpolates.
    expect(t('Hello {name}', { name: 'World' })).toBe('Hello World');
  });

  it('has full en/zh parity (every key translated both ways)', () => {
    const en = Object.keys(getDict('en')).sort();
    const zh = Object.keys(getDict('zh')).sort();
    const missingInZh = en.filter((k) => !zh.includes(k));
    const missingInEn = zh.filter((k) => !en.includes(k));
    expect(missingInZh).toEqual([]);
    expect(missingInEn).toEqual([]);
  });
});

