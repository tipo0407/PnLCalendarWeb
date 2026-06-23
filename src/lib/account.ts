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
