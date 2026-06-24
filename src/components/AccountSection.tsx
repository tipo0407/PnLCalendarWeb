import { useState, useEffect } from 'react';
import { UserCircle2, LogOut, KeyRound, CreditCard } from 'lucide-react';
import { signup, login, logout, changePassword, signOutAll, exportAccountData, deleteAccount, fetchPlanStatus, openBillingPortal, EMAIL_RE } from '../lib/account';
import { useAccount } from '../lib/useAccount';
import { useIsPro } from '../lib/usePlan';
import { planSource } from '../lib/plan';
import { t } from '../lib/i18n';

/** Optional cloud account sign-in / sign-up, shown inside Settings. */
export default function AccountSection() {
  const account = useAccount();
  const pro = useIsPro();
  const [status, setStatus] = useState<{ planSince: string | null; planType: 'lifetime' | 'subscription' | null; planUntil: string | null } | null>(null);

  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    fetchPlanStatus().then((s) => { if (!cancelled) setStatus(s ? { planSince: s.planSince, planType: s.planType, planUntil: s.planUntil } : null); });
    return () => { cancelled = true; };
  }, [account, pro]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      setPassword('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  if (account) {
    return (
      <div className="acct-section">
        <div className="set-section-head"><UserCircle2 size={14} /> Account</div>
        <div className="acct-signed">
          <span>Signed in as <b>{account.email}</b></span>
          <span className={`acct-plan-badge ${pro ? 'pro' : 'free'}`} title={pro ? (planSource() === 'account' ? t('plan.proAccount') : t('plan.proKey')) : ''}>
            {pro ? t('plan.pro') : 'Free'}
          </span>
          {pro && status?.planSince && (
            <span className="acct-plan-since">{t('plan.since')} {new Date(status.planSince).toLocaleDateString()}</span>
          )}
          {pro && status?.planType && (
            <span className="acct-plan-type">
              {status.planType === 'subscription'
                ? (status.planUntil ? `${t('plan.renews')} ${new Date(status.planUntil).toLocaleDateString()}` : t('plan.subscription'))
                : t('plan.lifetime')}
            </span>
          )}
          <button className="set-data-btn" onClick={logout}><LogOut size={14} /> Sign out</button>
        </div>
        <ChangePassword />
        {pro && planSource() === 'account' && (
          <div className="acct-billing">
            <button className="acct-link" onClick={async () => {
              const msg = await openBillingPortal();
              if (msg) window.alert(msg);
            }}><CreditCard size={13} /> {t('plan.manageBilling')}</button>
          </div>
        )}
        <div className="acct-row-links">
          <button className="acct-link" onClick={() => { if (window.confirm('Sign out of all other devices?')) signOutAll(); }}>Sign out everywhere</button>
          <button className="acct-link" onClick={() => exportAccountData()}>Export my data</button>
          <button className="acct-link danger" onClick={async () => {
            const pw = window.prompt('Type your password to permanently delete your account and cloud data:');
            if (pw) { try { await deleteAccount(pw); } catch (e) { window.alert(e instanceof Error ? e.message : 'Failed'); } }
          }}>Delete account</button>
        </div>
        <p className="set-data-note">Cloud is optional — your data stays local unless you sync it.</p>
      </div>
    );
  }

  const emailValid = EMAIL_RE.test(email);
  return (
    <div className="acct-section">
      <div className="set-section-head"><UserCircle2 size={14} /> Account <span className="acct-optional">optional</span></div>
      <p className="set-data-note">Create a free account to enable opt-in cloud backup &amp; sync across devices.</p>
      <div className="acct-form">
        <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        {email.length > 0 && !emailValid && <span className="acct-hint">Enter a valid email address.</span>}
        <input type="password" placeholder="Password (min 8)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        <div className="acct-actions">
          <button className="set-data-btn" disabled={busy || !emailValid || password.length < 8} onClick={() => run(() => login(email, password))}>Sign in</button>
          <button className="set-data-btn" disabled={busy || !emailValid || password.length < 8} onClick={() => run(() => signup(email, password))}>Create account</button>
        </div>
      </div>
      {err && <div className="acct-err">{err}</div>}
    </div>
  );
}

function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setMsg(null);
    try {
      await changePassword(cur, next);
      setMsg('Password changed.'); setCur(''); setNext(''); setOpen(false);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="acct-changepw">
        <button className="acct-link" onClick={() => setOpen(true)}><KeyRound size={13} /> Change password</button>
        {msg && <span className="acct-msg">{msg}</span>}
      </div>
    );
  }
  return (
    <div className="acct-form acct-changepw-form">
      <input type="password" placeholder="Current password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
      <input type="password" placeholder="New password (min 8)" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
      <div className="acct-actions">
        <button className="set-data-btn" disabled={busy || next.length < 8} onClick={submit}>Save</button>
        <button className="set-data-btn" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {msg && <div className="acct-err">{msg}</div>}
    </div>
  );
}
