import type { SetupStat, PlaybookEntry } from './playbook';

function money(n: number): string {
  const s = n < 0 ? '-' : '';
  return `${s}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/**
 * Render the trader's playbook (per-setup stats + checklist + notes) as a
 * portable Markdown document they can keep, print, or share. Pure and
 * deterministic so it can be unit tested.
 */
export function playbookMarkdown(
  stats: SetupStat[],
  getEntry: (setup: string) => PlaybookEntry,
  opts: { riskPerTrade?: number; date?: string } = {},
): string {
  const date = opts.date ?? new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push('# Trading Playbook');
  lines.push('');
  lines.push(`_Generated ${date} · PnL Calendar_`);
  lines.push('');

  if (stats.length === 0) {
    lines.push('_No setups yet — fill the Setup column to build your playbook._');
    lines.push('');
    return lines.join('\n');
  }

  for (const s of stats) {
    const entry = getEntry(s.setup);
    const r = opts.riskPerTrade && opts.riskPerTrade > 0 ? ` (${(s.expectancy / opts.riskPerTrade).toFixed(2)}R)` : '';
    const pf = s.profitFactor === Infinity ? '∞' : s.profitFactor.toFixed(2);
    lines.push(`## ${s.setup}`);
    lines.push('');
    lines.push(`- **Trades:** ${s.count}`);
    lines.push(`- **Win rate:** ${(s.winRate * 100).toFixed(0)}%`);
    lines.push(`- **Net:** ${money(s.net)}`);
    lines.push(`- **Expectancy:** ${money(s.expectancy)}${r}`);
    lines.push(`- **Profit factor:** ${pf}`);
    if (entry.checklist.length > 0) {
      lines.push('');
      lines.push('**Entry checklist**');
      lines.push('');
      for (const item of entry.checklist) lines.push(`- [ ] ${item}`);
    }
    if (entry.note.trim()) {
      lines.push('');
      lines.push('**Notes**');
      lines.push('');
      lines.push(entry.note.trim());
    }
    lines.push('');
  }
  return lines.join('\n');
}
