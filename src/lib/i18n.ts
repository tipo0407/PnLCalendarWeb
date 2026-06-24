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
  // Calendar hero
  'cal.avgDay': 'Avg / Day',
  'cal.winRate': 'Win Rate',
  'cal.winStreak': 'Win Streak',
  'cal.bestDay': 'Best Day',
  'cal.worstDay': 'Worst Day',
  'cal.projected': 'Projected',
  'cal.consistency': 'Consistency',
  'cal.vsLastYear': 'vs last year',
  'remind.daily': 'You traded {date} — net {pnl} across {n} trades. Take 2 minutes to journal it.',
  'remind.weekly': 'Last week ({week}): {pnl}, {rate}% winning days. Review it before the next session.',
  'remind.journalIt': 'Journal it',
  'remind.reviewWeek': 'Review week',
  'remind.dismiss': 'Dismiss',
  'sc.title': 'Keyboard shortcuts',
  'sc.navigate': 'Navigate',
  'sc.actions': 'Actions',
  'sc.home': 'Home dashboard',
  'sc.calendar': 'Calendar',
  'sc.atlas': 'Trade Atlas',
  'sc.review': 'Weekly review',
  'sc.arrows': 'Move between trading days',
  'sc.palette': 'Command palette',
  'sc.theme': 'Toggle light / dark',
  'sc.settings': 'Open settings',
  'sc.help': 'Show this help',
  'sc.close': 'Close dialogs',
  // Dashboard
  'dash.netPnl': 'Net P&L',
  'dash.winRate': 'Win rate',
  'dash.profitFactor': 'Profit factor',
  'dash.dayStreak': 'Day streak',
  'dash.jumpTo': 'Jump to',
  'dash.recent': 'Recent trades',
  'dash.qCalendar': 'Calendar',
  'dash.qAtlas': 'Trade Atlas',
  'dash.qReview': 'Weekly Review',
  'dash.qSettings': 'Settings',
  'dash.qPlans': 'Plans & pricing',
  // Onboarding
  'onb.title': 'Get the most out of your journal',
  'onb.import': 'Import your trades',
  'onb.risk': 'Set account size & risk',
  'onb.goal': 'Set a monthly P&L goal',
  'onb.tag': 'Tag a trade’s mistake or emotion',
  'onb.playbook': 'Add a note to one of your setups',
  'onb.allset': 'You’re all set — nice work.',
  // Atlas panel titles
  'panel.equity': 'Equity Curve',
  'panel.dailyPnl': 'Daily P&L',
  'panel.monthlyGoal': 'Monthly Goal Tracking',
  'panel.setupEdge': 'Setup Edge',
  'panel.dowEdge': 'Day of Week Edge',
  'panel.holdEdge': 'Hold-Time Edge',
  'panel.hourEdge': 'Hour of Day Edge',
  'panel.distribution': 'P&L Distribution',
  'panel.mistakeEdge': 'Mistake Edge',
  'panel.emotionEdge': 'Emotion Edge',
  'panel.risk': 'Risk & Drawdown',
  'panel.playbook': 'Playbook',
  'panel.rules': 'Rule Adherence',
  'panel.tbt': 'Trade-by-Trade P&L',
  'panel.allTrades': 'All Trades',
  'panel.tagInsights': 'Tag Insights',
  'panel.leaks': 'Leak Finder',
  'panel.leaksSub': 'Where your money actually drains — biggest losses first',
  'leaks.empty': 'Not enough trades yet to find consistent leaks. Tag a few losers and check back.',
  // FAQ
  'faq.title': 'Frequently asked',
  'faq.q1': 'Do I have to connect my broker?',
  'faq.a1': 'No. You import an xlsx/CSV file or paste a Google Sheet link. There are no broker credentials and nothing is required to leave your browser.',
  'faq.q2': 'Where is my data stored?',
  'faq.a2': 'Locally, in your browser. Trades, tags, screenshots and settings live on your device. You can export a JSON backup anytime and clear everything in one click.',
  'faq.q3': 'Which formats can I import?',
  'faq.a3': 'Excel (.xlsx), CSV and Google Sheets. The import wizard auto-detects 10+ broker layouts (IBKR, Tradovate, NinjaTrader, Webull, Rithmic, DAS and more) or lets you map columns yourself.',
  'faq.q4': 'Is this financial advice?',
  'faq.a4': 'No. It’s a journaling and review tool to help you understand your own behavior — not a signal service or investment advice.',
  // Pricing
  'pricing.title': 'Stop repeating the same trading mistake',
  'pricing.sub': 'Free forever for the core journal. Upgrade when you want the behavioral edge.',
  // Day detail modal
  'modal.dayPnl': 'Day P&L',
  'modal.trades': 'Trades',
  'modal.winLoss': 'Win / Loss',
  'modal.discipline': 'Discipline',
  'modal.tradesShots': 'Trades & screenshots',
  'shots.add': 'Add screenshot',
  'shots.pasteHint': 'tip: copy a chart and paste with ⌘/Ctrl+V',
  'shots.pasteTitle': 'Paste image from clipboard',
  'shots.pasteFail': 'No image found on the clipboard. Copy a chart screenshot first.',
  // Import wizard
  'iw.title': 'Import trades',
  'iw.worksheet': 'Worksheet',
  'iw.format': 'Format / broker',
  'iw.autoDetect': 'Auto-detect columns',
  'iw.mapColumns': 'Map your columns',
  'iw.notSet': '— not set —',
  'iw.rowsReady': 'rows ready',
  'iw.skipped': 'skipped',
  'iw.mapDate': 'Map a Date column to continue.',
  'iw.preview': 'Preview',
  'iw.cancel': 'Cancel',
  'iw.import': 'Import',
  'iw.tradesWord': 'trades',
  // Settings data section
  'settings.exportBackup': 'Export backup',
  'settings.importBackup': 'Import backup',
  'settings.clearAll': 'Clear all data',
  'settings.diagnostics': 'Diagnostics (opt-in)',
  'settings.done': 'Done',
  'settings.savedLocal': 'Saved locally on this device.',
  // Rules panel
  'rules.maxLoss': 'Max daily loss ($)',
  'rules.maxTrades': 'Max trades / day',
  'rules.windowStart': 'Window start (h)',
  'rules.windowEnd': 'Window end (h)',
  // Trade table
  'tt.date': 'Date', 'tt.time': 'Time', 'tt.symbol': 'Symbol', 'tt.side': 'Side',
  'tt.size': 'Size', 'tt.pnl': 'P&L', 'tt.setup': 'Setup', 'tt.filter': 'Filter by symbol, setup, note…',
  'tt.r': 'R',
  // Playbook columns
  'pb.setup': 'Setup', 'pb.trades': 'Trades', 'pb.winPct': 'Win%', 'pb.net': 'Net',
  'pb.expectancy': 'Expectancy', 'pb.pf': 'PF',
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
  // Calendar hero
  'cal.avgDay': '日均',
  'cal.winRate': '胜率',
  'cal.winStreak': '连胜',
  'cal.bestDay': '最佳单日',
  'cal.worstDay': '最差单日',
  'cal.projected': '预计',
  'cal.consistency': '稳定度',
  'cal.vsLastYear': '对比去年',
  'remind.daily': '你在 {date} 交易了 {n} 笔，净盈亏 {pnl}。花两分钟复盘一下。',
  'remind.weekly': '上周（{week}）：{pnl}，盈利天数 {rate}%。下次交易前先复盘。',
  'remind.journalIt': '去复盘',
  'remind.reviewWeek': '复盘本周',
  'remind.dismiss': '忽略',
  'sc.title': '键盘快捷键',
  'sc.navigate': '导航',
  'sc.actions': '操作',
  'sc.home': '主面板',
  'sc.calendar': '日历',
  'sc.atlas': '交易图谱',
  'sc.review': '每周复盘',
  'sc.arrows': '在交易日之间移动',
  'sc.palette': '命令面板',
  'sc.theme': '切换明暗主题',
  'sc.settings': '打开设置',
  'sc.help': '显示此帮助',
  'sc.close': '关闭弹窗',
  // Dashboard
  'dash.netPnl': '净盈亏',
  'dash.winRate': '胜率',
  'dash.profitFactor': '盈亏比',
  'dash.dayStreak': '连续天数',
  'dash.jumpTo': '快速前往',
  'dash.recent': '最近交易',
  'dash.qCalendar': '日历',
  'dash.qAtlas': '交易分析',
  'dash.qReview': '每周复盘',
  'dash.qSettings': '设置',
  'dash.qPlans': '套餐与价格',
  // Onboarding
  'onb.title': '充分利用你的交易日志',
  'onb.import': '导入你的交易',
  'onb.risk': '设置账户规模与风险',
  'onb.goal': '设置每月盈亏目标',
  'onb.tag': '为交易标注错误或情绪',
  'onb.playbook': '为某个套路添加笔记',
  'onb.allset': '全部完成 — 干得漂亮。',
  // Atlas panel titles
  'panel.equity': '资金曲线',
  'panel.dailyPnl': '每日盈亏',
  'panel.monthlyGoal': '月度目标追踪',
  'panel.setupEdge': '套路优势',
  'panel.dowEdge': '星期优势',
  'panel.holdEdge': '持仓时长优势',
  'panel.hourEdge': '时段优势',
  'panel.distribution': '盈亏分布',
  'panel.mistakeEdge': '错误优势',
  'panel.emotionEdge': '情绪优势',
  'panel.risk': '风险与回撤',
  'panel.playbook': '交易手册',
  'panel.rules': '规则遵守',
  'panel.tbt': '逐笔盈亏',
  'panel.allTrades': '全部交易',
  'panel.tagInsights': '标签洞察',
  'panel.leaks': '漏损分析',
  'panel.leaksSub': '钱到底从哪里流走——亏得最多的排在前面',
  'leaks.empty': '交易样本还不够，无法找出稳定的漏损。给几笔亏损打上标签后再回来看。',
  // FAQ
  'faq.title': '常见问题',
  'faq.q1': '我必须连接券商吗？',
  'faq.a1': '不需要。你上传 xlsx/CSV 文件或粘贴 Google Sheet 链接即可，无需券商凭据，数据也无需离开你的浏览器。',
  'faq.q2': '我的数据存在哪里？',
  'faq.a2': '存在你浏览器本地。交易、标签、截图和设置都保存在你的设备上。你随时可以导出 JSON 备份，也可一键清除全部。',
  'faq.q3': '支持导入哪些格式？',
  'faq.a3': 'Excel (.xlsx)、CSV 和 Google Sheets。导入向导可自动识别 10+ 种券商格式（IBKR、Tradovate、NinjaTrader、Webull、Rithmic、DAS 等），也可手动映射列。',
  'faq.q4': '这是投资建议吗？',
  'faq.a4': '不是。它是一个记录与复盘工具，帮助你了解自己的交易行为，并非荐股或投资建议。',
  // Pricing
  'pricing.title': '停止重复同一个交易错误',
  'pricing.sub': '核心日志永久免费。当你需要行为复盘优势时再升级。',
  // Day detail modal
  'modal.dayPnl': '当日盈亏',
  'modal.trades': '交易数',
  'modal.winLoss': '盈 / 亏',
  'modal.discipline': '纪律',
  'modal.tradesShots': '交易与截图',
  'shots.add': '添加截图',
  'shots.pasteHint': '提示：复制图表后用 ⌘/Ctrl+V 粘贴',
  'shots.pasteTitle': '从剪贴板粘贴图片',
  'shots.pasteFail': '剪贴板里没有图片，请先复制一张图表截图。',
  // Import wizard
  'iw.title': '导入交易',
  'iw.worksheet': '工作表',
  'iw.format': '格式 / 券商',
  'iw.autoDetect': '自动识别列',
  'iw.mapColumns': '映射列',
  'iw.notSet': '— 未设置 —',
  'iw.rowsReady': '行可导入',
  'iw.skipped': '已跳过',
  'iw.mapDate': '请映射日期列以继续。',
  'iw.preview': '预览',
  'iw.cancel': '取消',
  'iw.import': '导入',
  'iw.tradesWord': '笔交易',
  // Settings data section
  'settings.exportBackup': '导出备份',
  'settings.importBackup': '导入备份',
  'settings.clearAll': '清除所有数据',
  'settings.diagnostics': '诊断（可选）',
  'settings.done': '完成',
  'settings.savedLocal': '已保存在本设备本地。',
  // Rules panel
  'rules.maxLoss': '每日最大亏损 ($)',
  'rules.maxTrades': '每日最多交易',
  'rules.windowStart': '时段起始 (时)',
  'rules.windowEnd': '时段结束 (时)',
  // Trade table
  'tt.date': '日期', 'tt.time': '时间', 'tt.symbol': '品种', 'tt.side': '方向',
  'tt.size': '数量', 'tt.pnl': '盈亏', 'tt.setup': '套路', 'tt.filter': '按品种、套路、备注筛选…',
  'tt.r': 'R',
  // Playbook columns
  'pb.setup': '套路', 'pb.trades': '交易数', 'pb.winPct': '胜率', 'pb.net': '净额',
  'pb.expectancy': '期望值', 'pb.pf': '盈亏比',
};

const DICT: Record<Lang, Record<string, string>> = { en: EN, zh: ZH };

/** Exposed for tests/tooling: the raw dictionary for a language. */
export function getDict(l: Lang): Record<string, string> {
  return DICT[l];
}

const warned = new Set<string>();
function isDev(): boolean {
  try { return Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV); } catch { return false; }
}

let lang: Lang | null = null;

export function getLang(): Lang {
  if (lang) return lang;
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'zh' || stored === 'en') {
      lang = stored;
      return lang;
    }
  } catch {
    /* ignore */
  }
  // Auto-detect from the browser on first run.
  try {
    const nav = typeof navigator !== 'undefined' ? (navigator.language || '') : '';
    lang = /^zh/i.test(nav) ? 'zh' : 'en';
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

export function t(key: string, params?: Record<string, string | number>): string {
  const l = getLang();
  let str = DICT[l][key];
  if (str === undefined) {
    if (EN[key] === undefined && isDev() && !warned.has(key)) {
      warned.add(key);
      console.warn(`[i18n] missing key: ${key}`);
    }
    str = EN[key] ?? key;
  }
  if (params) {
    str = str.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m));
  }
  return str;
}
