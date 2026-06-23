import { describe, it, expect, beforeEach } from 'vitest';
import { recordError, getErrors, clearErrors } from './logger';
import { saveSettings } from './settings';

describe('logger', () => {
  beforeEach(() => { clearErrors(); });

  it('does not record when logging is disabled', () => {
    saveSettings({ errorLogging: false });
    recordError('boom');
    expect(getErrors()).toHaveLength(0);
  });

  it('records when opted in and caps the buffer', () => {
    saveSettings({ errorLogging: true });
    for (let i = 0; i < 25; i++) recordError(`err ${i}`);
    const errs = getErrors();
    expect(errs.length).toBeLessThanOrEqual(20);
    expect(errs[0].message).toBe('err 24'); // newest first
    saveSettings({ errorLogging: false });
  });
});
