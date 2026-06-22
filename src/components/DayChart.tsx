import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type UTCTimestamp,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts';
import type { TradeRecord } from '../types';
import {
  fetchIntraday,
  dominantSymbol,
  ema,
  vwap,
  type IntradayResult,
} from '../lib/marketData';
import { formatMoneySigned } from '../lib/metrics';

interface Props {
  date: string; // YYYY-MM-DD
  trades: TradeRecord[];
}

type Interval = '1m' | '5m' | '15m';
const INTERVALS: Interval[] = ['1m', '5m', '15m'];

type Status =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'done'; result: IntradayResult };

export default function DayChart({ date, trades }: Props) {
  const symbol = useMemo(() => dominantSymbol(trades.map((t) => t.symbol)), [trades]);
  const [interval, setInterval] = useState<Interval>('5m');
  const [status, setStatus] = useState<Status>({ phase: 'loading' });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setStatus({ phase: 'loading' });
      try {
        const r = await fetchIntraday(date, symbol, interval);
        if (!cancelled) setStatus({ phase: 'done', result: r });
      } catch (e) {
        if (!cancelled) setStatus({ phase: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [date, symbol, interval]);

  const result = status.phase === 'done' ? status.result : null;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !result || result.candles.length === 0) return;

    const dark = document.documentElement.dataset.theme === 'dark';
    const text = dark ? '#9caac1' : '#5b6678';
    const grid = dark ? 'rgba(140,152,172,0.12)' : 'rgba(140,152,172,0.18)';

    const chart: IChartApi = createChart(el, {
      width: el.clientWidth,
      height: 320,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: text,
        fontFamily: "'Inter Variable', Inter, system-ui, sans-serif",
      },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: grid },
      timeScale: { borderColor: grid, timeVisible: true, secondsVisible: false },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#16a34a',
      downColor: '#e1483b',
      borderVisible: false,
      wickUpColor: '#16a34a',
      wickDownColor: '#e1483b',
    });
    candleSeries.setData(
      result.candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    const emaSeries = chart.addLineSeries({ color: '#f59e0b', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
    emaSeries.setData(ema(result.candles, 20).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));

    const vwapSeries = chart.addLineSeries({ color: '#8b5cf6', lineWidth: 2, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
    vwapSeries.setData(vwap(result.candles).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));

    // Entry/exit markers from the day's trades.
    const [y, m, d] = date.split('-').map(Number);
    const dayStart = Date.UTC(y, m - 1, d) / 1000;
    const markers: SeriesMarker<Time>[] = [];
    for (const t of trades) {
      const isLong = /long/i.test(t.direction);
      if (t.entryTime != null) {
        markers.push({
          time: (dayStart + t.entryTime) as UTCTimestamp,
          position: 'belowBar',
          color: '#3b6fe0',
          shape: isLong ? 'arrowUp' : 'arrowDown',
          text: `In #${t.tradeNumber}`,
        });
      }
      if (t.exitTime != null) {
        markers.push({
          time: (dayStart + t.exitTime) as UTCTimestamp,
          position: 'aboveBar',
          color: t.profitLoss >= 0 ? '#16a34a' : '#e1483b',
          shape: 'circle',
          text: formatMoneySigned(t.profitLoss),
        });
      }
    }
    markers.sort((a, b) => (a.time as number) - (b.time as number));
    candleSeries.setMarkers(markers);

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }));
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [result, date, trades]);

  return (
    <div className="day-chart">
      <div className="dc-head">
        <div className="dc-title">
          <span className="dc-symbol">{symbol}</span>
          <span className="dc-legend">
            <i className="lg lg-ema" /> EMA20
            <i className="lg lg-vwap" /> VWAP
          </span>
        </div>
        <div className="dc-intervals">
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              className={`dc-iv ${interval === iv ? 'active' : ''}`}
              onClick={() => setInterval(iv)}
            >
              {iv}
            </button>
          ))}
        </div>
      </div>

      <div className="dc-canvas-wrap">
        <div ref={containerRef} className="dc-canvas" />
        {status.phase === 'loading' && <div className="dc-overlay">Loading market data…</div>}
        {status.phase === 'error' && <div className="dc-overlay">⚠ {status.message}</div>}
        {status.phase === 'done' && status.result.candles.length === 0 && (
          <div className="dc-overlay">
            No intraday data for {symbol} on this date.
            <span className="dc-overlay-sub">
              Yahoo intraday history is limited (≈60 days for 5m, ≈8 days for 1m).
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
