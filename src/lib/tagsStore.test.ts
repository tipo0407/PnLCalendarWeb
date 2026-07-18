import { describe, it, expect } from 'vitest';
import { addCustomTag, getCustomTags, removeCustomTag, renameCustomTag } from './customTags';
import { setTradeTags, getTradeTags, toggleTag, hasAnyUserTags, replaceAllUserTags } from './userTags';

describe('customTags', () => {
  it('adds, dedupes by label, renames and removes custom tags', () => {
    const def = addCustomTag('mistake', 'Chased Entry');
    expect(def.label).toBe('Chased Entry');
    // Same label (case-insensitive) returns the existing def instead of duplicating.
    const again = addCustomTag('mistake', 'chased entry');
    expect(again.key).toBe(def.key);
    expect(getCustomTags().mistakes.some((d) => d.key === def.key)).toBe(true);

    renameCustomTag('mistake', def.key, 'Chased');
    expect(getCustomTags().mistakes.find((d) => d.key === def.key)!.label).toBe('Chased');

    removeCustomTag('mistake', def.key);
    expect(getCustomTags().mistakes.some((d) => d.key === def.key)).toBe(false);
  });
});

describe('userTags', () => {
  it('sets, toggles and clears per-trade tags', () => {
    replaceAllUserTags({});
    setTradeTags('2025-01-01#1', { mistakes: ['fomo'], emotions: [] });
    expect(getTradeTags('2025-01-01#1').mistakes).toEqual(['fomo']);
    expect(hasAnyUserTags()).toBe(true);

    const after = toggleTag('2025-01-01#1', 'mistake', 'fomo'); // removes it
    expect(after.mistakes).not.toContain('fomo');

    replaceAllUserTags({});
    expect(hasAnyUserTags()).toBe(false);
  });
});
