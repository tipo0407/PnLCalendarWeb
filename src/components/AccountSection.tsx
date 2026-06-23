import { useState } from 'react';
import { UserCircle2, LogOut } from 'lucide-react';
import { signup, login, logout } from '../lib/account';
import { useAccount } from '../lib/useAccount';

/** Optional cloud account sign-in / sign-up, shown inside Settings. */
export default function AccountSection() {
  const account = useAccount();
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
          <button className="set-data-btn" onClick={logout}><LogOut size={14} /> Sign out</button>
        </div>
        <p className="set-data-note">Cloud is optional — your data stays local unless you sync it.</p>
      </div>
    );
  }

  return (
    <div className="acct-section">
      <div className="set-section-head"><UserCircle2 size={14} /> Account <span className="acct-optional">optional</span></div>
      <p className="set-data-note">Create a free account to enable opt-in cloud backup &amp; sync across devices.</p>
      <div className="acct-form">
        <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <input type="password" placeholder="Password (min 8)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        <div className="acct-actions">
          <button className="set-data-btn" disabled={busy} onClick={() => run(() => login(email, password))}>Sign in</button>
          <button className="set-data-btn" disabled={busy} onClick={() => run(() => signup(email, password))}>Create account</button>
        </div>
      </div>
      {err && <div className="acct-err">{err}</div>}
    </div>
  );
}
