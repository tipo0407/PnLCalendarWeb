import { useMemo, useState } from 'react';
import type { TradeRecord } from '../types';
import { loadRules, saveRules, evaluateRules, type Rules } from '../lib/rules';
import { formatMoneySigned } from '../lib/metrics';

export default function RulesPanel({ trades }: { trades: TradeRecord[] }) {
  const [rules, setRules] = useState<Rules>(() => loadRules());

  function update<K extends keyof Rules>(key: K, value: number) {
    setRules((r) => {
      const next = { ...r, [key]: value };
      saveRules(next);
      return next;
    });
  }

  const violations = useMemo(() => evaluateRules(trades, rules), [trades, rules]);
  const totalImpact = violations.reduce((s, v) => s + v.impact, 0);

  return (
    <div className="rules">
      <div className="rules-editor">
        <label>
          <span>Max daily loss ($)</span>
          <input type="number" min={0} step={50} value={rules.maxDailyLoss}
            onChange={(e) => update('maxDailyLoss', Math.max(0, Number(e.target.value)))} />
        </label>
        <label>
          <span>Max trades / day</span>
          <input type="number" min={1} step={1} value={rules.maxTradesPerDay}
            onChange={(e) => update('maxTradesPerDay', Math.max(1, Math.trunc(Number(e.target.value))))} />
        </label>
        <label>
          <span>Window start (h)</span>
          <input type="number" min={0} max={23} step={1} value={rules.windowStart}
            onChange={(e) => update('windowStart', Math.min(23, Math.max(0, Math.trunc(Number(e.target.value)))))} />
        </label>
        <label>
          <span>Window end (h)</span>
          <input type="number" min={1} max={24} step={1} value={rules.windowEnd}
            onChange={(e) => update('windowEnd', Math.min(24, Math.max(1, Math.trunc(Number(e.target.value)))))} />
        </label>
      </div>

      <div className="rules-list">
        {violations.map((v) => (
          <div className="rule-row" key={v.key}>
            <span className="rule-label">{v.label}</span>
            <span className={`rule-count ${v.count === 0 ? 'ok' : 'bad'}`}>{v.count}</span>
            <span className={`rule-impact ${v.impact >= 0 ? 'pos' : 'neg'}`}>
              {v.count === 0 ? '—' : formatMoneySigned(v.impact)}
            </span>
          </div>
        ))}
        <div className="rule-row rule-total">
          <span className="rule-label">P&amp;L tied to rule breaks</span>
          <span className="rule-count" />
          <span className={`rule-impact ${totalImpact >= 0 ? 'pos' : 'neg'}`}>{formatMoneySigned(totalImpact)}</span>
        </div>
      </div>
    </div>
  );
}
