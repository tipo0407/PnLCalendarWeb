import { useEffect, useState } from 'react';
import { HardDriveDownload, X } from 'lucide-react';
import type { TradeRecord } from '../types';
import { backupNudgeDue, snoozeBackup } from '../lib/backupReminder';
import { exportBackup } from '../lib/backup';
import { t } from '../lib/i18n';
import { useLang } from '../lib/useLang';

const FIRST_SEEN_KEY = 'pnlcalendar.firstSeen.v1';

function firstSeen(): number {
  try {
    const v = localStorage.getItem(FIRST_SEEN_KEY);
    if (v) return Number(v);
    const now = Date.now();
    localStorage.setItem(FIRST_SEEN_KEY, String(now));
    return now;
  } catch {
    return Date.now();
  }
}

interface Props {
  trades: TradeRecord[];
  signedIn: boolean;
  sampleMode: boolean;
}

/**
 * A gentle, dismissible nudge to export a local backup when the user is
 * local-only (not cloud-synced) and hasn't backed up recently — so a cleared
 * browser doesn't wipe their journal.
 */
export default function BackupReminderBanner({ trades, signedIn, sampleMode }: Props) {
  useLang();
  const [gone, setGone] = useState(false);

  useEffect(() => { void firstSeen(); }, []);

  if (gone || sampleMode || trades.length === 0) return null;
  if (!backupNudgeDue(true, signedIn, firstSeen())) return null;

  return (
    <div className="reminder-banner is-backup" role="status" aria-live="polite">
      <span className="reminder-icon"><HardDriveDownload size={15} /></span>
      <span className="reminder-text">{t('backup.nudge')}</span>
      <button className="reminder-action" onClick={async () => { await exportBackup(trades); setGone(true); }}>
        {t('backup.now')}
      </button>
      <button className="reminder-dismiss" onClick={() => { snoozeBackup(7); setGone(true); }} aria-label={t('backup.snooze')} title={t('backup.snooze')}>
        <X size={14} />
      </button>
    </div>
  );
}
