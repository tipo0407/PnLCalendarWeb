import { useMemo, useState } from 'react';
import { ArrowUp, ArrowDown, Search } from 'lucide-react';
import type { TradeRecord } from '../types';
import { formatMoneySigned, formatMoney, shortDate } from '../lib/metrics';

type SortKey = 'date' | 'symbol' | 'direction' | 'size' | 'profitLoss' | 'setup';

function hhmm(secs: number | null): string {
  if (secs == null) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const MAX_ROWS = 200;

export default function TradeTable({ trades, onSelectDay }: { trades: TradeRecord[]; onSelectDay: (date: string) => void }) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = trades;
    if (query) {
      list = trades.filter((t) =>
        `${t.symbol} ${t.setup} ${t.reasonEmotion} ${t.direction} ${t.date}`.toLowerCase().includes(query),
      );
    }
    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'date': cmp = a.date < b.date ? -1 : a.date > b.date ? 1 : (a.entryTime ?? 0) - (b.entryTime ?? 0); break;
        case 'symbol': cmp = a.symbol.localeCompare(b.symbol); break;
        case 'direction': cmp = a.direction.localeCompare(b.direction); break;
        case 'size': cmp = a.size - b.size; break;
        case 'profitLoss': cmp = a.profitLoss - b.profitLoss; break;
        case 'setup': cmp = a.setup.localeCompare(b.setup); break;
      }
      return dir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [trades, q, sortKey, dir]);

  function sortBy(key: SortKey) {
    if (key === sortKey) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setDir(key === 'profitLoss' || key === 'date' ? 'desc' : 'asc'); }
  }

  const shown = rows.slice(0, MAX_ROWS);
  const Caret = dir === 'asc' ? ArrowUp : ArrowDown;

  return (
    <div className="ttable">
      <div className="ttable-bar">
        <div className="ttable-search">
          <Search size={14} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by symbol, setup, note…" aria-label="Filter trades" />
        </div>
        <span className="ttable-count">{rows.length} trade{rows.length === 1 ? '' : 's'}{rows.length > MAX_ROWS && ` · showing ${MAX_ROWS}`}</span>
      </div>
      <div className="ttable-scroll">
        <table className="ttable-grid">
          <thead>
            <tr>
              <Th label="Date" k="date" cur={sortKey} Caret={Caret} onClick={sortBy} />
              <th>Time</th>
              <Th label="Symbol" k="symbol" cur={sortKey} Caret={Caret} onClick={sortBy} />
              <Th label="Side" k="direction" cur={sortKey} Caret={Caret} onClick={sortBy} />
              <Th label="Size" k="size" cur={sortKey} Caret={Caret} onClick={sortBy} num />
              <Th label="P&L" k="profitLoss" cur={sortKey} Caret={Caret} onClick={sortBy} num />
              <Th label="Setup" k="setup" cur={sortKey} Caret={Caret} onClick={sortBy} />
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={7} className="ttable-empty">No matching trades.</td></tr>}
            {shown.map((t, i) => (
              <tr key={`${t.date}-${t.rowNumber}-${i}`} onClick={() => onSelectDay(t.date)} className="ttable-row">
                <td>{shortDate(t.date)}</td>
                <td className="tt-dim">{hhmm(t.entryTime)}</td>
                <td className="tt-strong">{t.symbol || '—'}</td>
                <td>{t.direction || '—'}</td>
                <td className="tt-num">{t.size || ''}</td>
                <td className={`tt-num ${t.profitLoss >= 0 ? 'pos' : 'neg'}`}>{formatMoneySigned(t.profitLoss)}</td>
                <td className="tt-dim">{t.setup || ''}</td>
              </tr>
            ))}
          </tbody>
          {shown.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={5} className="tt-foot-label">Total ({rows.length})</td>
                <td className={`tt-num ${rows.reduce((s, t) => s + t.profitLoss, 0) >= 0 ? 'pos' : 'neg'}`}>
                  {formatMoney(rows.reduce((s, t) => s + t.profitLoss, 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function Th({ label, k, cur, Caret, onClick, num }: {
  label: string; k: SortKey; cur: SortKey; Caret: typeof ArrowUp; onClick: (k: SortKey) => void; num?: boolean;
}) {
  return (
    <th className={`${num ? 'tt-num' : ''} ttable-th`} onClick={() => onClick(k)}>
      <span className="ttable-th-inner">{label}{cur === k && <Caret size={12} />}</span>
    </th>
  );
}
