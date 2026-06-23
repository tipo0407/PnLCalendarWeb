import type { ReactNode } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { useIsPro } from '../lib/usePlan';
import { activatePro, DEMO_KEY } from '../lib/plan';
import { openPricing } from '../lib/pricingBus';

interface Props {
  /** Short feature name shown in the lock message. */
  feature: string;
  children: ReactNode;
}

/**
 * Soft-locks Pro content: shows a blurred preview with an upgrade overlay when
 * on the free plan. Non-destructive — a single click on "Unlock free demo"
 * activates Pro locally so nobody is ever truly blocked.
 */
export default function ProGate({ feature, children }: Props) {
  const pro = useIsPro();
  if (pro) return <>{children}</>;

  return (
    <div className="pro-gate">
      <div className="pro-gate-preview" aria-hidden="true">{children}</div>
      <div className="pro-gate-overlay">
        <span className="pro-gate-badge"><Lock size={14} /> Pro</span>
        <p className="pro-gate-title">{feature} is a Pro feature</p>
        <p className="pro-gate-sub">Unlock behavioral analytics and reviews.</p>
        <div className="pro-gate-actions">
          <button className="pro-gate-cta primary" onClick={openPricing}>
            <Sparkles size={14} /> See plans
          </button>
          <button className="pro-gate-cta" onClick={() => activatePro(DEMO_KEY)}>
            Unlock free demo
          </button>
        </div>
      </div>
    </div>
  );
}
