// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  notificationsSupported, notificationsEnabled, alreadyNotified, notifyDailyReview,
} from './notifications';

// Minimal localStorage stub (node test environment has no DOM).
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

// Minimal Notification stub so the permission-gated logic can be exercised.
class FakeNotification {
  static permission: NotificationPermission = 'granted';
  static requestPermission = vi.fn(async () => 'granted' as NotificationPermission);
  static shown: string[] = [];
  title: string;
  constructor(title: string) {
    this.title = title;
    FakeNotification.shown.push(title);
  }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
  (globalThis as unknown as { window: unknown }).window = globalThis;
  (globalThis as unknown as { document: unknown }).document = { visibilityState: 'hidden' };
  FakeNotification.shown = [];
  FakeNotification.permission = 'granted';
  (globalThis as unknown as { Notification: unknown }).Notification = FakeNotification;
});

describe('notifications', () => {
  it('reports support when Notification exists', () => {
    expect(notificationsSupported()).toBe(true);
  });

  it('is disabled until explicitly opted in', () => {
    expect(notificationsEnabled()).toBe(false);
    localStorage.setItem('pnlcalendar.notify.enabled.v1', '1');
    expect(notificationsEnabled()).toBe(true);
  });

  it('shows a daily notification once and dedupes by day', () => {
    localStorage.setItem('pnlcalendar.notify.enabled.v1', '1');
    expect(notifyDailyReview('daily:2025-03-05', 'T', 'B')).toBe(true);
    expect(FakeNotification.shown).toHaveLength(1);
    expect(alreadyNotified('daily:2025-03-05')).toBe(true);
    // Second call for the same day is a no-op.
    expect(notifyDailyReview('daily:2025-03-05', 'T', 'B')).toBe(false);
    expect(FakeNotification.shown).toHaveLength(1);
  });

  it('does not notify when permission is not granted', () => {
    localStorage.setItem('pnlcalendar.notify.enabled.v1', '1');
    FakeNotification.permission = 'denied';
    expect(notifyDailyReview('daily:2025-03-06', 'T', 'B')).toBe(false);
  });
});
