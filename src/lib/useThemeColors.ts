import { useEffect, useState } from 'react';
import { THEME_PREF_EVENT } from './theme';

export interface ThemeColors {
  pos: string;
  neg: string;
  accent: string;
  accent2: string;
  text2: string;
  grid: string;
}

function readThemeColors(): ThemeColors {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    pos: `rgb(${v('--pos-rgb', '18,161,80')})`,
    neg: `rgb(${v('--neg-rgb', '224,71,61')})`,
    accent: `rgb(${v('--accent-rgb', '63,111,216')})`,
    accent2: v('--accent-2', '#5b8def'),
    text2: v('--text-2', '#5b6678'),
    grid: 'rgba(140,152,172,0.18)',
  };
}

/** Reactively expose the active theme's palette tokens to canvas/SVG charts. */
export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(() => readThemeColors());
  useEffect(() => {
    const update = () => setColors(readThemeColors());
    // Recolor on light/dark toggle, high-contrast toggle, and inline accent
    // variable changes (setAccent writes --accent* onto :root's style attr).
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-contrast', 'style'],
    });
    // Accent / high-contrast preference changes also fire a window event.
    window.addEventListener(THEME_PREF_EVENT, update);
    update();
    return () => {
      obs.disconnect();
      window.removeEventListener(THEME_PREF_EVENT, update);
    };
  }, []);
  return colors;
}
