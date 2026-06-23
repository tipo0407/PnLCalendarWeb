/** Client helpers for opt-in cloud backup sync (requires a signed-in account). */

import { authHeader } from './account';
import type { Backup } from './backup';

const LAST_KEY = 'pnlcalendar.cloudSync.v1';

export function getLastSynced(): string | null {
  try { return localStorage.getItem(LAST_KEY); } catch { return null; }
}

function setLastSynced(ts: string) {
  try { localStorage.setItem(LAST_KEY, ts); } catch { /* ignore */ }
}

export interface PullResult {
  blob: Backup | null;
  updatedAt: string | null;
}

export async function pullBackup(): Promise<PullResult> {
  const res = await fetch('/api/sync/pull', { headers: { ...authHeader() } });
  if (!res.ok) throw new Error(res.status === 401 ? 'Please sign in again.' : `Pull failed (${res.status})`);
  return (await res.json()) as PullResult;
}

export async function pushBackup(backup: Backup): Promise<string> {
  const res = await fetch('/api/sync/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(backup),
  });
  if (!res.ok) throw new Error(res.status === 401 ? 'Please sign in again.' : `Push failed (${res.status})`);
  const data = (await res.json()) as { updatedAt: string };
  setLastSynced(data.updatedAt);
  return data.updatedAt;
}

/** True when the cloud copy is newer than our last successful sync (conflict). */
export function isRemoteNewer(remoteUpdatedAt: string | null): boolean {
  const last = getLastSynced();
  if (!remoteUpdatedAt) return false;
  if (!last) return true;
  return remoteUpdatedAt > last;
}

export function markSynced(ts: string) {
  setLastSynced(ts);
}
