import type { TradeRecord } from '../types';

export interface RiskModel {
  /** Number of trades the model is based on. */
  count: number;
  /** Win probability (0–1). */
  winRate: number;
  /** Average winning trade (positive) and average losing trade (negative). */
  avgWin: number;
  avgLoss: number;
  /** Payoff ratio = avgWin / |avgLoss| (0 if no losses observed). */
  payoff: number;
  /** Optimal fraction of capital to risk per the Kelly criterion (can be <0). */
  kelly: number;
  /** Half-Kelly, a common conservative sizing. */
  halfKelly: number;
  /**
   * Probability of eventually losing the whole account when risking a fixed
   * fraction per trade with these edge characteristics (0–1). Uses the classic
   * gambler's-ruin approximation; 1 when the edge is non-positive.
   */
  riskOfRuin: number;
  /** True when at least a minimal sample of wins and losses exists. */
  hasEdge: boolean;
}

/**
 * Estimate Kelly sizing and risk-of-ruin from realized trades. `unitsOfCapital`
 * is how many "risk units" the account is worth (e.g. 20 means each trade risks
 * 1/20th); larger = safer. Pure and testable.
 */
export function riskModel(trades: TradeRecord[], unitsOfCapital = 20): RiskModel {
  const wins = trades.filter((t) => t.profitLoss > 0);
  const losses = trades.filter((t) => t.profitLoss < 0);
  const count = trades.length;
  const winRate = count ? wins.length / count : 0;
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.profitLoss, 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((s, t) => s + t.profitLoss, 0) / losses.length : 0;
  const payoff = avgLoss !== 0 ? avgWin / Math.abs(avgLoss) : 0;

  // Kelly fraction f* = W - (1 - W) / R, where R is the payoff ratio.
  const kelly = payoff > 0 ? winRate - (1 - winRate) / payoff : 0;
  const halfKelly = kelly / 2;

  // Gambler's-ruin: with win prob p and loss prob q over N betting units,
  // P(ruin) = ((q/p)^N - ... ) ~ (q/p)^N for p>q. Use edge-adjusted odds via payoff.
  const hasEdge = wins.length >= 2 && losses.length >= 2;
  const p = winRate, q = 1 - winRate;
  const edge = p * payoff - q; // expected units won per trade
  let riskOfRuin: number;
  if (edge <= 0 || p <= 0) {
    riskOfRuin = 1;
  } else {
    const ratio = q / (p * Math.max(payoff, 1e-9));
    riskOfRuin = Math.min(1, Math.max(0, Math.pow(ratio, Math.max(1, unitsOfCapital))));
  }

  return { count, winRate, avgWin, avgLoss, payoff, kelly, halfKelly, riskOfRuin, hasEdge };
}
