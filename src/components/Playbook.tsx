import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ListChecks, Download } from 'lucide-react';
import type { TradeRecord } from '../types';
import { formatMoney, formatMoneySigned } from '../lib/metrics';
import { setupStats, getPlaybookEntry, setPlaybookEntry } from '../lib/playbook';
import { playbookMarkdown } from '../lib/playbookExport';
import { downloadText } from '../lib/exportCsv';
import { getSettings } from '../lib/settings';
import { t } from '../lib/i18n';

export default function Playbook({ trades }: { trades: TradeRecord[] }) {
  const stats = useMemo(() => setupStats(trades), [trades]);
  const [open, setOpen] = useState<string | null>(null);
  const risk = getSettings().riskPerTrade;

  if (stats.length === 0) {
    return <div className="atlas-empty">No setups yet. Fill the <b>Setup</b> column to build your playbook.</div>;
  }

  function exportMd() {
    const md = playbookMarkdown(stats, getPlaybookEntry, { riskPerTrade: risk });
    downloadText(`playbook-${new Date().toISOString().slice(0, 10)}.md`, md, 'text/markdown');
  }

  return (
    <div className="playbook">
      <div className="pb-toolbar">
        <button className="atlas-export" onClick={exportMd} title={t('pb.exportTitle')}>
          <Download size={14} /> {t('pb.export')}
        </button>
      </div>
      <div className="pb-row pb-head">
        <span className="pb-c-setup">{t('pb.setup')}</span>
        <span>{t('pb.trades')}</span>
        <span>{t('pb.winPct')}</span>
        <span>{t('pb.net')}</span>
        <span>{t('pb.expectancy')}</span>
        <span>{t('pb.pf')}</span>
        <span />
      </div>
      {stats.map((s) => {
        const isOpen = open === s.setup;
        return (
          <div key={s.setup} className={`pb-group ${isOpen ? 'open' : ''}`}>
            <button className="pb-row pb-data" onClick={() => setOpen(isOpen ? null : s.setup)}>
              <span className="pb-c-setup">{s.setup}</span>
              <span>{s.count}</span>
              <span>{(s.winRate * 100).toFixed(0)}%</span>
              <span className={s.net >= 0 ? 'pos' : 'neg'}>{formatMoneySigned(s.net)}</span>
              <span className={s.expectancy >= 0 ? 'pos' : 'neg'}>
                {formatMoneySigned(s.expectancy)}
                {risk > 0 && <small className="pb-r"> ({(s.expectancy / risk).toFixed(2)}R)</small>}
              </span>
              <span>{s.profitFactor === Infinity ? '∞' : s.profitFactor.toFixed(2)}</span>
              <span className="pb-caret">{isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span>
            </button>
            {isOpen && <PlaybookEditor setup={s.setup} avgWin={s.avgWin} avgLoss={s.avgLoss} />}
          </div>
        );
      })}
    </div>
  );
}

function PlaybookEditor({ setup, avgWin, avgLoss }: { setup: string; avgWin: number; avgLoss: number }) {
  const [entry, setEntry] = useState(() => getPlaybookEntry(setup));
  const [checkText, setCheckText] = useState(() => entry.checklist.join('\n'));

  function save(note: string, checklistText: string) {
    const checklist = checklistText.split('\n').map((l) => l.trim()).filter(Boolean);
    const next = { checklist, note };
    setEntry(next);
    setPlaybookEntry(setup, next);
  }

  return (
    <div className="pb-editor">
      <div className="pb-edit-stats">
        <span><ListChecks size={13} /> Avg win <b className="pos">{formatMoney(avgWin)}</b></span>
        <span>Avg loss <b className="neg">{formatMoney(avgLoss)}</b></span>
      </div>
      <label className="pb-field">
        <span>Entry checklist (one rule per line)</span>
        <textarea
          rows={3}
          placeholder={'e.g.\nTrend aligned on higher timeframe\nClear stop under structure\nMin 2:1 reward'}
          value={checkText}
          onChange={(e) => { setCheckText(e.target.value); save(entry.note, e.target.value); }}
        />
      </label>
      <label className="pb-field">
        <span>Notes</span>
        <textarea
          rows={2}
          placeholder="What this setup is, when it works, when to skip it…"
          value={entry.note}
          onChange={(e) => save(e.target.value, checkText)}
        />
      </label>
    </div>
  );
}
