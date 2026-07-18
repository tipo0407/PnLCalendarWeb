/**
 * Opt-in, local-only error logging. When enabled in Settings, runtime errors are
 * recorded to a small ring buffer in localStorage so the user can copy them when
 * reporting a bug. Nothing is sent anywhere — this is privacy-first diagnostics.
 */

import { getSettings } from './settings';

export interface LoggedError {
  time: string;
  message: string;
  source?: string;
  detail?: string; // stack + component stack, when available
}

const KEY = 'pnlcalendar.errors.v1';
const MAX = 20;
let initialized = false;
// In-memory mirror so diagnostics still work when localStorage is unavailable.
let mem: LoggedError[] = [];

function read(): LoggedError[] {
  try {
    const s = localStorage.getItem(KEY);
    if (s) {
      const arr = JSON.parse(s) as LoggedError[];
      if (Array.isArray(arr)) return arr;
    }
  } catch {
    /* fall through to in-memory */
  }
  return mem;
}

function write(next: LoggedError[]) {
  mem = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
}

export function recordError(message: string, source?: string, detail?: string) {
  if (!getSettings().errorLogging) return;
  const entry: LoggedError = {
    time: new Date().toISOString(),
    message: message.slice(0, 500),
    source,
    detail: detail ? detail.slice(0, 4000) : undefined,
  };
  write([entry, ...read()].slice(0, MAX));
}

export function getErrors(): LoggedError[] {
  return read();
}

export function clearErrors() {
  mem = [];
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** Install global handlers once (no-op if logging is disabled at the time). */
export function initErrorLogging() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  window.addEventListener('error', (e) => {
    recordError(e.message || 'Unknown error', e.filename ? `${e.filename}:${e.lineno}` : undefined);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason instanceof Error ? e.reason.message : String(e.reason);
    recordError(reason, 'unhandledrejection');
  });
}
