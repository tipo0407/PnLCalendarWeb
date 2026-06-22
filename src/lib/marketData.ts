export interface Candle {
  time: number; // unix seconds, shifted to exchange-local for display
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IntradayResult {
  candles: Candle[];
  symbol: string;
  timezone: string;
  gmtOffset: number;
}

const FUTURES_ROOTS = new Set(['MES', 'MGC', 'MNQ', 'M2K', 'MYM', 'ES', 'NQ', 'GC', 'YM', 'RTY', 'CL']);

/** Map a trade symbol to its Yahoo Finance ticker (append =F for futures roots). */
export function toYahooSymbol(symbol: string | undefined): string {
  const s = (symbol ?? '').trim().toUpperCase();
  if (!s) return 'MES=F';
  if (s.includes('=')) return s;
  if (FUTURES_ROOTS.has(s)) return `${s}=F`;
  return s;
}

/** Pick the most frequent non-blank symbol from a set of trades. */
export function dominantSymbol(symbols: (string | undefined)[], fallback = 'MES'): string {
  const counts = new Map<string, number>();
  let best: string | null = null;
  let bestCount = 0;
  for (const raw of symbols) {
    const s = (raw ?? '').trim().toUpperCase();
    if (!s) continue;
    const c = (counts.get(s) ?? 0) + 1;
    counts.set(s, c);
    if (c > bestCount) {
      bestCount = c;
      best = s;
    }
  }
  return best ?? fallback;
}

interface YahooChartResponse {
  chart: {
    result?: Array<{
      meta: { symbol: string; exchangeTimezoneName?: string; gmtoffset?: number };
      timestamp?: number[];
      indicators: {
        quote: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
    error?: { description?: string } | null;
  };
}

/**
 * Fetch intraday candles for a given ISO date and symbol from Yahoo Finance
 * (through the `/yahoo` dev proxy). Candle times are shifted by the exchange's
 * GMT offset so the chart axis reads in exchange-local time.
 */
export async function fetchIntraday(
  isoDate: string,
  symbol: string,
  interval: '1m' | '5m' | '15m' = '5m'
): Promise<IntradayResult> {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dayStart = Date.UTC(y, m - 1, d) / 1000;
  // Wide window (±1 day) so we capture the full session regardless of timezone.
  const p1 = dayStart - 86400;
  const p2 = dayStart + 2 * 86400;
  const ysym = toYahooSymbol(symbol);

  const url =
    `/yahoo/v8/finance/chart/${encodeURIComponent(ysym)}` +
    `?period1=${p1}&period2=${p2}&interval=${interval}&includePrePost=true`;

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Market data request failed (${resp.status}).`);
  }
  const json = (await resp.json()) as YahooChartResponse;
  const result = json.chart?.result?.[0];
  if (!result || !result.timestamp) {
    return { candles: [], symbol: ysym, timezone: '', gmtOffset: 0 };
  }

  const gmtOffset = result.meta.gmtoffset ?? 0;
  const q = result.indicators.quote[0] ?? {};
  const ts = result.timestamp;
  const candles: Candle[] = [];

  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i];
    const h = q.high?.[i];
    const l = q.low?.[i];
    const c = q.close?.[i];
    if (o == null || h == null || l == null || c == null) continue;
    const localTime = ts[i] + gmtOffset;
    // Keep only bars whose exchange-local calendar date matches the trade date.
    if (Math.floor(localTime / 86400) !== Math.floor(dayStart / 86400)) continue;
    candles.push({
      time: localTime,
      open: o,
      high: h,
      low: l,
      close: c,
      volume: q.volume?.[i] ?? 0,
    });
  }

  return {
    candles,
    symbol: result.meta.symbol,
    timezone: result.meta.exchangeTimezoneName ?? '',
    gmtOffset,
  };
}

/** Exponential moving average of close, aligned to candle times. */
export function ema(candles: Candle[], period: number): { time: number; value: number }[] {
  if (candles.length === 0) return [];
  const k = 2 / (period + 1);
  const out: { time: number; value: number }[] = [];
  let prev = candles[0].close;
  for (let i = 0; i < candles.length; i++) {
    prev = i === 0 ? candles[i].close : candles[i].close * k + prev * (1 - k);
    out.push({ time: candles[i].time, value: prev });
  }
  return out;
}

/** Session VWAP (cumulative over the provided candles). */
export function vwap(candles: Candle[]): { time: number; value: number }[] {
  let cumPV = 0;
  let cumV = 0;
  return candles.map((c) => {
    const typical = (c.high + c.low + c.close) / 3;
    const v = c.volume || 1;
    cumPV += typical * v;
    cumV += v;
    return { time: c.time, value: cumPV / cumV };
  });
}
