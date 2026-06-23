/**
 * Accent color and high-contrast preferences. Accent presets override the
 * --accent* CSS variables on :root; "default" removes the overrides so the
 * theme's built-in accent applies. High contrast toggles a data attribute.
 * Both are global UI preferences (not per-profile).
 */

export interface AccentPreset {
  id: string;
  name: string;
  accent: string;
  accent2: string;
  rgb: string;
}

export const ACCENTS: AccentPreset[] = [
  { id: 'default', name: 'Default', accent: '#3f6fd8', accent2: '#5b8def', rgb: '63, 111, 216' },
  { id: 'violet', name: 'Violet', accent: '#7c3aed', accent2: '#a78bfa', rgb: '124, 58, 237' },
  { id: 'emerald', name: 'Emerald', accent: '#059669', accent2: '#34d399', rgb: '5, 150, 105' },
  { id: 'cyan', name: 'Cyan', accent: '#0891b2', accent2: '#22d3ee', rgb: '8, 145, 178' },
  { id: 'amber', name: 'Amber', accent: '#d97706', accent2: '#fbbf24', rgb: '217, 119, 6' },
  { id: 'rose', name: 'Rose', accent: '#e11d48', accent2: '#fb7185', rgb: '225, 29, 72' },
];

const ACCENT_KEY = 'pnlcalendar.accent.v1';
const CONTRAST_KEY = 'pnlcalendar.contrast.v1';
export const THEME_PREF_EVENT = 'pnlcalendar:themepref';

export function getAccentId(): string {
  try { return localStorage.getItem(ACCENT_KEY) || 'default'; } catch { return 'default'; }
}

export function applyAccent(id: string) {
  const root = typeof document !== 'undefined' ? document.documentElement : null;
  if (!root) return;
  const preset = ACCENTS.find((a) => a.id === id);
  if (!preset || id === 'default') {
    root.style.removeProperty('--accent');
    root.style.removeProperty('--accent-2');
    root.style.removeProperty('--accent-rgb');
    root.style.removeProperty('--accent-soft');
    return;
  }
  root.style.setProperty('--accent', preset.accent);
  root.style.setProperty('--accent-2', preset.accent2);
  root.style.setProperty('--accent-rgb', preset.rgb);
  root.style.setProperty('--accent-soft', `color-mix(in srgb, ${preset.accent} 16%, transparent)`);
}

export function setAccent(id: string) {
  try { localStorage.setItem(ACCENT_KEY, id); } catch { /* ignore */ }
  applyAccent(id);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(THEME_PREF_EVENT));
}

export function getHighContrast(): boolean {
  try { return localStorage.getItem(CONTRAST_KEY) === '1'; } catch { return false; }
}

export function applyHighContrast(on: boolean) {
  if (typeof document === 'undefined') return;
  if (on) document.documentElement.setAttribute('data-contrast', 'high');
  else document.documentElement.removeAttribute('data-contrast');
}

export function setHighContrast(on: boolean) {
  try { localStorage.setItem(CONTRAST_KEY, on ? '1' : '0'); } catch { /* ignore */ }
  applyHighContrast(on);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(THEME_PREF_EVENT));
}

/** Apply persisted theme preferences at startup. */
export function initThemePrefs() {
  applyAccent(getAccentId());
  applyHighContrast(getHighContrast());
}
