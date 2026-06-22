import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid,
} from 'recharts';
import type { TradeRecord } from '../types';
import type { Summary } from '../lib/metrics';
import { useThemeColors } from '../lib/useThemeColors';
import {
  dailyEquityCurve,
  edgeByField,
  hourEdgeBySymbol,
  distinctSymbols,
  movingWinRate,
  pnlHistogram,
  groupByDay,
  formatMoney,
  compactMoney,
  formatMoneySigned,
  shortDate,
  longDate,
} from '../lib/metrics';

interface Props {
  trades: TradeRecord[];
  summary: Summary;
}

const AXIS = { stroke: '#9aa6ba', fontSize: 11, tickLine: false, axisLine: false };
const GRID = 'rgba(140,152,172,0.18)';
const TOOLTIP = {
  contentStyle: { background: 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: 10, fontSize: 12, boxShadow: 'var(--shadow-md)', color: 'var(--text)' },
  labelStyle: { color: 'var(--muted)' },
  itemStyle: { color: 'var(--text)' },
  cursor: { fill: 'rgba(120,140,170,0.10)' },
};

export default function TradeAtlas({ trades, summary }: Props) {
  const theme = useThemeColors();
  const POS = theme.pos;
  const NEG = theme.neg;
  const ACC = theme.accent;
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
  const symbols = useMemo(() => distinctSymbols(trades), [trades]);
  const [hourSymbol, setHourSymbol] = useState<string>(() => 'MES');
  const effectiveHourSymbol = useMemo(() => {
    if (hourSymbol === 'All') return 'All';
    return symbols.includes(hourSymbol) ? hourSymbol : (symbols.includes('MES') ? 'MES' : 'All');
  }, [hourSymbol, symbols]);
  const hourEdge = useMemo(() => hourEdgeBySymbol(trades, effectiveHourSymbol), [trades, effectiveHourSymbol]);
  const histogram = useMemo(() => pnlHistogram(trades), [trades]);
  const [maWindow, setMaWindow] = useState<number>(20);
  const maWinRate = useMemo(() => movingWinRate(trades, maWindow), [trades, maWindow]);
  const tradePnls = useMemo(() => trades.map((t, i) => ({ i: i + 1, pnl: t.profitLoss })), [trades]);

  // Offset (0–1 top→bottom) of the zero line within the equity range, for split green/red coloring.
  const eqMin = equity.length ? Math.min(...equity.map((e) => e.cumulative)) : 0;
  const eqMax = equity.length ? Math.max(...equity.map((e) => e.cumulative)) : 0;
  const eqZero = eqMax <= 0 ? 0 : eqMin >= 0 ? 1 : eqMax / (eqMax - eqMin);

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
        <div className="atlas-hero-head">
          <span className="atlas-eyebrow">ANALYTICS · {range}</span>
          <h2>Trade Atlas</h2>
          <p className="atlas-sub">Performance, behavior, and trend review</p>
        </div>
        <div className="kpi-row">
          <Kpi dot={NEG} label="Net P&L" value={formatMoneySigned(summary.totalPnl)} cls={summary.totalPnl >= 0 ? 'pos' : 'neg'} />
          <Kpi dot={ACC} label="Trades" value={String(summary.tradeCount)} />
          <Kpi dot={POS} label="Win Rate" value={`${(summary.winRateTrades * 100).toFixed(1)}%`} />
          <Kpi dot={summary.expectancy >= 0 ? POS : NEG} label="Avg Trade" value={formatMoneySigned(summary.tradeCount ? summary.totalPnl / summary.tradeCount : 0)} cls={summary.totalPnl >= 0 ? 'pos' : 'neg'} />
          <Kpi dot={ACC} label="Profit Factor" value={summary.profitFactor === Infinity ? '∞' : summary.profitFactor.toFixed(2)} />
          <Kpi dot={NEG} label="Max Drawdown" value={formatMoney(summary.maxDrawdown)} cls="neg" />
        </div>
      </div>

      <div className="atlas-grid">
        <Panel title="Equity Curve" subtitle="Cumulative result by trading day" span={3}>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={equity} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="atlEqStroke" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={eqZero} stopColor={POS} />
                  <stop offset={eqZero} stopColor={NEG} />
                </linearGradient>
                <linearGradient id="atlEqFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={POS} stopOpacity={0.28} />
                  <stop offset={eqZero} stopColor={POS} stopOpacity={0.04} />
                  <stop offset={eqZero} stopColor={NEG} stopOpacity={0.04} />
                  <stop offset="1" stopColor={NEG} stopOpacity={0.28} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="date" {...AXIS} minTickGap={50} tickFormatter={(d) => shortDate(String(d))} />
              <YAxis {...AXIS} width={50} tickFormatter={(v) => compactMoney(Number(v))} />
              <Tooltip {...TOOLTIP} labelFormatter={(l) => shortDate(String(l))} formatter={(v) => [formatMoneySigned(Number(v)), 'Cumulative']} />
              <ReferenceLine y={0} stroke="var(--border-strong)" />
              <Area type="monotone" dataKey="cumulative" stroke="url(#atlEqStroke)" strokeWidth={2.5} fill="url(#atlEqFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Daily P&L" subtitle="Net result by trading day" span={3}>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dailyBars} barCategoryGap="8%" margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="date" {...AXIS} minTickGap={50} tickFormatter={(d) => shortDate(String(d))} />
              <YAxis {...AXIS} width={50} tickFormatter={(v) => compactMoney(Number(v))} />
              <Tooltip {...TOOLTIP} labelFormatter={(l) => shortDate(String(l))} formatter={(v) => [formatMoneySigned(Number(v)), 'P&L']} />
              <ReferenceLine y={0} stroke="var(--border-strong)" />
              <Bar dataKey="pnl" radius={[2, 2, 0, 0]} maxBarSize={40}>
                {dailyBars.map((d, i) => (
                  <Cell key={i} fill={d.pnl >= 0 ? POS : NEG} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Setup Edge" subtitle="Top setup P&L distribution" span={3}>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={setupEdge} layout="vertical" margin={{ left: 6, right: 8, top: 4, bottom: 0 }}>
              <XAxis type="number" {...AXIS} />
              <YAxis type="category" dataKey="key" {...AXIS} width={80} />
              <Tooltip {...TOOLTIP} formatter={(v) => [formatMoneySigned(Number(v)), 'P&L']} />
              <ReferenceLine x={0} stroke="var(--border-strong)" />
              <Bar dataKey="pnl" radius={[0, 4, 4, 0]} barSize={11}>
                {setupEdge.map((d, i) => (
                  <Cell key={i} fill={d.pnl >= 0 ? POS : NEG} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel
          title="MA Win Rate"
          subtitle={`${maWindow}-trade rolling win rate (%)`}
          span={3}
          action={
            <select
              className="panel-select"
              value={maWindow}
              onChange={(e) => setMaWindow(Number(e.target.value))}
              aria-label="Moving average window size"
            >
              {[10, 20, 30, 50].map((w) => (
                <option key={w} value={w}>{w}-trade</option>
              ))}
            </select>
          }
        >
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={maWinRate} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="atlWr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACC} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={ACC} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="i" {...AXIS} minTickGap={30} />
              <YAxis {...AXIS} width={36} domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip {...TOOLTIP} formatter={(v) => [`${Number(v).toFixed(1)}%`, 'Win rate']} labelFormatter={(l) => `Trade #${l}`} />
              <ReferenceLine y={50} stroke="var(--border-strong)" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="rate" stroke={ACC} strokeWidth={2.5} fill="url(#atlWr)" />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel
          title="Hour of Day Edge"
          subtitle="Avg P&L per trade by entry hour, filtered by future"
          span={4}
          action={
            <select
              className="panel-select"
              value={effectiveHourSymbol}
              onChange={(e) => setHourSymbol(e.target.value)}
              aria-label="Filter hour-of-day edge by future"
            >
              <option value="All">All</option>
              {symbols.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          }
        >
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourEdge} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="key" {...AXIS} />
              <YAxis {...AXIS} width={48} tickFormatter={(v) => compactMoney(Number(v))} />
              <Tooltip
                {...TOOLTIP}
                formatter={(v) => [formatMoneySigned(Number(v)), 'Avg/trade']}
                labelFormatter={(l) => `${l} · ${hourEdge.find((h) => h.key === String(l))?.count ?? 0} trades`}
              />
              <ReferenceLine y={0} stroke="var(--border-strong)" />
              <Bar dataKey="avg" radius={[2, 2, 0, 0]} maxBarSize={22}>
                {hourEdge.map((d, i) => (
                  <Cell key={i} fill={d.avg >= 0 ? POS : NEG} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="P&L Distribution" subtitle="Histogram of trade outcomes" span={4}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={histogram} barCategoryGap="22%">
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="label" {...AXIS} />
              <YAxis {...AXIS} width={32} />
              <Tooltip {...TOOLTIP} formatter={(v) => [Number(v), 'Trades']} />
              <Bar dataKey="count" fill={ACC} radius={[3, 3, 0, 0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Winning vs Losing" subtitle="Trade-count split" span={4}>
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={donut} dataKey="value" innerRadius={54} outerRadius={78} paddingAngle={2} stroke="none">
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

        <Panel title="Trade-by-Trade P&L" subtitle="Result of each individual trade" span={12}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={tradePnls}>
              <XAxis dataKey="i" {...AXIS} minTickGap={30} />
              <YAxis {...AXIS} width={52} tickFormatter={(v) => compactMoney(Number(v))} />
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
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children, span = 3, action }: { title: string; subtitle?: string; children: React.ReactNode; span?: 3 | 4 | 6 | 12; action?: React.ReactNode }) {
  return (
    <div className={`atlas-panel span-${span}`}>
      <div className="panel-head">
        <span className="panel-title">{title}</span>
        {subtitle && (
          <span className="panel-info" data-tip={subtitle} role="note" aria-label={subtitle} tabIndex={0}>
            i
          </span>
        )}
        {action && <span className="panel-action">{action}</span>}
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

