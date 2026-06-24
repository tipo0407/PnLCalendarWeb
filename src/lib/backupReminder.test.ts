import { describe, it, expect } from 'vitest';
import { shouldNudgeBackup } from './backupReminder';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_000_000_000_000;

const base = {
  hasTrades: true,
  signedIn: false,
  lastBackup: null as number | null,
  firstSeen: NOW - 10 * DAY,
  snoozeUntil: 0,
  now: NOW,
};

describe('shouldNudgeBackup', () => {
  it('nudges after the grace period when never backed up', () => {
    expect(shouldNudgeBackup(base)).toBe(true);
  });

  it('does not nudge within the grace period', () => {
    expect(shouldNudgeBackup({ ...base, firstSeen: NOW - 1 * DAY })).toBe(false);
  });

  it('nudges when last backup is older than the interval', () => {
    expect(shouldNudgeBackup({ ...base, lastBackup: NOW - 20 * DAY })).toBe(true);
    expect(shouldNudgeBackup({ ...base, lastBackup: NOW - 5 * DAY })).toBe(false);
  });

  it('never nudges signed-in (cloud-synced) users or when no trades', () => {
    expect(shouldNudgeBackup({ ...base, signedIn: true })).toBe(false);
    expect(shouldNudgeBackup({ ...base, hasTrades: false })).toBe(false);
  });

  it('respects an active snooze', () => {
    expect(shouldNudgeBackup({ ...base, snoozeUntil: NOW + 2 * DAY })).toBe(false);
  });
});
