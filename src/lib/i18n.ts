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
};

const ZH: Record<string, string> = {
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
