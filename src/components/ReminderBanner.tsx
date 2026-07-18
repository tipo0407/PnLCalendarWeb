import { useMemo, useState } from 'react';
import { Bell, X } from 'lucide-react';
import type { TradeRecord } from '../types';
import { formatMoneySigned } from '../lib/metrics';
import { nextReminder, loadDismissed, markDismissed, type Reminder } from '../lib/reminders';
import { t } from '../lib/i18n';
import { useLang } from '../lib/useLang';

interface Props {
  trades: TradeRecord[];
}

/**
 * A single dismissible, privacy-preserving nudge to journal the most recent
 * trading day. It never uses push notifications or the network — it just
 * inspects local trade history. Dismissals are remembered per day so it won't
 * nag twice.
 */
export default function ReminderBanner({ trades }: Props) {
  useLang();
  const [dismissed, setDismissed] = useState(0);

  const reminder = useMemo<Reminder | null>(() => {
    if (trades.length === 0) return null;
    void dismissed;

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

    const r = nextReminder({
      now: new Date(),
      lastTradeDate,
      lastTradePnl: lastDay.pnl,
      lastTradeCount: lastDay.count,
    });
    if (r && loadDismissed().has(r.dismissKey)) return null;
    return r;
  }, [trades, dismissed]);

  if (!reminder) return null;

  const message = t('remind.daily', { date: reminder.date!, pnl: formatMoneySigned(reminder.pnl), n: String(reminder.count) });

  function dismiss() {
    if (reminder) markDismissed(reminder.dismissKey);
    setDismissed((n) => n + 1);
  }

  return (
    <div className="reminder-banner is-daily" role="status" aria-live="polite">
      <span className="reminder-icon"><Bell size={15} /></span>
      <span className="reminder-text">{message}</span>
      <button className="reminder-action" onClick={() => { dismiss(); }}>
        {t('remind.journalIt')}
      </button>
      <button className="reminder-dismiss" onClick={dismiss} aria-label={t('remind.dismiss')} title={t('remind.dismiss')}>
        <X size={14} />
      </button>
    </div>
  );
}
