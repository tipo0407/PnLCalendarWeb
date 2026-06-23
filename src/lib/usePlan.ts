import { useEffect, useState } from 'react';
import { getPlan, PLAN_EVENT, type Plan } from './plan';

/** Live current plan; re-renders when the plan changes anywhere. */
export function usePlan(): Plan {
  const [plan, setPlan] = useState<Plan>(() => getPlan());
  useEffect(() => {
    const refresh = () => setPlan(getPlan());
    window.addEventListener(PLAN_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(PLAN_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return plan;
}

export function useIsPro(): boolean {
  return usePlan() === 'pro';
}
