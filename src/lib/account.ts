/**
 * Optional cloud account. The app stays fully local-first; signing in only
 * enables opt-in cloud sync. Token + email are stored locally; all calls degrade
 * gracefully when the API is unreachable.
 */

const TOKEN_KEY = 'pnlcalendar.token.v1';
const EMAIL_KEY = 'pnlcalendar.email.v1';
export const ACCOUNT_EVENT = 'pnlcalendar:account';

export interface Account {
  token: string;
  email: string;
}

export function getAccount(): Account | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const email = localStorage.getItem(EMAIL_KEY);
    return token && email ? { token, email } : null;
  } catch {
    return null;
  }
}

export function isSignedIn(): boolean {
  return getAccount() !== null;
}

function store(token: string, email: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(EMAIL_KEY, email);
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ACCOUNT_EVENT));
}

async function post(path: string, body: unknown): Promise<{ token: string; email: string }> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Cloud service is unreachable. The app still works offline.');
  }
  const data = (await res.json().catch(() => ({}))) as { token?: string; email?: string; error?: string };
  if (!res.ok || !data.token || !data.email) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return { token: data.token, email: data.email };
}

export async function signup(email: string, password: string): Promise<Account> {
  const a = await post('/api/auth/signup', { email, password });
  store(a.token, a.email);
  return a;
}

export async function login(email: string, password: string): Promise<Account> {
  const a = await post('/api/auth/login', { email, password });
  store(a.token, a.email);
  return a;
}

export function logout() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ACCOUNT_EVENT));
}

/** Returns the auth header for API calls, or an empty object when signed out. */
export function authHeader(): Record<string, string> {
  const a = getAccount();
  return a ? { Authorization: `Bearer ${a.token}` } : {};
}

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  } catch {
    throw new Error('Cloud service is unreachable.');
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `Request failed (${res.status})`);
  }
}

/** Revoke all other sessions; keeps this device signed in with a fresh token. */
export async function signOutAll(): Promise<void> {
  const acc = getAccount();
  if (!acc) return;
  let res: Response;
  try {
    res = await fetch('/api/auth/signout-all', { method: 'POST', headers: { ...authHeader() } });
  } catch {
    throw new Error('Cloud service is unreachable.');
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  const data = (await res.json()) as { token?: string };
  if (data.token) store(data.token, acc.email);
}

/** Download everything stored server-side for this account as JSON (GDPR). */
export async function exportAccountData(): Promise<void> {
  const res = await fetch('/api/auth/export', { headers: { ...authHeader() } });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const data = await res.json();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `pnlcalendar-account-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Permanently delete the account and all server-side data (needs password). */
export async function deleteAccount(password: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch('/api/auth/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ password }),
    });
  } catch {
    throw new Error('Cloud service is unreachable.');
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  logout();
}
