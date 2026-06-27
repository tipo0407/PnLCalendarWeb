import { useMemo, useState } from 'react';
import { Download, Printer, FileSpreadsheet } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart, Area,
  ComposedChart,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid,
} from 'recharts';
import type { TradeRecord } from '../types';
import type { Summary } from '../lib/metrics';
import { useThemeColors } from '../lib/useThemeColors';
import { useUserTags } from '../lib/useUserTags';
import { findLeaks } from '../lib/leaks';
import { exportTradesCsv, downloadText } from '../lib/exportCsv';
import { taxSummaryCsv } from '../lib/taxSummary';
import { t } from '../lib/i18n';
import { useLang } from '../lib/useLang';
import {
  dailyEquityCurve,
  edgeByField,
  hourEdgeBySymbol,
  distinctSymbols,
  movingWinRate,
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

export default function TradeAtlas({ trades, summary }: Props) {
  const lang = useLang(); // re-render on language change
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
  const hourEdge = useMemo(
    () => hourEdgeBySymbol(trades, effectiveHourSymbol).map((h) => ({ ...h, key: `${h.hour % 12 === 0 ? 12 : h.hour % 12}${h.hour < 12 ? 'am' : 'pm'}` })),
    [trades, effectiveHourSymbol],
  );
  const dowEdge = useMemo(() => {
    void lang;
    return dayOfWeekEdge(trades).map((d) => ({ ...d, key: weekdayLabel(d.key) }));
  }, [trades, lang]);
  const holdEdge = useMemo(() => holdTimeEdge(trades), [trades]);
  const [maWindow, setMaWindow] = useState<number>(20);
  const maWinRate = useMemo(() => movingWinRate(trades, maWindow), [trades, maWindow]);
  const tradePnls = useMemo(() => trades.map((t, i) => ({ i: i + 1, pnl: t.profitLoss })), [trades]);
  const userTags = useUserTags();
  const leaks = useMemo(() => findLeaks(trades, userTags), [trades, userTags]);

  const monthlyData = useMemo(() => {
    void lang;
    return monthlyBreakdown(trades).map((m) => ({
      label: `${t(`month.short.${m.month}`)} '${String(m.year).slice(2)}`,
      pnl: m.pnl,
    }));
  }, [trades, lang]);

  // Offset (0–1 top→bottom) of the zero line within the equity range, for split green/red coloring.
  const eqMin = equity.length ? Math.min(...equity.map((e) => e.cumulative)) : 0;
  const eqMax = equity.length ? Math.max(...equity.map((e) => e.cumulative)) : 0;
  const eqZero = eqMax <= 0 ? 0 : eqMin >= 0 ? 1 : eqMax / (eqMax - eqMin);

  const donut = [
    { name: t('atlas.wins'), value: summary.winTrades, color: POS },
    { name: t('atlas.losses'), value: summary.lossTrades, color: NEG },
  ];

  const range =
    summary.firstDate && summary.lastDate
      ? `${longDate(summary.firstDate)} — ${longDate(summary.lastDate)}`
      : '';

  return (
    <div className="atlas">
      <div className="atlas-hero">
        <div className="atlas-hero-head">
          <span className="atlas-eyebrow">{t('atlas.eyebrow')} · {range}</span>
          <h2>{t('tab.atlas')}</h2>
          <p className="atlas-sub">{t('atlas.sub')}</p>
        </div>
        <div className="atlas-actions">
          <button className="atlas-export" onClick={() => exportTradesCsv(trades)} title={t('atlas.exportCsvTitle')}>
            <Download size={14} /> {t('common.csv')}
          </button>
          <button className="atlas-export" onClick={() => downloadText(`pnl-tax-summary-${new Date().toISOString().slice(0, 10)}.csv`, taxSummaryCsv(trades), 'text/csv')} title={t('atlas.taxTitle')}>
            <FileSpreadsheet size={14} /> {t('atlas.tax')}
          </button>
          <button className="atlas-export" onClick={printAtlas} title={t('atlas.exportPdfTitle')}>
            <Printer size={14} /> {t('common.pdf')}
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
        <Panel title={t('panel.equity')} subtitle={t('atlas.cumulative')} span={3}>
          <ResponsiveContainer width="100%" height={158}>
            <ComposedChart data={equity} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
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
              <Tooltip {...TOOLTIP} labelFormatter={(l) => shortDate(String(l))} formatter={(v) => [formatMoneySigned(Number(v)), t('atlas.cumulative')]} />
              <ReferenceLine y={0} stroke="var(--border-strong)" />
              <Area type="monotone" dataKey="cumulative" stroke="url(#atlEqStroke)" strokeWidth={2.5} fill="url(#atlEqFill)" />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>

        <Panel
          title={t('atlas.monthlyPnl')}
          subtitle={t('atlas.monthlyPnlSub')}
          span={3}
        >
          <ResponsiveContainer width="100%" height={168}>
            <BarChart data={monthlyData} barCategoryGap="22%">
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="label" {...AXIS} minTickGap={10} />
              <YAxis {...AXIS} width={50} tickFormatter={(v) => compactMoney(Number(v))} />
              <Tooltip {...TOOLTIP} formatter={(v) => [formatMoneySigned(Number(v)), t('atlas.net')]} />
              <ReferenceLine y={0} stroke="var(--border-strong)" />
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]} maxBarSize={46}>
                {monthlyData.map((d, i) => (
                  <Cell key={i} fill={d.pnl >= 0 ? POS : NEG} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title={t('panel.dailyPnl')} subtitle={t('atlas.dailyPnlSub')} span={3}>
          <ResponsiveContainer width="100%" height={158}>
            <BarChart data={dailyBars} barCategoryGap="8%" margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="date" {...AXIS} minTickGap={50} tickFormatter={(d) => shortDate(String(d))} />
              <YAxis {...AXIS} width={50} tickFormatter={(v) => compactMoney(Number(v))} />
              <Tooltip {...TOOLTIP} labelFormatter={(l) => shortDate(String(l))} formatter={(v) => [formatMoneySigned(Number(v)), t('tt.pnl')]} />
              <ReferenceLine y={0} stroke="var(--border-strong)" />
              <Bar dataKey="pnl" radius={[2, 2, 0, 0]} maxBarSize={40}>
                {dailyBars.map((d, i) => (
                  <Cell key={i} fill={d.pnl >= 0 ? POS : NEG} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title={t('panel.setupEdge')} subtitle={t('atlas.setupEdgeSub')} span={3}>
          <ResponsiveContainer width="100%" height={158}>
            <BarChart data={setupEdge} layout="vertical" margin={{ left: 6, right: 8, top: 4, bottom: 0 }}>
              <XAxis type="number" {...AXIS} />
              <YAxis type="category" dataKey="key" {...AXIS} width={80} />
              <Tooltip {...TOOLTIP} formatter={(v) => [formatMoneySigned(Number(v)), t('tt.pnl')]} />
              <ReferenceLine x={0} stroke="var(--border-strong)" />
              <Bar dataKey="pnl" radius={[0, 4, 4, 0]} barSize={11}>
                {setupEdge.map((d, i) => (
                  <Cell key={i} fill={d.pnl >= 0 ? POS : NEG} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title={t('panel.dowEdge')} subtitle={t('atlas.dowEdgeSub')} span={3}>
          <ResponsiveContainer width="100%" height={168}>
            <BarChart data={dowEdge} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="key" {...AXIS} />
              <YAxis {...AXIS} width={48} tickFormatter={(v) => compactMoney(Number(v))} />
              <Tooltip
                {...TOOLTIP}
                formatter={(v) => [formatMoneySigned(Number(v)), t('atlas.net')]}
                labelFormatter={(l) => {
                  const g = dowEdge.find((x) => x.key === String(l));
                  return g ? `${l} · ${t('atlas.tradesWin', { n: g.count, pct: (g.winRate * 100).toFixed(0) })}` : String(l);
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

        <Panel title={t('panel.holdEdge')} subtitle={t('atlas.holdEdgeSub')} span={3}>
            {holdEdge.length === 0 ? (
              <div className="atlas-empty">{t('atlas.holdEmpty')}</div>
            ) : (
              <ResponsiveContainer width="100%" height={168}>
                <BarChart data={holdEdge} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="key" {...AXIS} />
                  <YAxis {...AXIS} width={48} tickFormatter={(v) => compactMoney(Number(v))} />
                  <Tooltip
                    {...TOOLTIP}
                    formatter={(v) => [formatMoneySigned(Number(v)), t('atlas.net')]}
                    labelFormatter={(l) => {
                      const g = holdEdge.find((x) => x.key === String(l));
                      return g ? `${l} · ${t('atlas.tradesWin', { n: g.count, pct: (g.winRate * 100).toFixed(0) })}` : String(l);
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
        </Panel>

        <Panel
          title={t('panel.hourEdge')}
          subtitle={t('atlas.hourEdgeSub')}
          span={3}
          action={
            <select
              className="panel-select"
              value={effectiveHourSymbol}
              onChange={(e) => setHourSymbol(e.target.value)}
              aria-label={t('atlas.hourFilterAria')}
            >
              <option value="All">{t('common.all')}</option>
              {symbols.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          }
        >
          <ResponsiveContainer width="100%" height={168}>
            <BarChart data={hourEdge} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="key" {...AXIS} />
              <YAxis {...AXIS} width={48} tickFormatter={(v) => compactMoney(Number(v))} />
              <Tooltip
                {...TOOLTIP}
                formatter={(v) => [formatMoneySigned(Number(v)), t('atlas.avgTradeTooltip')]}
                labelFormatter={(l) => `${l} · ${t('cal.tradesCount', { n: hourEdge.find((h) => h.key === String(l))?.count ?? 0 })}`}
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

        <Panel title={t('atlas.winningLosing')} subtitle={t('atlas.winningLosingSub')} span={3}>
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height={168}>
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
              <span className="dc-label">{t('atlas.winRate')}</span>
            </div>
          </div>
          <div className="donut-legend">
            <span><i className="dot" style={{ background: POS }} /> {t('atlas.wins')} {summary.winTrades}</span>
            <span><i className="dot" style={{ background: NEG }} /> {t('atlas.losses')} {summary.lossTrades}</span>
          </div>
        </Panel>

        <Panel
          title={t('atlas.maWinRate')}
          subtitle={t('atlas.maWinRateSub', { n: maWindow })}
          span={6}
          action={
            <select
              className="panel-select"
              value={maWindow}
              onChange={(e) => setMaWindow(Number(e.target.value))}
              aria-label={t('atlas.maWindowAria')}
            >
              {[10, 20, 30, 50].map((w) => (
                <option key={w} value={w}>{t('atlas.nTrade', { n: w })}</option>
              ))}
            </select>
          }
        >
          <ResponsiveContainer width="100%" height="100%" minHeight={158}>
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
              <Tooltip {...TOOLTIP} formatter={(v) => [`${Number(v).toFixed(1)}%`, t('atlas.winRate')]} labelFormatter={(l) => t('atlas.tradeN', { n: l })} />
              <ReferenceLine y={50} stroke="var(--border-strong)" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="rate" stroke={ACC} strokeWidth={2.5} fill="url(#atlWr)" />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title={t('panel.leaks')} subtitle={t('panel.leaksSub')} span={6}>
            {leaks.length === 0 ? (
              <div className="atlas-empty">{t('leaks.empty')}</div>
            ) : (
              <ul className="leak-list">
                {leaks.map((l) => (
                  <li key={`${l.dimension}-${l.value}`} className="leak-row">
                    <span className="leak-rank">{Math.round(l.shareOfLosses * 100)}%</span>
                    <span className="leak-main">
                      <span className="leak-dim">{l.dimensionLabel}</span>
                      <span className="leak-val">{l.value}</span>
                    </span>
                    <span className="leak-meta">{t('atlas.leakMeta', { count: l.count, win: Math.round(l.winRate * 100), avg: formatMoneySigned(l.avg) })}</span>
                    <span className="leak-net neg">{formatMoneySigned(l.net)}</span>
                    <span className="leak-bar"><span className="leak-bar-fill" style={{ width: `${Math.round(l.shareOfLosses * 100)}%` }} /></span>
                  </li>
                ))}
              </ul>
            )}
        </Panel>

        <Panel title={t('panel.tbt')} subtitle={t('atlas.tbtSub')} span={12}>
          <ResponsiveContainer width="100%" height={168}>
            <BarChart data={tradePnls}>
              <XAxis dataKey="i" {...AXIS} minTickGap={30} />
              <YAxis {...AXIS} width={52} tickFormatter={(v) => compactMoney(Number(v))} />
              <Tooltip {...TOOLTIP} formatter={(v) => [formatMoneySigned(Number(v)), t('tt.pnl')]} labelFormatter={(l) => t('atlas.tradeN', { n: l })} />
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

function weekdayLabel(key: string): string {
  const map: Record<string, string> = {
    Sun: 'weekday.sun',
    Mon: 'weekday.mon',
    Tue: 'weekday.tue',
    Wed: 'weekday.wed',
    Thu: 'weekday.thu',
    Fri: 'weekday.fri',
    Sat: 'weekday.sat',
  };
  return map[key] ? t(map[key]) : key;
}

