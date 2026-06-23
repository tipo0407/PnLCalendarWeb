export interface TradeRecord {
  rowNumber: number;
  /** ISO date string YYYY-MM-DD */
  date: string;
  /** seconds from midnight, or null */
  entryTime: number | null;
  exitTime: number | null;
  tradeNumber: number;
  /** duration in seconds, or null */
  duration: number | null;
  direction: string;
  symbol: string;
  entryPrice: number;
  exitPrice: number;
  size: number;
  profitLoss: number;
  setup: string;
  reasonEmotion: string;
  runningPnl: number;
  note: string;
  /** Optional account/sub-account name for multi-account filtering. */
  account?: string;
}

export interface DailyPnl {
  date: string; // YYYY-MM-DD
  pnl: number;
  tradeCount: number;
  wins: number;
  losses: number;
  trades: TradeRecord[];
}
