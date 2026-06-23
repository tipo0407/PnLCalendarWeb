import { useEffect, useState } from 'react';
import { loadUserTags, USER_TAGS_EVENT, type TradeTags } from './userTags';

/** Live map of manual per-trade tags; re-reads when tags change anywhere. */
export function useUserTags(): Record<string, TradeTags> {
  const [map, setMap] = useState<Record<string, TradeTags>>(() => loadUserTags());
  useEffect(() => {
    const refresh = () => setMap(loadUserTags());
    window.addEventListener(USER_TAGS_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(USER_TAGS_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return map;
}
