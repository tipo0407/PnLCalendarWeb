/**
 * Minimal i18n scaffold. Strings live in per-language dictionaries; `t(key)`
 * falls back to English and then the key itself. Language is persisted locally
 * and broadcast so the UI can re-render. Only a starter set of strings is
 * translated today — the infrastructure is here to grow into.
 */

export type Lang = 'en' | 'zh';

const KEY = 'pnlcalendar.lang.v1';
export const LANG_EVENT = 'pnlcalendar:lang';

const EN: Record<string, string> = {
  'tab.home': 'Home',
  'tab.calendar': 'Calendar',
  'tab.atlas': 'Trade Atlas',
  'tab.review': 'Review',
  'brand.sub': 'Trading performance journal',
  'action.settings': 'Settings',
  'action.plans': 'Plans & pricing',
  'settings.title': 'Settings',
  'settings.currency': 'Currency',
  'settings.weekStart': 'Week starts on',
  'settings.accountSize': 'Account size',
  'settings.risk': 'Risk per trade',
  'settings.goal': 'Monthly P&L goal',
  'settings.language': 'Language',
  'settings.dataPrivacy': 'Data & privacy',
  // Landing
  'landing.tagline': 'Not to predict the market — to help you stop repeating the same trading mistake.',
  'landing.cta': 'Explore with sample data',
  'landing.plans': 'See plans & pricing',
  // Sidebar
  'side.totalPnl': 'TOTAL P&L',
  'side.winDays': 'Win Days',
  'side.lossDays': 'Loss Days',
  'side.winRate': 'Win Rate',
  'side.avgWin': 'Avg Win',
  'side.avgLoss': 'Avg Loss',
  'side.bestDay': 'Best Day',
  'side.worstDay': 'Worst Day',
  // Atlas KPIs
  'atlas.netPnl': 'Net P&L',
  'atlas.trades': 'Trades',
  'atlas.winRate': 'Win Rate',
  'atlas.avgTrade': 'Avg Trade',
  'atlas.profitFactor': 'Profit Factor',
  'atlas.maxDD': 'Max Drawdown',
};

const ZH: Record<string, string> = {
  'tab.home': '主页',
  'tab.calendar': '日历',
  'tab.atlas': '交易分析',
  'tab.review': '复盘',
  'brand.sub': '交易表现日志',
  'action.settings': '设置',
  'action.plans': '套餐与价格',
  'settings.title': '设置',
  'settings.currency': '货币',
  'settings.weekStart': '每周起始日',
  'settings.accountSize': '账户规模',
  'settings.risk': '每笔风险',
  'settings.goal': '每月盈亏目标',
  'settings.language': '语言',
  'settings.dataPrivacy': '数据与隐私',
  // Landing
  'landing.tagline': '不是帮你预测市场，而是帮你停止重复犯同一个交易错误。',
  'landing.cta': '用示例数据体验',
  'landing.plans': '查看套餐与价格',
  // Sidebar
  'side.totalPnl': '总盈亏',
  'side.winDays': '盈利天数',
  'side.lossDays': '亏损天数',
  'side.winRate': '胜率',
  'side.avgWin': '平均盈利',
  'side.avgLoss': '平均亏损',
  'side.bestDay': '最佳单日',
  'side.worstDay': '最差单日',
  // Atlas KPIs
  'atlas.netPnl': '净盈亏',
  'atlas.trades': '交易数',
  'atlas.winRate': '胜率',
  'atlas.avgTrade': '每笔均值',
  'atlas.profitFactor': '盈亏比',
  'atlas.maxDD': '最大回撤',
};

const DICT: Record<Lang, Record<string, string>> = { en: EN, zh: ZH };

let lang: Lang | null = null;

export function getLang(): Lang {
  if (lang) return lang;
  try {
    const stored = localStorage.getItem(KEY);
    lang = stored === 'zh' ? 'zh' : 'en';
  } catch {
    lang = 'en';
  }
  return lang;
}

export function setLang(next: Lang) {
  lang = next;
  try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(LANG_EVENT));
}

export function t(key: string): string {
  const l = getLang();
  return DICT[l][key] ?? EN[key] ?? key;
}
