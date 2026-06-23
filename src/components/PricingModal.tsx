import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Check, Sparkles, KeyRound, BadgeCheck } from 'lucide-react';
import { useIsPro } from '../lib/usePlan';
import { deactivatePro, activateProOnline, isValidKey, DEMO_KEY, planKey } from '../lib/plan';
import { startCheckout, PRICE_IDS } from '../lib/checkout';

interface Props {
  onClose: () => void;
}

interface Tier {
  id: string;
  name: string;
  price: string;
  cadence?: string;
  blurb: string;
  features: string[];
  cta: string;
  href?: string;
  featured?: boolean;
  note?: string;
}

const TIERS: Tier[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    blurb: 'Everything you need to start journaling.',
    features: [
      'P&L calendar & 12-month heatmap',
      'Trade Atlas core analytics',
      'Local import (xlsx / CSV / Google Sheet)',
      'Sample data & demo mode',
      'Data stays on your device',
    ],
    cta: 'Current plan',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$39',
    cadence: 'lifetime · early access',
    blurb: 'Turn results into a discipline practice.',
    features: [
      'Everything in Free',
      'Behavioral review: mistakes, emotions, discipline',
      'Rule engine & adherence tracking',
      'Weekly review + PDF report export',
      'Per-trade screenshots & manual tags',
      'Risk, drawdown & R-multiple analytics',
    ],
    cta: 'Join the waitlist',
    href: 'mailto:?subject=PnL%20Calendar%20Pro%20waitlist&body=I%27d%20like%20early%20access%20to%20Pro.',
    featured: true,
    note: 'or $6.99/mo when subscriptions launch',
  },
  {
    id: 'cloud',
    name: 'Cloud',
    price: '$12',
    cadence: 'per month · planned',
    blurb: 'Sync across devices, with AI review.',
    features: [
      'Everything in Pro',
      'Encrypted cloud sync & multi-device',
      'AI weekly review & coaching',
      'Multi-account & strategy filters',
      'Automatic broker imports',
    ],
    cta: 'Notify me',
    href: 'mailto:?subject=PnL%20Calendar%20Cloud%20interest&body=Please%20notify%20me%20when%20Cloud%20launches.',
  },
];

export default function PricingModal({ onClose }: Props) {
  const pro = useIsPro();
  const [keyInput, setKeyInput] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [msgKind, setMsgKind] = useState<'ok' | 'err' | 'info'>('info');
  const [busy, setBusy] = useState(false);

  async function activate() {
    setBusy(true);
    setMsgKind('info');
    setMsg('Verifying…');
    const ok = await activateProOnline(keyInput);
    setBusy(false);
    if (ok) {
      setMsgKind('ok');
      setMsg('Pro activated. Thanks for the support!');
      setKeyInput('');
    } else {
      setMsgKind('err');
      setMsg('That license key isn’t valid. Try the demo key to explore Pro.');
    }
  }

  async function checkout() {
    const res = await startCheckout(PRICE_IDS.proLifetime);
    if (res.ok && res.url) {
      window.location.href = res.url;
    } else {
      setMsgKind('info');
      setMsg(res.message);
    }
  }

  return (
    <motion.div
      className="modal-overlay"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
    >
      <motion.div
        className="pricing-card"
        role="dialog"
        aria-modal="true"
        aria-label="Plans & pricing"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
      >
        <button className="modal-close pricing-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <div className="pricing-head">
          <span className="pricing-eyebrow"><Sparkles size={12} /> Plans</span>
          <h2>Stop repeating the same trading mistake</h2>
          <p>Free forever for the core journal. Upgrade when you want the behavioral edge.</p>
        </div>

        <div className="pricing-grid">
          {TIERS.map((t) => (
            <div key={t.id} className={`tier ${t.featured ? 'featured' : ''}`}>
              {t.featured && <span className="tier-badge">Best value</span>}
              <div className="tier-name">{t.name}</div>
              <div className="tier-price">
                <span className="tier-amt">{t.price}</span>
                {t.cadence && <span className="tier-cad">{t.cadence}</span>}
              </div>
              <p className="tier-blurb">{t.blurb}</p>
              <ul className="tier-feats">
                {t.features.map((f) => (
                  <li key={f}><Check size={14} /> {f}</li>
                ))}
              </ul>
              {pro && t.id === 'pro' ? (
                <button className="tier-cta current" disabled><BadgeCheck size={15} /> Active</button>
              ) : t.id === 'pro' ? (
                <button className={`tier-cta ${t.featured ? 'primary' : ''}`} onClick={checkout}>{t.cta}</button>
              ) : t.href ? (
                <a className={`tier-cta ${t.featured ? 'primary' : ''}`} href={t.href}>{t.cta}</a>
              ) : (
                <button className="tier-cta current" disabled>{t.cta}</button>
              )}
              {t.note && <span className="tier-note">{t.note}</span>}
            </div>
          ))}
        </div>

        <div className="pricing-activate">
          {pro ? (
            <div className="activate-active">
              <span><BadgeCheck size={16} /> Pro is active{planKey() ? ` · key ${planKey()}` : ''}.</span>
              <button className="activate-btn ghost" onClick={() => { deactivatePro(); setMsg(null); }}>Deactivate</button>
            </div>
          ) : (
            <div className="activate-row">
              <KeyRound size={16} />
              <input
                type="text"
                className="activate-input"
                placeholder={`License key (try ${DEMO_KEY})`}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') activate(); }}
              />
              <button className="activate-btn" disabled={busy || !isValidKey(keyInput)} onClick={activate}>{busy ? 'Verifying…' : 'Activate'}</button>
            </div>
          )}
          {msg && <div className={`activate-msg ${msgKind}`}>{msg}</div>}
        </div>

        <p className="pricing-foot">
          Pricing is indicative while in early access. A trading journal &amp; review tool — not investment advice.
        </p>
      </motion.div>
    </motion.div>
  );
}
