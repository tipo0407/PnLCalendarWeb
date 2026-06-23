import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, CalendarDays } from 'lucide-react';
import type { DailyPnl } from '../types';
import { formatMoneySigned, longDate } from '../lib/metrics';
import { dayDiscipline, disciplineColor } from '../lib/discipline';
import { t } from '../lib/i18n';
import { useLang } from '../lib/useLang';
import DayChart from './DayChart';
import TradeShots from './TradeShots';

interface Props {
  daily: DailyPnl;
  holidayName?: string;
  onClose: () => void;
}

export default function DayDetailModal({ daily, holidayName, onClose }: Props) {
  useLang();
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = `day-detail-${daily.date}`;

  useEffect(() => {
    // Close on Escape and lock background scroll while open.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Move focus into the dialog; restore it to the previously focused element on close.
    const prevFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prevFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <motion.div
      className="modal-overlay"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.94, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      >
        <div className="modal-head">
          <div className="modal-title">
            <h2 id={titleId}>{longDate(daily.date)}</h2>
            {holidayName && <span className="badge-holiday"><CalendarDays size={12} /> {holidayName}</span>}
          </div>
          <button ref={closeRef} className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="modal-stats">
          <div className="ms">
            <span className="ms-label">{t('modal.dayPnl')}</span>
            <span className={`ms-value ${daily.pnl >= 0 ? 'pos' : 'neg'}`}>{formatMoneySigned(daily.pnl)}</span>
          </div>
          <div className="ms">
            <span className="ms-label">{t('modal.trades')}</span>
            <span className="ms-value">{daily.tradeCount}</span>
          </div>
          <div className="ms">
            <span className="ms-label">{t('modal.winLoss')}</span>
            <span className="ms-value">
              <span className="pos">{daily.wins}</span> / <span className="neg">{daily.losses}</span>
            </span>
          </div>
          <div className="ms">
            <span className="ms-label">{t('modal.discipline')}</span>
            <span className="ms-value" style={{ color: disciplineColor(dayDiscipline(daily)) }}>
              {dayDiscipline(daily)}<span className="ms-unit">/100</span>
            </span>
          </div>
        </div>

        <div className="day-detail-body">
          <DayChart date={daily.date} trades={daily.trades} />
        </div>

        {daily.trades.length > 0 && <TradeShots daily={daily} />}
      </motion.div>
    </motion.div>
  );
}
