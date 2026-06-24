import { describe, it, expect } from 'vitest';
import type { SetupStat, PlaybookEntry } from './playbook';
import { playbookMarkdown } from './playbookExport';

function stat(p: Partial<SetupStat>): SetupStat {
  return {
    setup: 'Breakout', count: 10, net: 500, wins: 6, losses: 4, winRate: 0.6,
    avgWin: 150, avgLoss: -75, expectancy: 50, profitFactor: 2, ...p,
  };
}

describe('playbookMarkdown', () => {
  it('renders a placeholder when there are no setups', () => {
    const md = playbookMarkdown([], () => ({ checklist: [], note: '' }), { date: '2025-03-05' });
    expect(md).toContain('# Trading Playbook');
    expect(md).toContain('No setups yet');
  });

  it('renders stats, checklist and notes for each setup', () => {
    const entries: Record<string, PlaybookEntry> = {
      Breakout: { checklist: ['Trend aligned', 'Stop under structure'], note: 'Best in the first hour.' },
    };
    const md = playbookMarkdown(
      [stat({ setup: 'Breakout', expectancy: 50 })],
      (s) => entries[s] ?? { checklist: [], note: '' },
      { riskPerTrade: 100, date: '2025-03-05' },
    );
    expect(md).toContain('## Breakout');
    expect(md).toContain('**Win rate:** 60%');
    expect(md).toContain('(0.50R)');
    expect(md).toContain('- [ ] Trend aligned');
    expect(md).toContain('Best in the first hour.');
  });

  it('shows the infinity symbol for no-loss profit factor', () => {
    const md = playbookMarkdown([stat({ profitFactor: Infinity })], () => ({ checklist: [], note: '' }));
    expect(md).toContain('**Profit factor:** ∞');
  });
});
