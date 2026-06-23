import { useEffect, useState } from 'react';
import { getLang, LANG_EVENT, type Lang } from './i18n';

/** Live current language; re-renders when it changes. */
export function useLang(): Lang {
  const [lang, setL] = useState<Lang>(() => getLang());
  useEffect(() => {
    const refresh = () => setL(getLang());
    window.addEventListener(LANG_EVENT, refresh);
    return () => window.removeEventListener(LANG_EVENT, refresh);
  }, []);
  return lang;
}
