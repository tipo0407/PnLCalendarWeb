import { describe, it, expect, beforeEach } from 'vitest';
import { t, setLang, getLang } from './i18n';

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
});
