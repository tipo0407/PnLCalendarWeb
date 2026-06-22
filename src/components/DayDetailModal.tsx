import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { DailyPnl } from '../types';
import { formatMoney, formatMoneySigned, formatSeconds, longDate } from '../lib/metrics';
import DayChart from './DayChart';

interface Props {
  daily: DailyPnl;
  holidayName?: string;
  onClose: () => void;
}

export default function DayDetailModal({ daily, holidayName, onClose }: Props) {
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
            {holidayName && <span className="badge-holiday">🎌 {holidayName}</span>}
          </div>
          <button ref={closeRef} className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="modal-stats">
          <div className="ms">
            <span className="ms-label">Day P&amp;L</span>
            <span className={`ms-value ${daily.pnl >= 0 ? 'pos' : 'neg'}`}>{formatMoneySigned(daily.pnl)}</span>
          </div>
          <div className="ms">
            <span className="ms-label">Trades</span>
            <span className="ms-value">{daily.tradeCount}</span>
          </div>
          <div className="ms">
            <span className="ms-label">Win / Loss</span>
            <span className="ms-value">
              <span className="pos">{daily.wins}</span> / <span className="neg">{daily.losses}</span>
            </span>
          </div>
        </div>

        <DayChart date={daily.date} trades={daily.trades} />

        <div className="trade-table-wrap">
          <table className="trade-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Side</th>
                <th>Symbol</th>
                <th>Entry</th>
                <th>Exit</th>
                <th>Duration</th>
                <th>Entry $</th>
                <th>Exit $</th>
                <th>Size</th>
                <th>P&amp;L</th>
                <th>Setup</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {daily.trades.map((t) => (
                <tr key={t.rowNumber}>
                  <td>{t.tradeNumber}</td>
                  <td>
                    <span className={`side-pill ${/long/i.test(t.direction) ? 'long' : /short/i.test(t.direction) ? 'short' : ''}`}>
                      {t.direction || '—'}
                    </span>
                  </td>
                  <td>{t.symbol || '—'}</td>
                  <td>{formatSeconds(t.entryTime)}</td>
                  <td>{formatSeconds(t.exitTime)}</td>
                  <td>{formatSeconds(t.duration)}</td>
                  <td>{t.entryPrice || '—'}</td>
                  <td>{t.exitPrice || '—'}</td>
                  <td>{t.size || '—'}</td>
                  <td className={t.profitLoss >= 0 ? 'pos' : 'neg'}>{formatMoney(t.profitLoss)}</td>
                  <td>{t.setup || '—'}</td>
                  <td className="note-cell" title={t.note}>{t.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}
