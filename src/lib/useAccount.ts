import { useEffect, useState } from 'react';
import { getAccount, ACCOUNT_EVENT, type Account } from './account';

/** Live cloud account (or null); re-renders on sign in/out. */
export function useAccount(): Account | null {
  const [acc, setAcc] = useState<Account | null>(() => getAccount());
  useEffect(() => {
    const refresh = () => setAcc(getAccount());
    window.addEventListener(ACCOUNT_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(ACCOUNT_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return acc;
}
