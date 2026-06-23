import { norm, type FieldKey, type Mapping } from './parseWorkbook';

/**
 * A broker/platform export preset. `columns` maps our internal fields to the
 * candidate header names that broker uses (matched case/space-insensitively).
 * `signatures` are headers that, when present, strongly identify the export.
 */
export interface BrokerTemplate {
  id: string;
  name: string;
  hint?: string;
  columns: Partial<Record<FieldKey, string[]>>;
  signatures: string[];
}

export const BROKER_TEMPLATES: BrokerTemplate[] = [
  {
    id: 'ibkr',
    name: 'Interactive Brokers',
    hint: 'Trades / Flex CSV',
    signatures: ['Realized P/L', 'T. Price', 'Comm/Fee', 'Proceeds'],
    columns: {
      date: ['Date/Time', 'TradeDate', 'Date'],
      symbol: ['Symbol'],
      direction: ['Buy/Sell', 'Code'],
      size: ['Quantity'],
      entryPrice: ['T. Price', 'TradePrice'],
      exitPrice: ['ClosePrice'],
      profitLoss: ['Realized P/L', 'RealizedPnL', 'FifoPnlRealized'],
      runningPnl: ['MTM P/L'],
    },
  },
  {
    id: 'tradovate',
    name: 'Tradovate',
    hint: 'Performance / Orders CSV',
    signatures: ['pnl', 'boughtTimestamp', 'soldTimestamp', 'buyPrice', 'sellPrice'],
    columns: {
      date: ['boughtTimestamp', 'Timestamp', 'Date'],
      symbol: ['symbol', 'Contract', 'Product'],
      direction: ['B/S', 'Side', 'buyOrSell'],
      size: ['qty', 'filledQty', 'Qty'],
      entryPrice: ['buyPrice', 'avgPrice', 'Price'],
      exitPrice: ['sellPrice'],
      profitLoss: ['pnl', 'P/L', 'realizedPnl'],
    },
  },
  {
    id: 'ninjatrader',
    name: 'NinjaTrader',
    hint: 'Trade performance grid',
    signatures: ['Market pos.', 'Instrument', 'Entry price', 'Exit price', 'Cum. net profit'],
    columns: {
      date: ['Entry time', 'Exit time', 'Date'],
      symbol: ['Instrument'],
      direction: ['Market pos.', 'Position'],
      size: ['Qty', 'Quantity'],
      entryPrice: ['Entry price'],
      exitPrice: ['Exit price'],
      entryTime: ['Entry time'],
      exitTime: ['Exit time'],
      profitLoss: ['Profit', 'Net profit', 'P/L'],
      runningPnl: ['Cum. net profit', 'Cumulative profit'],
    },
  },
  {
    id: 'thinkorswim',
    name: 'thinkorswim',
    hint: 'Account statement CSV',
    signatures: ['Exec Time', 'Pos Effect', 'Net Price'],
    columns: {
      date: ['Exec Time', 'Date'],
      symbol: ['Symbol'],
      direction: ['Side'],
      size: ['Qty'],
      entryPrice: ['Price', 'Net Price'],
      profitLoss: ['P/L', 'Amount'],
    },
  },
  {
    id: 'tradingview',
    name: 'TradingView',
    hint: 'Strategy / paper trade list',
    signatures: ['Profit', 'Trade #', 'Signal', 'Cumulative profit'],
    columns: {
      date: ['Date/Time', 'Date'],
      symbol: ['Symbol'],
      direction: ['Type', 'Side'],
      size: ['Quantity', 'Contracts'],
      entryPrice: ['Price'],
      profitLoss: ['Profit', 'Net Profit'],
      runningPnl: ['Cumulative profit'],
      tradeNumber: ['Trade #'],
    },
  },
  {
    id: 'das',
    name: 'DAS Trader',
    hint: 'Trades export',
    signatures: ['Cloid', 'AvgPrice', 'B/S', 'Realized'],
    columns: {
      date: ['Time', 'Date'],
      symbol: ['Symbol'],
      direction: ['B/S', 'Side'],
      size: ['Shares', 'Qty'],
      entryPrice: ['Price', 'AvgPrice'],
      profitLoss: ['Realized', 'Net', 'P/L'],
    },
  },
  {
    id: 'webull',
    name: 'Webull',
    hint: 'Orders / history CSV',
    signatures: ['Filled Time', 'Avg Price', 'Side', 'Filled'],
    columns: {
      date: ['Filled Time', 'Time-in-Force', 'Placed Time', 'Date'],
      symbol: ['Symbol', 'Name'],
      direction: ['Side'],
      size: ['Filled', 'Quantity', 'Total Qty'],
      entryPrice: ['Avg Price', 'Price'],
      profitLoss: ['Realized P&L', 'P&L', 'Amount'],
    },
  },
  {
    id: 'rithmic',
    name: 'Rithmic / R-Trader',
    hint: 'Order history',
    signatures: ['Buy/Sell', 'Fill Price', 'Fill Size', 'Account'],
    columns: {
      date: ['Update Time', 'Fill Time', 'Date'],
      symbol: ['Symbol', 'Instrument'],
      direction: ['Buy/Sell'],
      size: ['Fill Size', 'Qty'],
      entryPrice: ['Fill Price', 'Avg Fill Price'],
      profitLoss: ['P/L', 'Realized P/L'],
    },
  },
  {
    id: 'etrade',
    name: 'E*TRADE',
    hint: 'Transactions CSV',
    signatures: ['TransactionType', 'SecurityType', 'Commission', 'Quantity'],
    columns: {
      date: ['TransactionDate', 'Date'],
      symbol: ['Symbol'],
      direction: ['TransactionType'],
      size: ['Quantity'],
      entryPrice: ['Price'],
      profitLoss: ['Amount', 'NetAmount'],
    },
  },
  {
    id: 'generic-long',
    name: 'Generic (long headers)',
    hint: 'Spaced/verbose column names',
    signatures: ['Profit/Loss', 'Entry Price', 'Exit Price', 'Trade Date'],
    columns: {
      date: ['Trade Date', 'Date'],
      symbol: ['Symbol', 'Ticker', 'Instrument'],
      direction: ['Direction', 'Side', 'Long/Short'],
      size: ['Quantity', 'Size', 'Shares', 'Contracts'],
      entryPrice: ['Entry Price'],
      exitPrice: ['Exit Price'],
      entryTime: ['Entry Time'],
      exitTime: ['Exit Time'],
      profitLoss: ['Profit/Loss', 'Net P/L', 'P&L'],
    },
  },
];

/** Build a column mapping from a template against the given header cells. */
export function applyTemplate(headerCells: unknown[], tpl: BrokerTemplate): Mapping {
  const headers = headerCells.map((c) => norm(String(c ?? '')));
  const mapping: Mapping = {};
  for (const [field, names] of Object.entries(tpl.columns) as [FieldKey, string[]][]) {
    const idx = headers.findIndex((h) => h !== '' && names.some((n) => norm(n) === h));
    if (idx >= 0) mapping[field] = idx;
  }
  return mapping;
}

/** Pick the template whose signature headers best match (>=2 hits), else null. */
export function detectTemplate(headerCells: unknown[]): BrokerTemplate | null {
  const headers = new Set(headerCells.map((c) => norm(String(c ?? ''))).filter(Boolean));
  let best: BrokerTemplate | null = null;
  let bestHits = 1; // require at least 2 signature matches
  for (const tpl of BROKER_TEMPLATES) {
    const hits = tpl.signatures.filter((s) => headers.has(norm(s))).length;
    if (hits > bestHits) { bestHits = hits; best = tpl; }
  }
  return best;
}
