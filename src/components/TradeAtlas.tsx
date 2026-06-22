import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid,
} from 'recharts';
import type { TradeRecord } from '../types';
import type { Summary } from '../lib/metrics';
import {
  dailyEquityCurve,
  edgeByField,
  edgeByHour,
  pnlHistogram,
  groupByDay,
  formatMoney,
  formatMoneySigned,
  shortDate,
  longDate,
} from '../lib/metrics';

interface Props {
  trades: TradeRecord[];
  summary: Summary;
  onClose: () => void;
}

const AXIS = { stroke: '#9aa6ba', fontSize: 11, tickLine: false, axisLine: false };
const GRID = 'rgba(140,152,172,0.18)';
const POS = '#16a34a';
const NEG = '#e1483b';
const TOOLTIP = {
  contentStyle: { background: 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: 10, fontSize: 12, boxShadow: 'var(--shadow-md)', color: 'var(--text)' },
  labelStyle: { color: 'var(--muted)' },
  itemStyle: { color: 'var(--text)' },
  cursor: { fill: 'rgba(91,141,224,0.08)' },
};

export default function TradeAtlas({ trades, summary, onClose }: Props) {
  const equity = useMemo(() => dailyEquityCurve(trades), [trades]);
  const dailyBars = useMemo(
    () =>
      [...groupByDay(trades).values()]
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .map((d) => ({ date: d.date, pnl: d.pnl })),
    [trades]
  );
  const setupEdge = useMemo(
    () =>
      edgeByField(trades, (t) => t.setup)
        .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
        .slice(0, 8)
        .sort((a, b) => b.pnl - a.pnl),
    [trades]
  );
  const hourEdge = useMemo(() => edgeByHour(trades), [trades]);
  const histogram = useMemo(() => pnlHistogram(trades), [trades]);
  const tradePnls = useMemo(() => trades.map((t, i) => ({ i: i + 1, pnl: t.profitLoss })), [trades]);

  const donut = [
    { name: 'Wins', value: summary.winTrades, color: POS },
    { name: 'Losses', value: summary.lossTrades, color: NEG },
  ];

  const range =
    summary.firstDate && summary.lastDate
      ? `${longDate(summary.firstDate)} — ${longDate(summary.lastDate)}`
      : '';

  return (
    <div className="atlas">
      <div className="atlas-hero">
        <div>
          <span className="atlas-eyebrow">ANALYTICS · {range}</span>
          <h2>Trade Atlas</h2>
          <p className="atlas-sub">Performance, behavior, and trend review</p>
        </div>
        <button className="atlas-close" onClick={onClose}>Close</button>
      </div>

      <div className="kpi-row">
        <Kpi dot={NEG} label="Net P&L" value={formatMoneySigned(summary.totalPnl)} cls={summary.totalPnl >= 0 ? 'pos' : 'neg'} />
        <Kpi dot="#3b6fe0" label="Trades" value={String(summary.tradeCount)} />
        <Kpi dot={POS} label="Win Rate" value={`${(summary.winRateTrades * 100).toFixed(1)}%`} />
        <Kpi dot={summary.expectancy >= 0 ? POS : NEG} label="Avg Trade" value={formatMoneySigned(summary.tradeCount ? summary.totalPnl / summary.tradeCount : 0)} cls={summary.totalPnl >= 0 ? 'pos' : 'neg'} />
        <Kpi dot="#3b6fe0" label="Profit Factor" value={summary.profitFactor === Infinity ? '∞' : summary.profitFactor.toFixed(2)} />
        <Kpi dot={NEG} label="Max Drawdown" value={formatMoney(summary.maxDrawdown)} cls="neg" />
      </div>

      <div className="atlas-grid">
        <Panel title="Equity Curve" subtitle="Cumulative result by trading day" wide>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={equity}>
              <defs>
                <linearGradient id="atlEq" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b6fe0" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#3b6fe0" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="date" {...AXIS} minTickGap={50} tickFormatter={(d) => shortDate(String(d))} />
              <YAxis {...AXIS} />
              <Tooltip {...TOOLTIP} labelFormatter={(l) => shortDate(String(l))} formatter={(v) => [formatMoneySigned(Number(v)), 'Cumulative']} />
              <ReferenceLine y={0} stroke="var(--border-strong)" />
              <Area type="monotone" dataKey="cumulative" stroke="#3b6fe0" strokeWidth={2.5} fill="url(#atlEq)" />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Daily P&L" subtitle="Net result by trading day" wide>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyBars}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="date" {...AXIS} minTickGap={50} tickFormatter={(d) => shortDate(String(d))} />
              <YAxis {...AXIS} />
              <Tooltip {...TOOLTIP} labelFormatter={(l) => shortDate(String(l))} formatter={(v) => [formatMoneySigned(Number(v)), 'P&L']} />
              <ReferenceLine y={0} stroke="var(--border-strong)" />
              <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
                {dailyBars.map((d, i) => (
                  <Cell key={i} fill={d.pnl >= 0 ? POS : NEG} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Winning vs Losing" subtitle="Trade-count split">
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={donut} dataKey="value" innerRadius={58} outerRadius={84} paddingAngle={2} stroke="none">
                  {donut.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip {...TOOLTIP} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <span className="dc-value">{(summary.winRateTrades * 100).toFixed(0)}%</span>
              <span className="dc-label">Win rate</span>
            </div>
          </div>
          <div className="donut-legend">
            <span><i className="dot" style={{ background: POS }} /> Wins {summary.winTrades}</span>
            <span><i className="dot" style={{ background: NEG }} /> Losses {summary.lossTrades}</span>
          </div>
        </Panel>

        <Panel title="Setup Edge" subtitle="Top setup P&L distribution">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={setupEdge} layout="vertical" margin={{ left: 10, right: 10 }}>
              <XAxis type="number" {...AXIS} />
              <YAxis type="category" dataKey="key" {...AXIS} width={90} />
              <Tooltip {...TOOLTIP} formatter={(v) => [formatMoneySigned(Number(v)), 'P&L']} />
              <ReferenceLine x={0} stroke="var(--border-strong)" />
              <Bar dataKey="pnl" radius={[0, 4, 4, 0]} barSize={14}>
                {setupEdge.map((d, i) => (
                  <Cell key={i} fill={d.pnl >= 0 ? POS : NEG} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Time of Day Edge" subtitle="Net result by entry hour">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hourEdge}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="key" {...AXIS} />
              <YAxis {...AXIS} />
              <Tooltip {...TOOLTIP} formatter={(v) => [formatMoneySigned(Number(v)), 'P&L']} />
              <ReferenceLine y={0} stroke="var(--border-strong)" />
              <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
                {hourEdge.map((d, i) => (
                  <Cell key={i} fill={d.pnl >= 0 ? POS : NEG} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Trade-by-Trade P&L" subtitle="Result of each individual trade" wide>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={tradePnls}>
              <XAxis dataKey="i" {...AXIS} minTickGap={30} />
              <YAxis {...AXIS} />
              <Tooltip {...TOOLTIP} formatter={(v) => [formatMoneySigned(Number(v)), 'P&L']} labelFormatter={(l) => `Trade #${l}`} />
              <ReferenceLine y={0} stroke="var(--border-strong)" />
              <Bar dataKey="pnl">
                {tradePnls.map((d, i) => (
                  <Cell key={i} fill={d.pnl >= 0 ? POS : NEG} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="P&L Distribution" subtitle="Histogram of trade outcomes">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={histogram}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="label" {...AXIS} />
              <YAxis {...AXIS} />
              <Tooltip {...TOOLTIP} formatter={(v) => [Number(v), 'Trades']} />
              <Bar dataKey="count" fill="#3b6fe0" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Best / Worst Day" subtitle="Extremes of daily performance">
          <div className="bw-grid">
            <div className="bw-big win">
              <span className="bwb-label">▲ Best</span>
              <span className="bwb-value pos">{summary.bestDay ? formatMoneySigned(summary.bestDay.pnl) : '—'}</span>
              <span className="bwb-sub">{summary.bestDay ? `${shortDate(summary.bestDay.date)} · ${summary.bestDay.tradeCount} trades` : ''}</span>
            </div>
            <div className="bw-big loss">
              <span className="bwb-label">▼ Worst</span>
              <span className="bwb-value neg">{summary.worstDay ? formatMoneySigned(summary.worstDay.pnl) : '—'}</span>
              <span className="bwb-sub">{summary.worstDay ? `${shortDate(summary.worstDay.date)} · ${summary.worstDay.tradeCount} trades` : ''}</span>
            </div>
            <div className="bw-big win">
              <span className="bwb-label">▲ Best Trade</span>
              <span className="bwb-value pos">{summary.bestTrade ? formatMoneySigned(summary.bestTrade.profitLoss) : '—'}</span>
              <span className="bwb-sub">{summary.bestTrade ? `${shortDate(summary.bestTrade.date)} · ${summary.bestTrade.setup || '—'}` : ''}</span>
            </div>
            <div className="bw-big loss">
              <span className="bwb-label">▼ Worst Trade</span>
              <span className="bwb-value neg">{summary.worstTrade ? formatMoneySigned(summary.worstTrade.profitLoss) : '—'}</span>
              <span className="bwb-sub">{summary.worstTrade ? `${shortDate(summary.worstTrade.date)} · ${summary.worstTrade.setup || '—'}` : ''}</span>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children, wide }: { title: string; subtitle?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`atlas-panel${wide ? ' wide' : ''}`}>
      <div className="panel-head">
        <span className="panel-title">{title}</span>
        {subtitle && <span className="panel-sub">{subtitle}</span>}
      </div>
      <div className="panel-body">{children}</div>
    </div>
  );
}

function Kpi({ dot, label, value, cls }: { dot: string; label: string; value: string; cls?: string }) {
  return (
    <div className="kpi-card">
      <span className="kpi-label"><i className="dot" style={{ background: dot }} /> {label}</span>
      <span className={`kpi-value ${cls ?? ''}`}>{value}</span>
    </div>
  );
}

