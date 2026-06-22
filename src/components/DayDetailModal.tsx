import type { DailyPnl } from '../types';
import { formatMoney, formatMoneySigned, formatSeconds, longDate } from '../lib/metrics';

interface Props {
  daily: DailyPnl;
  holidayName?: string;
  onClose: () => void;
}

export default function DayDetailModal({ daily, holidayName, onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">
            <h2>{longDate(daily.date)}</h2>
            {holidayName && <span className="badge-holiday">🎌 {holidayName}</span>}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
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
      </div>
    </div>
  );
}
