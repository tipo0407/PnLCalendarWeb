import { useEffect, useMemo, useState } from 'react';
import { Bell, BellRing, X } from 'lucide-react';
import type { TradeRecord } from '../types';
import { groupByWeek, weekLabel, weekKeyOf } from '../lib/review';
import { isReviewed, REVIEW_LOG_EVENT } from '../lib/reviewLog';
import { getSettings } from '../lib/settings';
import { formatMoneySigned } from '../lib/metrics';
import { nextReminder, loadDismissed, markDismissed, type Reminder } from '../lib/reminders';
import {
  notificationsSupported, notificationsEnabled, enableNotifications, disableNotifications, notifyDailyReview,
} from '../lib/notifications';
import { t } from '../lib/i18n';
import { useLang } from '../lib/useLang';

interface Props {
  trades: TradeRecord[];
  sampleMode: boolean;
  onReview: () => void;
}

/**
 * A single dismissible, privacy-preserving review nudge. It never uses push
 * notifications or the network — it just inspects local trade history and
 * surfaces an in-app reminder to journal the most recent day or review last
 * week. Dismissals are remembered per day/week so it won't nag twice.
 */
export default function ReminderBanner({ trades, sampleMode, onReview }: Props) {
  useLang();
  const [tick, setTick] = useState(0);
  const [dismissed, setDismissed] = useState(0);
  const [notifyOn, setNotifyOn] = useState(() => notificationsEnabled());

  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    window.addEventListener(REVIEW_LOG_EVENT, bump);
    return () => window.removeEventListener(REVIEW_LOG_EVENT, bump);
  }, []);

  const reminder = useMemo<Reminder | null>(() => {
    if (sampleMode || trades.length === 0) return null;
    void tick; void dismissed;

    // Most recent trading day.
    const byDate = new Map<string, { pnl: number; count: number }>();
    for (const tr of trades) {
      const e = byDate.get(tr.date) ?? { pnl: 0, count: 0 };
      e.pnl += tr.profitLoss; e.count += 1;
      byDate.set(tr.date, e);
    }
    const dates = [...byDate.keys()].sort();
    const lastTradeDate = dates.length ? dates[dates.length - 1] : null;
    const lastDay = lastTradeDate ? byDate.get(lastTradeDate)! : { pnl: 0, count: 0 };

    // Most recently completed week (exclude the in-progress current week).
    const weekStart = getSettings().weekStart;
    const nowKey = weekKeyOf(new Date().toISOString().slice(0, 10), weekStart);
    const weeks = groupByWeek(trades).filter((w) => w.key < nowKey);
    const lastWeek = weeks[0] ?? null;
    let lastWeekPnl = 0, winDays = 0, totalDays = 0;
    if (lastWeek) {
      const days = new Map<string, number>();
      for (const tr of lastWeek.trades) days.set(tr.date, (days.get(tr.date) ?? 0) + tr.profitLoss);
      for (const v of days.values()) { lastWeekPnl += v; totalDays++; if (v > 0) winDays++; }
    }

    const r = nextReminder({
      now: new Date(),
      lastTradeDate,
      lastTradePnl: lastDay.pnl,
      lastTradeCount: lastDay.count,
      lastWeekKey: lastWeek?.key ?? null,
      lastWeekPnl,
      lastWeekWinRate: totalDays ? winDays / totalDays : 0,
      lastWeekReviewed: lastWeek ? isReviewed(lastWeek.key) : true,
    });
    if (r && loadDismissed().has(r.dismissKey)) return null;
    return r;
  }, [trades, sampleMode, tick, dismissed]);

  // Fire a one-per-day OS notification for the daily nudge (no-op unless opted in
  // and the tab is in the background). Placed before any early return so the hook
  // order stays stable.
  useEffect(() => {
    if (!notifyOn || !reminder || reminder.kind !== 'daily-review') return;
    const body = t('remind.daily', {
      date: reminder.date!, pnl: formatMoneySigned(reminder.pnl), n: String(reminder.count),
    });
    notifyDailyReview(reminder.dismissKey, t('remind.notifyTitle'), body);
  }, [notifyOn, reminder]);

  if (!reminder) return null;

  const isWeekly = reminder.kind === 'weekly-summary';
  const message = isWeekly
    ? t('remind.weekly', {
        week: weekLabel(reminder.weekKey!),
        pnl: formatMoneySigned(reminder.pnl),
        rate: String(Math.round(reminder.winRate * 100)),
      })
    : t('remind.daily', { date: reminder.date!, pnl: formatMoneySigned(reminder.pnl), n: String(reminder.count) });

  function dismiss() {
    if (reminder) markDismissed(reminder.dismissKey);
    setDismissed((n) => n + 1);
  }

  async function toggleNotify() {
    if (notifyOn) { disableNotifications(); setNotifyOn(false); }
    else { setNotifyOn(await enableNotifications()); }
  }

  return (
    <div className={`reminder-banner ${isWeekly ? 'is-weekly' : 'is-daily'}`} role="status" aria-live="polite">
      <span className="reminder-icon"><Bell size={15} /></span>
      <span className="reminder-text">{message}</span>
      {notificationsSupported() && (
        <button
          className={`reminder-bell ${notifyOn ? 'on' : ''}`}
          onClick={toggleNotify}
          title={notifyOn ? t('remind.notifyOff') : t('remind.notifyOn')}
          aria-label={notifyOn ? t('remind.notifyOff') : t('remind.notifyOn')}
        >
          {notifyOn ? <BellRing size={14} /> : <Bell size={14} />}
        </button>
      )}
      <button className="reminder-action" onClick={() => { onReview(); dismiss(); }}>
        {isWeekly ? t('remind.reviewWeek') : t('remind.journalIt')}
      </button>
      <button className="reminder-dismiss" onClick={dismiss} aria-label={t('remind.dismiss')} title={t('remind.dismiss')}>
        <X size={14} />
      </button>
    </div>
  );
}
