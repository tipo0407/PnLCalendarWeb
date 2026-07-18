import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type UTCTimestamp,
  type AutoscaleInfo,
  type MouseEventParams,
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
import { t } from '../lib/i18n';
import { useLang } from '../lib/useLang';

interface Props {
  date: string; // YYYY-MM-DD
  trades: TradeRecord[];
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  );
}

type Interval = '1m' | '5m' | '15m';
const INTERVALS: Interval[] = ['1m', '5m', '15m'];

type Status =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'done'; result: IntradayResult };

export default function DayChart({ date, trades }: Props) {
  useLang();
  const symbol = useMemo(() => dominantSymbol(trades.map((t) => t.symbol)), [trades]);
  const [interval, setInterval] = useState<Interval>('5m');
  const [status, setStatus] = useState<Status>({ phase: 'loading' });
  const containerRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const pillLayerRef = useRef<HTMLDivElement>(null);
  const arrowLayerRef = useRef<SVGSVGElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    const run = async () => {
      setStatus({ phase: 'loading' });
      try {
        const r = await fetchIntraday(date, symbol, interval, { signal: ctrl.signal });
        if (!cancelled) setStatus({ phase: 'done', result: r });
      } catch (e) {
        // Ignore aborts triggered by unmount / dependency change.
        if (!cancelled && !ctrl.signal.aborted) {
          setStatus({ phase: 'error', message: e instanceof Error ? e.message : String(e) });
        }
      }
    };
    run();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [date, symbol, interval]);

  const result = status.phase === 'done' ? status.result : null;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !result || result.candles.length === 0) return;

    const dark = document.documentElement.dataset.theme === 'dark';
    const text = dark ? '#9caac1' : '#5b6678';
    const grid = dark ? 'rgba(140,152,172,0.12)' : 'rgba(140,152,172,0.18)';
    const cs = getComputedStyle(document.documentElement);
    const cssRgb = (name: string, fallback: string) => `rgb(${(cs.getPropertyValue(name).trim() || fallback)})`;
    const pos = cssRgb('--pos-rgb', '18,161,80');
    const neg = cssRgb('--neg-rgb', '224,71,61');

    const chart: IChartApi = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: text,
        fontFamily: "'Inter Variable', Inter, system-ui, sans-serif",
      },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: grid, scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: { borderColor: grid, timeVisible: true, secondsVisible: false, rightOffset: 4 },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: pos,
      downColor: neg,
      borderVisible: false,
      wickUpColor: pos,
      wickDownColor: neg,
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

    // Always keep the price axis wide enough to include the trade fills, so the
    // entry/exit markers can't render off-screen when the data feed's contract
    // diverges from the user's fills (e.g. a different/expired futures month or
    // a futures roll), as happens on some days where Yahoo's continuous quote
    // sits well above/below the recorded fills.
    const tradePrices = trades
      .flatMap((tr) => [tr.entryPrice, tr.exitPrice])
      .filter((p): p is number => typeof p === 'number' && p > 0);
    if (tradePrices.length > 0) {
      const tMin = Math.min(...tradePrices);
      const tMax = Math.max(...tradePrices);
      candleSeries.applyOptions({
        autoscaleInfoProvider: (original: () => AutoscaleInfo | null) => {
          const res = original();
          if (res?.priceRange) {
            res.priceRange.minValue = Math.min(res.priceRange.minValue, tMin);
            res.priceRange.maxValue = Math.max(res.priceRange.maxValue, tMax);
          }
          return res;
        },
      });
    }

    const emaSeries = chart.addLineSeries({ color: '#f59e0b', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
    emaSeries.setData(ema(result.candles, 20).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));

    const vwapSeries = chart.addLineSeries({ color: '#8b5cf6', lineWidth: 2, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
    vwapSeries.setData(vwap(result.candles).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));

    // Trades: each leg drawn as a buy (green ↑) or sell (red ↓) arrow.
    const [y, m, d] = date.split('-').map(Number);
    const dayStart = Date.UTC(y, m - 1, d) / 1000;
    const candleTimes = result.candles.map((c) => c.time);
    // Snap a trade timestamp to the nearest candle so markers sit on real bars.
    const snap = (tSec: number): UTCTimestamp => {
      let best = candleTimes[0];
      let bestD = Infinity;
      for (const ct of candleTimes) {
        const dd = Math.abs(ct - tSec);
        if (dd < bestD) { bestD = dd; best = ct; }
      }
      return best as UTCTimestamp;
    };
    const halo = dark ? '#000000' : '#ffffff';

    const pillLayer = pillLayerRef.current;
    const arrowLayer = arrowLayerRef.current;
    const tip = tipRef.current;
    const showTip = (trade: TradeRecord, x: number, y: number) => {
      if (!tip) return;
      const dir = /short|sell|空/i.test(trade.direction) ? t('tt.short') : /long|buy|多/i.test(trade.direction) ? t('tt.long') : trade.direction;
      const win = trade.profitLoss >= 0;
      const head = [`#${trade.tradeNumber}`, dir, trade.symbol].filter(Boolean).join(' · ');
      const noteText = trade.reasonEmotion || trade.note;
      tip.innerHTML =
        `<div class="tt-head">${escapeHtml(head)}</div>` +
        `<div class="tt-pnl ${win ? 'pos' : 'neg'}">${formatMoneySigned(trade.profitLoss)}</div>` +
        (trade.entryPrice && trade.exitPrice
          ? `<div class="tt-sub">${escapeHtml(t('tt.entry'))} ${trade.entryPrice} → ${escapeHtml(t('tt.exit'))} ${trade.exitPrice}</div>`
          : '') +
        (trade.setup ? `<div class="tt-setup">${escapeHtml(t('tt.setupLine'))}: ${escapeHtml(trade.setup)}</div>` : '') +
        (noteText ? `<div class="tt-note">${escapeHtml(noteText)}</div>` : '');
      tip.style.left = `${x}px`;
      tip.style.top = `${y}px`;
      tip.classList.add('show');
    };
    const hideTip = () => tip?.classList.remove('show');

    // Small arrow whose tip points exactly at the given price coordinate.
    // Buy → green up arrow, sell → red down arrow.
    const arrowSvg = (x: number, y: number, up: boolean, color: string): string => {
      const s = 6;
      const hgt = 13;
      const pts = up
        ? `${x},${y} ${x - s},${y + hgt} ${x + s},${y + hgt}`
        : `${x},${y} ${x - s},${y - hgt} ${x + s},${y - hgt}`;
      return `<polygon points="${pts}" fill="${color}" stroke="${halo}" stroke-width="1.25" stroke-linejoin="round" />`;
    };

    const renderOverlay = () => {
      const tscale = chart.timeScale();
      // Connectors (halo + colored core) and direction arrows, anchored at exact prices.
      if (arrowLayer) {
        const w = el.clientWidth;
        const h = el.clientHeight;
        let halos = '';
        let cores = '';
        let arrows = '';
        for (const t of trades) {
          const isLong = !/short|sell|空/i.test(t.direction);
          const win = t.profitLoss >= 0;
          const xEntry = t.entryTime != null ? tscale.timeToCoordinate(snap(dayStart + t.entryTime)) : null;
          const yEntry = t.entryPrice ? candleSeries.priceToCoordinate(t.entryPrice) : null;
          const xExit = t.exitTime != null ? tscale.timeToCoordinate(snap(dayStart + t.exitTime)) : null;
          const yExit = t.exitPrice ? candleSeries.priceToCoordinate(t.exitPrice) : null;
          // Connector (works even when entry & exit share a candle → vertical line).
          if (xEntry != null && yEntry != null && xExit != null && yExit != null) {
            const line = `x1="${xEntry}" y1="${yEntry}" x2="${xExit}" y2="${yExit}"`;
            halos += `<line ${line} stroke="${halo}" stroke-width="4.5" stroke-linecap="round" />`;
            cores += `<line ${line} stroke="${win ? pos : neg}" stroke-width="2" stroke-linecap="round" />`;
          }
          // Each leg is a buy or a sell — buy = green up arrow, sell = red down arrow.
          // Long opens with a buy and closes with a sell; short is the reverse.
          const entryIsBuy = isLong;
          const exitIsBuy = !isLong;
          if (xEntry != null && yEntry != null) arrows += arrowSvg(xEntry, yEntry, entryIsBuy, entryIsBuy ? pos : neg);
          if (xExit != null && yExit != null) arrows += arrowSvg(xExit, yExit, exitIsBuy, exitIsBuy ? pos : neg);
        }
        arrowLayer.setAttribute('width', `${w}`);
        arrowLayer.setAttribute('height', `${h}`);
        arrowLayer.setAttribute('viewBox', `0 0 ${w} ${h}`);
        arrowLayer.innerHTML = halos + cores + arrows;
      }
      // P&L pills, anchored right at each trade's exit price so they sit next to
      // that trade's exit arrow/connector (above for wins, below for losses).
      if (pillLayer) {
        pillLayer.innerHTML = '';
        for (const t of trades) {
          if (t.exitTime == null || !t.exitPrice) continue;
          const win = t.profitLoss >= 0;
          const exitTime = snap(dayStart + t.exitTime);
          const x = tscale.timeToCoordinate(exitTime);
          const yCoord = candleSeries.priceToCoordinate(t.exitPrice);
          if (x == null || yCoord == null) continue;
          const pill = document.createElement('div');
          pill.className = `dc-pnl-pill ${win ? 'pos above' : 'neg below'}`;
          pill.textContent = formatMoneySigned(t.profitLoss);
          pill.style.left = `${x}px`;
          pill.style.top = `${yCoord}px`;
          pill.addEventListener('mouseenter', () => showTip(t, x, yCoord));
          pill.addEventListener('mouseleave', hideTip);
          pillLayer.appendChild(pill);
        }
      }
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(renderOverlay);
    const overlayRo = new ResizeObserver(() => renderOverlay());
    overlayRo.observe(el);

    // Floating OHLC legend driven by the crosshair.
    const legend = legendRef.current;
    const onCrosshairMove = (param: MouseEventParams) => {
      if (!legend) return;
      const c = param.seriesData.get(candleSeries) as
        | { open: number; high: number; low: number; close: number }
        | undefined;
      if (!param.time || !param.point || !c) {
        legend.classList.remove('show');
        return;
      }
      const up = c.close >= c.open;
      legend.classList.add('show');
      legend.innerHTML =
        `<span>O <b>${c.open.toFixed(2)}</b></span>` +
        `<span>H <b>${c.high.toFixed(2)}</b></span>` +
        `<span>L <b>${c.low.toFixed(2)}</b></span>` +
        `<span class="${up ? 'pos' : 'neg'}">C <b>${c.close.toFixed(2)}</b></span>`;
    };
    chart.subscribeCrosshairMove(onCrosshairMove);

    chart.timeScale().fitContent();
    const rafId = requestAnimationFrame(renderOverlay);

    return () => {
      cancelAnimationFrame(rafId);
      // Explicitly detach the listeners we attached so no stale callback fires
      // against a removed chart across re-renders.
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(renderOverlay);
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      overlayRo.disconnect();
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
        <svg ref={arrowLayerRef} className="dc-arrow-layer" />
        <div ref={pillLayerRef} className="dc-pill-layer" />
        <div ref={tipRef} className="dc-trade-tip" />
        <div ref={legendRef} className="dc-legend-float" />
        {status.phase === 'loading' && <div className="dc-overlay">{t('tt.loadingMarket')}</div>}
        {status.phase === 'error' && <div className="dc-overlay">⚠ {status.message}</div>}
        {status.phase === 'done' && status.result.candles.length === 0 && (
          <div className="dc-overlay">
            {t('tt.noIntraday', { symbol })}
            <span className="dc-overlay-sub">
              {t('tt.yahooLimit')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
