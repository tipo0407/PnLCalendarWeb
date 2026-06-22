export interface Candle {
  time: number; // unix seconds, shifted to Pacific (Seattle) time for display
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

// Trades are recorded in Seattle (Pacific) wall-clock time, so the chart axis
// and the entry/exit markers must both be expressed in this timezone.
export const DISPLAY_TZ = 'America/Los_Angeles';

/**
 * Offset (in seconds) of a timezone relative to UTC at a given UTC instant.
 * Positive east of UTC, negative west. Handles DST automatically.
 */
export function tzOffsetSeconds(tz: string, utcSeconds: number): number {
  const date = new Date(utcSeconds * 1000);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );
  return Math.round((asUTC - date.getTime()) / 1000);
}

// Regular Trading Hours (US cash session), in exchange-local seconds-of-day: 09:30–16:00.
const RTH_START = 9 * 3600 + 30 * 60;
const RTH_END = 16 * 3600;

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
 * (through the `/yahoo` dev proxy). Bars are selected using the exchange's
 * regular trading hours, but candle times are emitted in Pacific (Seattle)
 * time so the chart axis matches trades recorded in Seattle wall-clock time.
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
    `?period1=${p1}&period2=${p2}&interval=${interval}&includePrePost=false`;

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
    // Select bars using the exchange-local session (date + Regular Trading Hours).
    const exLocal = ts[i] + gmtOffset;
    // Keep only bars whose exchange-local calendar date matches the trade date…
    if (Math.floor(exLocal / 86400) !== Math.floor(dayStart / 86400)) continue;
    // …and that fall within Regular Trading Hours (09:30–16:00 exchange-local).
    const secondsOfDay = exLocal - Math.floor(exLocal / 86400) * 86400;
    if (secondsOfDay < RTH_START || secondsOfDay >= RTH_END) continue;
    // Emit the bar in Pacific (Seattle) time so the axis and trade markers align.
    const displayTime = ts[i] + tzOffsetSeconds(DISPLAY_TZ, ts[i]);
    candles.push({
      time: displayTime,
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
    timezone: DISPLAY_TZ,
    gmtOffset: tzOffsetSeconds(DISPLAY_TZ, dayStart),
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
