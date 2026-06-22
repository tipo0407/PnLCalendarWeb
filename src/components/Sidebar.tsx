import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { TradeRecord } from '../types';
import type { Summary } from '../lib/metrics';
import {
  monthlyBreakdown,
  dailyEquityCurve,
  groupByDay,
  formatMoney,
  formatMoneySigned,
  shortDate,
} from '../lib/metrics';

interface Props {
  trades: TradeRecord[];
  summary: Summary;
  onJumpMonth: (year: number, month: number) => void;
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function isoWeekLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayNum = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((dt.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7
    );
  return `W${week} · ${dt.getUTCFullYear()}`;
}

function weekKey(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return iso(dt);
}
function iso(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export default function Sidebar({ trades, summary, onJumpMonth }: Props) {
  const months = useMemo(() => monthlyBreakdown(trades), [trades]);
  const equity = useMemo(() => dailyEquityCurve(trades), [trades]);

  const bestWeek = useMemo(() => {
    const map = new Map<string, { sample: string; pnl: number }>();
    for (const d of groupByDay(trades).values()) {
      const k = weekKey(d.date);
      const cur = map.get(k) ?? { sample: d.date, pnl: 0 };
      cur.pnl += d.pnl;
      map.set(k, cur);
    }
    let best: { sample: string; pnl: number } | null = null;
    for (const v of map.values()) if (!best || v.pnl > best.pnl) best = v;
    return best;
  }, [trades]);

  const year = summary.lastDate ? Number(summary.lastDate.slice(0, 4)) : new Date().getFullYear();
  const maxMonthAbs = Math.max(1, ...months.map((m) => Math.abs(m.pnl)));
  const winRate = summary.winRateDays;
  const positive = summary.totalPnl >= 0;
  const lineColor = positive ? '#16a34a' : '#e1483b';

  return (
    <aside className="sidebar">
      <div className="lens-head">
        <span className="lens-title">PORTFOLIO LENS</span>
        <span className="lens-year">{year}</span>
      </div>

      <div className={`total-card ${positive ? 'pos' : 'neg'}`}>
        <span className="tc-label">TOTAL P&amp;L</span>
        <span className="tc-value">{formatMoneySigned(summary.totalPnl)}</span>
        <div className="tc-meta">
          <span>{summary.tradingDays} traded days</span>
          <span>{summary.tradeCount} trades total</span>
        </div>
        <span className="tc-since">{summary.daysSinceFirst} days since first trade</span>
      </div>

      <div className="lens-block">
        <span className="lens-section">MONTHLY BREAKDOWN</span>
        <div className="month-bars">
          {months.map((m) => {
            const ratio = Math.abs(m.pnl) / maxMonthAbs;
            const pos = m.pnl >= 0;
            return (
              <button
                key={`${m.year}-${m.month}`}
                className="month-row"
                onClick={() => onJumpMonth(m.year, m.month)}
                title={`${MONTH_SHORT[m.month]} ${m.year} · ${m.tradeCount} trades`}
              >
                <span className="month-name">{MONTH_SHORT[m.month]}</span>
                <span className="month-track">
                  <span className="month-center" />
                  <span
                    className={`month-fill ${pos ? 'pos' : 'neg'}`}
                    style={pos ? { left: '50%', width: `${ratio * 50}%` } : { right: '50%', width: `${ratio * 50}%` }}
                  />
                </span>
                <span className={`month-val ${pos ? 'pos' : 'neg'}`}>{formatMoneySigned(m.pnl)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="lens-block">
        <span className="lens-section">STATISTICS</span>
        <div className="stat-pair">
          <div className="stat-card win">
            <span className="sc-label">Win Days</span>
            <span className="sc-value">{summary.winDays}</span>
          </div>
          <div className="stat-card loss">
            <span className="sc-label">Loss Days</span>
            <span className="sc-value">{summary.lossDays}</span>
          </div>
        </div>
        <div className="winrate">
          <div className="winrate-top">
            <span>Win Rate</span>
            <span className="winrate-pct">{pct(winRate)}</span>
          </div>
          <div className="winrate-bar">
            <div className="winrate-fill" style={{ width: pct(winRate) }} />
          </div>
        </div>
        <div className="stat-pair">
          <div className="bw-card win">
            <span className="sc-label">Best Day</span>
            <span className="sc-value pos">{summary.bestDay ? formatMoneySigned(summary.bestDay.pnl) : '—'}</span>
            <span className="sc-sub">{summary.bestDay ? shortDate(summary.bestDay.date) : ''}</span>
          </div>
          <div className="bw-card loss">
            <span className="sc-label">Worst Day</span>
            <span className="sc-value neg">{summary.worstDay ? formatMoneySigned(summary.worstDay.pnl) : '—'}</span>
            <span className="sc-sub">{summary.worstDay ? shortDate(summary.worstDay.date) : ''}</span>
          </div>
        </div>
      </div>

      <div className="lens-block">
        <span className="lens-section">INSIGHTS</span>
        <div className="insight-grid">
          <Insight label="Avg Win" value={formatMoneySigned(summary.avgWin)} cls="pos" />
          <Insight label="Avg Loss" value={formatMoneySigned(-summary.avgLoss)} cls="neg" />
          <Insight
            label="Best Week"
            value={bestWeek ? formatMoneySigned(bestWeek.pnl) : '—'}
            sub={bestWeek ? isoWeekLabel(bestWeek.sample) : ''}
            cls="pos"
          />
          <Insight
            label="Profit Factor"
            value={summary.profitFactor === Infinity ? '∞' : summary.profitFactor.toFixed(2)}
            cls={summary.profitFactor >= 1 ? 'pos' : 'neg'}
          />
          <Insight label="Expectancy" value={formatMoneySigned(summary.expectancy)} cls={summary.expectancy >= 0 ? 'pos' : 'neg'} />
          <Insight label="Max Drawdown" value={formatMoney(summary.maxDrawdown)} cls="neg" />
        </div>
      </div>

      <div className="lens-block">
        <span className="lens-section">EQUITY CURVE</span>
        <div className="lens-equity">
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={equity} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: 10, fontSize: 12, boxShadow: 'var(--shadow-md)', color: 'var(--text)' }}
                labelStyle={{ color: 'var(--muted)' }}
                itemStyle={{ color: 'var(--text)' }}
                labelFormatter={(l) => shortDate(String(l))}
                formatter={(v) => [formatMoneySigned(Number(v)), 'Cumulative']}
              />
              <ReferenceLine y={0} stroke="var(--border-strong)" strokeDasharray="3 3" />
              <Area type="monotone" dataKey="cumulative" stroke={lineColor} strokeWidth={2} fill="url(#eqGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </aside>
  );
}

function Insight({ label, value, sub, cls }: { label: string; value: string; sub?: string; cls?: string }) {
  return (
    <div className="insight">
      <span className="insight-label">{label}</span>
      <span className={`insight-value ${cls ?? ''}`}>{value}</span>
      {sub && <span className="insight-sub">{sub}</span>}
    </div>
  );
}
