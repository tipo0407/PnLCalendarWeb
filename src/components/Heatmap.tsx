import { useMemo } from 'react';
import type { DailyPnl } from '../types';
import { formatMoneySigned, shortDate } from '../lib/metrics';
import { t } from '../lib/i18n';
import { useLang } from '../lib/useLang';

interface Props {
  dailyMap: Map<string, DailyPnl>;
  year: number;
  onSelectMonth: (year: number, month: number) => void;
}

function iso(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate()
  ).padStart(2, '0')}`;
}

function color(pnl: number, max: number): string {
  if (max === 0) return 'var(--card-soft)';
  const intensity = Math.min(1, Math.abs(pnl) / max);
  const a = 0.12 + Math.pow(intensity, 1.35) * 0.74;
  return pnl >= 0 ? `rgba(var(--pos-rgb), ${a})` : `rgba(var(--neg-rgb), ${a})`;
}

const ROW_KEYS = ['weekday.mon', 'weekday.tue', 'weekday.wed', 'weekday.thu', 'weekday.fri'];

export default function Heatmap({ dailyMap, year, onSelectMonth }: Props) {
  const lang = useLang();
  const { columns, max, monthMarkers } = useMemo(() => {
    void lang;
    // Start at the Monday on/before Jan 1.
    const start = new Date(Date.UTC(year, 0, 1));
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    const end = new Date(Date.UTC(year, 11, 31));

    const columns: (Date | null)[][] = [];
    const monthMarkers: { col: number; label: string }[] = [];
    const cursor = new Date(start);
    let lastMonth = -1;
    let colIdx = 0;
    while (cursor <= end) {
      const col: (Date | null)[] = [];
      for (let wd = 0; wd < 5; wd++) {
        const day = new Date(cursor);
        day.setUTCDate(cursor.getUTCDate() + wd);
        const inYear = day.getUTCFullYear() === year;
        col.push(inYear ? day : null);
        if (inYear && day.getUTCMonth() !== lastMonth && day.getUTCDate() <= 7) {
          monthMarkers.push({ col: colIdx, label: t(`month.short.${day.getUTCMonth()}`) });
          lastMonth = day.getUTCMonth();
        }
      }
      columns.push(col);
      cursor.setUTCDate(cursor.getUTCDate() + 7);
      colIdx++;
    }

    let max = 0;
    for (const [date, d] of dailyMap) {
      if (date.startsWith(`${year}-`)) max = Math.max(max, Math.abs(d.pnl));
    }
    return { columns, max, monthMarkers };
  }, [dailyMap, year, lang]);

  return (
    <div className="heatmap-card">
      <div className="heatmap-body">
        <div className="hm-rowlabels">
          {ROW_KEYS.map((l) => (
            <span key={l} className="hm-rowlabel">{t(l)}</span>
          ))}
        </div>
        <div className="hm-right">
          <div
            className="hm-months"
            style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}
          >
            {monthMarkers.map((m) => (
              <span key={m.col} className="hm-month-label" style={{ gridColumnStart: m.col + 1 }}>
                {m.label}
              </span>
            ))}
          </div>
          <div className="hm-grid">
            {columns.map((col, ci) => (
              <div key={ci} className="hm-col">
                {col.map((day, ri) => {
                  if (!day) return <div key={ri} className="hm-cell hm-blank" />;
                  const date = iso(day);
                  const d = dailyMap.get(date);
                  return (
                    <div
                      key={ri}
                      className={`hm-cell${d ? ' hm-active' : ''}`}
                      style={d ? { background: color(d.pnl, max) } : undefined}
                      title={d ? `${shortDate(date)} · ${formatMoneySigned(d.pnl)} · ${t('cal.tradesCount', { n: d.tradeCount })}` : shortDate(date)}
                      onClick={() => onSelectMonth(day.getUTCFullYear(), day.getUTCMonth())}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
