import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, X, Rocket } from 'lucide-react';
import { getSettings, SETTINGS_EVENT } from '../lib/settings';
import { hasAnyUserTags, USER_TAGS_EVENT } from '../lib/userTags';
import { getPlaybookEntry, PLAYBOOK_EVENT } from '../lib/playbook';
import { t } from '../lib/i18n';
import { useLang } from '../lib/useLang';

const DISMISS_KEY = 'pnlcalendar.onboard.dismissed';

interface Props {
  hasTrades: boolean;
  setups: string[];
  onOpenSettings: () => void;
}

interface Step {
  id: string;
  label: string;
  done: boolean;
  action?: { text: string; run: () => void };
}

export default function OnboardingChecklist({ hasTrades, setups, onOpenSettings }: Props) {
  useLang(); // re-render on language change
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');
  const [, bump] = useState(0);

  useEffect(() => {
    const refresh = () => bump((n) => n + 1);
    for (const ev of [SETTINGS_EVENT, USER_TAGS_EVENT, PLAYBOOK_EVENT]) window.addEventListener(ev, refresh);
    return () => { for (const ev of [SETTINGS_EVENT, USER_TAGS_EVENT, PLAYBOOK_EVENT]) window.removeEventListener(ev, refresh); };
  }, []);

  if (dismissed) return null;

  const s = getSettings();
  const playbookStarted = setups.some((name) => {
    const e = getPlaybookEntry(name);
    return e.checklist.length > 0 || e.note.trim().length > 0;
  });

  const steps: Step[] = [
    { id: 'import', label: t('onb.import'), done: hasTrades },
    { id: 'risk', label: t('onb.risk'), done: s.accountSize > 0 || s.riskPerTrade > 0, action: { text: 'Open Settings', run: onOpenSettings } },
    { id: 'goal', label: t('onb.goal'), done: s.monthlyGoal > 0, action: { text: 'Set goal', run: onOpenSettings } },
    { id: 'tag', label: t('onb.tag'), done: hasAnyUserTags() },
    { id: 'playbook', label: t('onb.playbook'), done: playbookStarted },
  ];

  const completed = steps.filter((x) => x.done).length;
  const allDone = completed === steps.length;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  }

  return (
    <div className="onboard">
      <div className="onboard-head">
        <span className="onboard-title"><Rocket size={15} /> {t('onb.title')}</span>
        <span className="onboard-progress">{completed}/{steps.length}</span>
        <button className="onboard-close" onClick={dismiss} aria-label="Dismiss checklist"><X size={15} /></button>
      </div>
      <div className="onboard-bar"><div className="onboard-fill" style={{ width: `${(completed / steps.length) * 100}%` }} /></div>
      <ul className="onboard-steps">
        {steps.map((step) => (
          <li key={step.id} className={step.done ? 'done' : ''}>
            {step.done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
            <span>{step.label}</span>
            {!step.done && step.action && (
              <button className="onboard-action" onClick={step.action.run}>{step.action.text}</button>
            )}
          </li>
        ))}
      </ul>
      {allDone && <div className="onboard-done">{t('onb.allset')} <button onClick={dismiss}>Hide</button></div>}
    </div>
  );
}
