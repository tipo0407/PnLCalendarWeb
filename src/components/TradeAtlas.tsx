import { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart, Area,
  ComposedChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid,
} from 'recharts';
import type { TradeRecord } from '../types';
import type { Summary } from '../lib/metrics';
import { useThemeColors } from '../lib/useThemeColors';
import { useUserTags } from '../lib/useUserTags';
import { tagEdge, taggedTradeCount } from '../lib/tags';
import { emotionEdge } from '../lib/emotions';
import { riskStats, drawdownSeries } from '../lib/risk';
import { getSettings } from '../lib/settings';
import { exportTradesCsv } from '../lib/exportCsv';
import { t } from '../lib/i18n';
import { useLang } from '../lib/useLang';
import ProGate from './ProGate';
import Playbook from './Playbook';
import TradeTable from './TradeTable';
import RulesPanel from './RulesPanel';
import {
  dailyEquityCurve,
  edgeByField,
  hourEdgeBySymbol,
  distinctSymbols,
  movingWinRate,
  pnlHistogram,
  monthlyBreakdown,
  dayOfWeekEdge,
  holdTimeEdge,
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
  onOpenSettings?: () => void;
  onSelectDay?: (date: string) => void;
}

const AXIS = { stroke: '#9aa6ba', fontSize: 11, tickLine: false, axisLine: false };
const GRID = 'rgba(140,152,172,0.18)';
const TOOLTIP = {
  contentStyle: { background: 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: 10, fontSize: 12, boxShadow: 'var(--shadow-md)', color: 'var(--text)' },
  labelStyle: { color: 'var(--muted)' },
  itemStyle: { color: 'var(--text)' },
  cursor: { fill: 'rgba(120,140,170,0.10)' },
};

/** Print just the Trade Atlas as a PDF via a scoped print stylesheet. */
function printAtlas() {
  document.body.classList.add('printing-atlas');
  const cleanup = () => {
    document.body.classList.remove('printing-atlas');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
  setTimeout(cleanup, 1000);
}

export default function TradeAtlas({ trades, summary, onOpenSettings, onSelectDay }: Props) {
  useLang(); // re-render on language change
  const theme = useThemeColors();
  const POS = theme.pos;
  const NEG = theme.neg;
  const ACC = theme.accent;
  const equity = useMemo(() => dailyEquityCurve(trades), [trades]);  const dailyBars = useMemo(
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
  const dowEdge = useMemo(() => dayOfWeekEdge(trades), [trades]);
  const holdEdge = useMemo(() => holdTimeEdge(trades), [trades]);
  const [maWindow, setMaWindow] = useState<number>(20);
  const maWinRate = useMemo(() => movingWinRate(trades, maWindow), [trades, maWindow]);
  const tradePnls = useMemo(() => trades.map((t, i) => ({ i: i + 1, pnl: t.profitLoss })), [trades]);
  const userTags = useUserTags();
  const mistakes = useMemo(() => tagEdge(trades, userTags), [trades, userTags]);
  const taggedCount = useMemo(() => taggedTradeCount(trades, userTags), [trades, userTags]);
  const emotions = useMemo(() => emotionEdge(trades, userTags), [trades, userTags]);

  const { accountSize, riskPerTrade, monthlyGoal } = getSettings();
  const risk = useMemo(() => riskStats(trades, accountSize, riskPerTrade), [trades, accountSize, riskPerTrade]);
  const ddSeries = useMemo(() => drawdownSeries(trades, accountSize), [trades, accountSize]);
  const ddKey = risk.hasAccount ? 'drawdownPct' : 'drawdown';

  const showTarget = monthlyGoal > 0;
  const equityData = useMemo(() => {
    if (!showTarget) return equity;
    const dailyTarget = monthlyGoal / 21; // ~business days per month
    return equity.map((p, i) => ({ ...p, target: (i + 1) * dailyTarget }));
  }, [equity, showTarget, monthlyGoal]);

  const monthlyGoalData = useMemo(() => {
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthlyBreakdown(trades).map((m) => ({
      label: `${MON[m.month]} '${String(m.year).slice(2)}`,
      pnl: m.pnl,
    }));
  }, [trades]);

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
        <div className="atlas-actions">
          <button className="atlas-export" onClick={() => exportTradesCsv(trades)} title="Download all trades as CSV">
            <Download size={14} /> CSV
          </button>
          <button className="atlas-export" onClick={printAtlas} title="Export this report as PDF">
            <Printer size={14} /> PDF
          </button>
        </div>
        <div className="kpi-row">
          <Kpi dot={NEG} label={t('atlas.netPnl')} value={formatMoneySigned(summary.totalPnl)} cls={summary.totalPnl >= 0 ? 'pos' : 'neg'} />
          <Kpi dot={ACC} label={t('atlas.trades')} value={String(summary.tradeCount)} />
          <Kpi dot={POS} label={t('atlas.winRate')} value={`${(summary.winRateTrades * 100).toFixed(1)}%`} />
          <Kpi dot={summary.expectancy >= 0 ? POS : NEG} label={t('atlas.avgTrade')} value={formatMoneySigned(summary.tradeCount ? summary.totalPnl / summary.tradeCount : 0)} cls={summary.totalPnl >= 0 ? 'pos' : 'neg'} />
          <Kpi dot={ACC} label={t('atlas.profitFactor')} value={summary.profitFactor === Infinity ? '∞' : summary.profitFactor.toFixed(2)} />
          <Kpi dot={NEG} label={t('atlas.maxDD')} value={formatMoney(summary.maxDrawdown)} cls="neg" />
        </div>
      </div>

      <div className="atlas-grid">
        <Panel title="Equity Curve" subtitle={showTarget ? 'Cumulative result vs goal pace' : 'Cumulative result by trading day'} span={3}>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={equityData} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
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
              <Tooltip {...TOOLTIP} labelFormatter={(l) => shortDate(String(l))} formatter={(v, n) => [formatMoneySigned(Number(v)), n === 'target' ? 'Goal pace' : 'Cumulative']} />
              <ReferenceLine y={0} stroke="var(--border-strong)" />
              <Area type="monotone" dataKey="cumulative" stroke="url(#atlEqStroke)" strokeWidth={2.5} fill="url(#atlEqFill)" />
              {showTarget && <Line type="monotone" dataKey="target" stroke={ACC} strokeWidth={1.5} strokeDasharray="5 4" dot={false} />}
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>

        <Panel
          title="Monthly Goal Tracking"
          subtitle={monthlyGoal > 0 ? 'Net P&L per month vs your goal' : 'Net P&L per month'}
          span={6}
          action={monthlyGoal <= 0 && onOpenSettings
            ? <button className="atlas-link" onClick={onOpenSettings}>Set a monthly goal →</button>
            : undefined}
        >
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyGoalData} barCategoryGap="22%">
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="label" {...AXIS} minTickGap={10} />
              <YAxis {...AXIS} width={50} tickFormatter={(v) => compactMoney(Number(v))} />
              <Tooltip {...TOOLTIP} formatter={(v) => [formatMoneySigned(Number(v)), 'Net']} />
              <ReferenceLine y={0} stroke="var(--border-strong)" />
              {monthlyGoal > 0 && (
                <ReferenceLine y={monthlyGoal} stroke={ACC} strokeDasharray="5 4" label={{ value: 'Goal', position: 'insideTopRight', fill: ACC, fontSize: 11 }} />
              )}
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]} maxBarSize={46}>
                {monthlyGoalData.map((d, i) => (
                  <Cell key={i} fill={d.pnl >= 0 ? POS : NEG} />
                ))}
              </Bar>
            </BarChart>
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

        <Panel title="Day of Week Edge" subtitle="Net P&L by weekday" span={6}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dowEdge} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="key" {...AXIS} />
              <YAxis {...AXIS} width={48} tickFormatter={(v) => compactMoney(Number(v))} />
              <Tooltip
                {...TOOLTIP}
                formatter={(v) => [formatMoneySigned(Number(v)), 'Net']}
                labelFormatter={(l) => {
                  const g = dowEdge.find((x) => x.key === String(l));
                  return g ? `${l} · ${g.count} trades · ${(g.winRate * 100).toFixed(0)}% win` : String(l);
                }}
              />
              <ReferenceLine y={0} stroke="var(--border-strong)" />
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]} maxBarSize={40}>
                {dowEdge.map((d, i) => (
                  <Cell key={i} fill={d.pnl >= 0 ? POS : NEG} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Hold-Time Edge" subtitle="Net P&L by trade duration" span={6}>
          <ProGate feature="Hold-Time Edge">
            {holdEdge.length === 0 ? (
              <div className="atlas-empty">No trade durations found. Map a <b>Duration</b> column on import to see which hold-times pay.</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={holdEdge} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="key" {...AXIS} />
                  <YAxis {...AXIS} width={48} tickFormatter={(v) => compactMoney(Number(v))} />
                  <Tooltip
                    {...TOOLTIP}
                    formatter={(v) => [formatMoneySigned(Number(v)), 'Net']}
                    labelFormatter={(l) => {
                      const g = holdEdge.find((x) => x.key === String(l));
                      return g ? `${l} · ${g.count} trades · ${(g.winRate * 100).toFixed(0)}% win` : String(l);
                    }}
                  />
                  <ReferenceLine y={0} stroke="var(--border-strong)" />
                  <Bar dataKey="pnl" radius={[3, 3, 0, 0]} maxBarSize={40}>
                    {holdEdge.map((d, i) => (
                      <Cell key={i} fill={d.pnl >= 0 ? POS : NEG} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ProGate>
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

        <Panel
          title="Mistake Edge"
          subtitle={`P&L by behavioral mistake auto-detected from your notes · ${taggedCount}/${trades.length} trades tagged`}
          span={6}
        >
          {mistakes.length === 0 ? (
            <div className="atlas-empty">
              No mistakes detected yet. Note what went wrong in <b>Reason&amp;Emotion</b> or
              <b> Note</b> (e.g. “FOMO”, “revenge”, “no stop”, “追高”, “手痒”) to see where your
              behavior costs you.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(150, mistakes.length * 34)}>
              <BarChart data={mistakes} layout="vertical" margin={{ left: 6, right: 16, top: 4, bottom: 0 }}>
                <XAxis type="number" {...AXIS} tickFormatter={(v) => compactMoney(Number(v))} />
                <YAxis type="category" dataKey="label" {...AXIS} width={96} />
                <Tooltip
                  {...TOOLTIP}
                  formatter={(v) => [formatMoneySigned(Number(v)), 'Impact']}
                  labelFormatter={(l) => {
                    const m = mistakes.find((x) => x.label === String(l));
                    return m ? `${l} · ${m.count} trades · ${(m.winRate * 100).toFixed(0)}% win` : String(l);
                  }}
                />
                <ReferenceLine x={0} stroke="var(--border-strong)" />
                <Bar dataKey="pnl" radius={[0, 4, 4, 0]} barSize={16}>
                  {mistakes.map((d, i) => (
                    <Cell key={i} fill={d.pnl >= 0 ? POS : NEG} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel
          title="Emotion Edge"
          subtitle="P&L by emotional state detected in your notes"
          span={6}
        >
          <ProGate feature="Emotion Edge">
          {emotions.length === 0 ? (
            <div className="atlas-empty">
              No emotions detected yet. Jot how you felt in <b>Reason&amp;Emotion</b>
              (e.g. “confident”, “fearful”, “greedy”, “手痒”, “犹豫”) to see which states pay.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(150, emotions.length * 34)}>
              <BarChart data={emotions} layout="vertical" margin={{ left: 6, right: 16, top: 4, bottom: 0 }}>
                <XAxis type="number" {...AXIS} tickFormatter={(v) => compactMoney(Number(v))} />
                <YAxis type="category" dataKey="label" {...AXIS} width={110} />
                <Tooltip
                  {...TOOLTIP}
                  formatter={(v) => [formatMoneySigned(Number(v)), 'Impact']}
                  labelFormatter={(l) => {
                    const m = emotions.find((x) => x.label === String(l));
                    return m ? `${l} · ${m.count} trades · ${(m.winRate * 100).toFixed(0)}% win` : String(l);
                  }}
                />
                <ReferenceLine x={0} stroke="var(--border-strong)" />
                <Bar dataKey="pnl" radius={[0, 4, 4, 0]} barSize={16}>
                  {emotions.map((d, i) => (
                    <Cell key={i} fill={d.pnl >= 0 ? POS : NEG} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          </ProGate>
        </Panel>

        <Panel
          title="Risk & Drawdown"
          subtitle={risk.hasAccount ? 'Underwater equity (% of account peak)' : 'Underwater equity (account currency)'}
          span={12}
          action={(!risk.hasAccount || !risk.hasRisk) && onOpenSettings
            ? <button className="atlas-link" onClick={onOpenSettings}>Set account &amp; risk →</button>
            : undefined}
        >
          <ProGate feature="Risk & Drawdown">
          <div className="risk-tiles">
            <RiskTile label="Max Drawdown" value={formatMoney(risk.maxDrawdown)} sub={risk.hasAccount ? `${risk.maxDrawdownPct.toFixed(1)}%` : undefined} cls="neg" />
            <RiskTile label="Current Drawdown" value={formatMoney(risk.currentDrawdown)} cls={risk.currentDrawdown < 0 ? 'neg' : 'pos'} />
            <RiskTile label="Return on Account" value={risk.hasAccount ? `${risk.returnPct >= 0 ? '+' : ''}${risk.returnPct.toFixed(1)}%` : '—'} cls={risk.returnPct >= 0 ? 'pos' : 'neg'} />
            <RiskTile label="Avg R / trade" value={risk.hasRisk ? `${risk.avgR >= 0 ? '+' : ''}${risk.avgR.toFixed(2)}R` : '—'} cls={risk.avgR >= 0 ? 'pos' : 'neg'} />
            <RiskTile label="Total R" value={risk.hasRisk ? `${risk.totalR >= 0 ? '+' : ''}${risk.totalR.toFixed(1)}R` : '—'} cls={risk.totalR >= 0 ? 'pos' : 'neg'} />
            <RiskTile label="Best / Worst R" value={risk.hasRisk ? `${risk.bestR.toFixed(1)} / ${risk.worstR.toFixed(1)}` : '—'} />
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={ddSeries} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="atlDdFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={NEG} stopOpacity={0.05} />
                  <stop offset="1" stopColor={NEG} stopOpacity={0.35} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="date" {...AXIS} minTickGap={50} tickFormatter={(d) => shortDate(String(d))} />
              <YAxis {...AXIS} width={50} tickFormatter={(v) => risk.hasAccount ? `${Number(v).toFixed(0)}%` : compactMoney(Number(v))} />
              <Tooltip {...TOOLTIP} labelFormatter={(l) => shortDate(String(l))} formatter={(v) => [risk.hasAccount ? `${Number(v).toFixed(1)}%` : formatMoney(Number(v)), 'Drawdown']} />
              <ReferenceLine y={0} stroke="var(--border-strong)" />
              <Area type="monotone" dataKey={ddKey} stroke={NEG} strokeWidth={2} fill="url(#atlDdFill)" />
            </AreaChart>
          </ResponsiveContainer>
          </ProGate>
        </Panel>

        <Panel
          title="Playbook"
          subtitle="Per-setup expectancy, plus an editable entry checklist and notes"
          span={12}
        >
          <ProGate feature="Playbook">
            <Playbook trades={trades} />
          </ProGate>
        </Panel>

        <Panel
          title="Rule Adherence"
          subtitle="Set your rules; see how often you broke them and what it cost"
          span={12}
        >
          <RulesPanel trades={trades} />
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

        <Panel title="All Trades" subtitle="Sortable, filterable trade log — click a row to open the day" span={12}>
          <TradeTable trades={trades} onSelectDay={onSelectDay ?? (() => {})} />
        </Panel>
      </div>
    </div>
  );
}

function RiskTile({ label, value, sub, cls }: { label: string; value: string; sub?: string; cls?: string }) {
  return (
    <div className="risk-tile">
      <span className="risk-tile-label">{label}</span>
      <span className={`risk-tile-value ${cls ?? ''}`}>{value}{sub && <small> · {sub}</small>}</span>
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

