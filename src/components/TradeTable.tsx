import { useEffect, useMemo, useState } from 'react';
import { ArrowUp, ArrowDown, Search, Download, Tag, Plus } from 'lucide-react';
import type { TradeRecord } from '../types';
import { formatMoneySigned, formatMoney, shortDate } from '../lib/metrics';
import { getSettings } from '../lib/settings';
import { getTablePrefs, saveTablePrefs } from '../lib/tablePrefs';
import { downloadText, tradesToCsv } from '../lib/exportCsv';
import { detectTags, allMistakeTags } from '../lib/tags';
import { tradeTagKey, getTradeTags, toggleTag } from '../lib/userTags';
import { t } from '../lib/i18n';

type SortKey = 'date' | 'symbol' | 'direction' | 'size' | 'profitLoss' | 'setup';

function hhmm(secs: number | null): string {
  if (secs == null) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const MAX_ROWS = 1000;

export default function TradeTable({ trades, onSelectDay }: { trades: TradeRecord[]; onSelectDay: (date: string) => void }) {
  const [sortKey, setSortKey] = useState<SortKey>(() => getTablePrefs().sortKey);
  const [dir, setDir] = useState<'asc' | 'desc'>(() => getTablePrefs().dir);
  const [q, setQ] = useState('');
  const risk = getSettings().riskPerTrade;

  // Persist the sort preference (per active profile) so it survives reloads.
  useEffect(() => { saveTablePrefs({ sortKey, dir }); }, [sortKey, dir]);

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
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('tt.filter')} aria-label="Filter trades" />
        </div>
        <span className="ttable-count">{rows.length} trade{rows.length === 1 ? '' : 's'}{rows.length > MAX_ROWS && ` · showing ${MAX_ROWS}`}</span>
        <button
          className="ttable-export"
          onClick={() => downloadText(`trades-filtered-${new Date().toISOString().slice(0, 10)}.csv`, tradesToCsv(rows), 'text/csv')}
          disabled={rows.length === 0}
          title={t('tt.exportTitle')}
        >
          <Download size={13} /> {t('tt.export')}
        </button>
      </div>
      <div className="ttable-scroll">
        <table className="ttable-grid">
          <thead>
            <tr>
              <Th label={t('tt.date')} k="date" cur={sortKey} Caret={Caret} onClick={sortBy} />
              <th>{t('tt.time')}</th>
              <Th label={t('tt.symbol')} k="symbol" cur={sortKey} Caret={Caret} onClick={sortBy} />
              <Th label={t('tt.side')} k="direction" cur={sortKey} Caret={Caret} onClick={sortBy} />
              <Th label={t('tt.size')} k="size" cur={sortKey} Caret={Caret} onClick={sortBy} num />
              <Th label={t('tt.pnl')} k="profitLoss" cur={sortKey} Caret={Caret} onClick={sortBy} num />
              {risk > 0 && <th className="tt-num">{t('tt.r')}</th>}
              <Th label={t('tt.setup')} k="setup" cur={sortKey} Caret={Caret} onClick={sortBy} />
              <th>{t('tt.tags')}</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={risk > 0 ? 9 : 8} className="ttable-empty">No matching trades.</td></tr>}
            {shown.map((t, i) => (
              <tr key={`${t.date}-${t.rowNumber}-${i}`} onClick={() => onSelectDay(t.date)} className="ttable-row">
                <td>{shortDate(t.date)}</td>
                <td className="tt-dim">{hhmm(t.entryTime)}</td>
                <td className="tt-strong">{t.symbol || '—'}</td>
                <td>{t.direction || '—'}</td>
                <td className="tt-num">{t.size || ''}</td>
                <td className={`tt-num ${t.profitLoss >= 0 ? 'pos' : 'neg'}`}>{formatMoneySigned(t.profitLoss)}</td>
                {risk > 0 && <td className={`tt-num ${t.profitLoss >= 0 ? 'pos' : 'neg'}`}>{(t.profitLoss / risk).toFixed(2)}R</td>}
                <td className="tt-dim">{t.setup || ''}</td>
                <td className="tt-tags-cell" onClick={(e) => e.stopPropagation()}><RowTags trade={t} /></td>
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
                {risk > 0 && <td />}
                <td />
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

/** Compact, inline mistake-tagging for one trade row (manual tags + quick menu). */
function RowTags({ trade }: { trade: TradeRecord }) {
  const key = tradeTagKey(trade.date, trade.tradeNumber, trade.rowNumber);
  const [tags, setTags] = useState(() => getTradeTags(key));
  const [open, setOpen] = useState(false);

  // Auto-detected mistakes (from notes) shown read-only; manual tags are toggleable.
  const auto = useMemo(() => new Set(detectTags(trade)), [trade]);
  const defs = allMistakeTags();
  const labelOf = new Map(defs.map((d) => [d.key, d.label]));

  function flip(tagKey: string) { setTags(toggleTag(key, 'mistake', tagKey)); }

  const manual = tags.mistakes;
  const shownAuto = [...auto].filter((k) => !manual.includes(k));

  return (
    <span className="rt-wrap">
      {manual.map((m) => (
        <button key={`m-${m}`} className="rt-chip on" onClick={() => flip(m)} title={t('tt.removeTag')}>{labelOf.get(m) ?? m}</button>
      ))}
      {shownAuto.map((m) => (
        <span key={`a-${m}`} className="rt-chip auto" title={t('tt.autoTag')}>{labelOf.get(m) ?? m}</span>
      ))}
      <span className="rt-pop-wrap">
        <button className={`rt-add ${open ? 'on' : ''}`} onClick={() => setOpen((o) => !o)} title={t('tt.addTag')}>
          {manual.length || shownAuto.length ? <Plus size={11} /> : <><Tag size={11} /> {t('tt.tag')}</>}
        </button>
        {open && (
          <span className="rt-pop" onMouseLeave={() => setOpen(false)}>
            {defs.map((d) => (
              <button
                key={d.key}
                className={`rt-pop-item ${manual.includes(d.key) ? 'on' : ''}`}
                onClick={() => flip(d.key)}
              >
                {d.label}
              </button>
            ))}
          </span>
        )}
      </span>
    </span>
  );
}

