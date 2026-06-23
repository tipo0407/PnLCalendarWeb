/**
 * Checkout integration point. Today the app is local-first and "Pro" is unlocked
 * with a license key, so this is a stub. When a backend is added, `startCheckout`
 * should POST to a serverless endpoint that creates a Stripe Checkout Session and
 * returns its URL, then the caller redirects to it.
 */

export interface CheckoutResult {
  ok: boolean;
  url?: string;
  message: string;
}

/** Indicative Stripe price ids (placeholders until billing is wired). */
export const PRICE_IDS = {
  proLifetime: 'price_pro_lifetime',
  proMonthly: 'price_pro_monthly',
  cloudMonthly: 'price_cloud_monthly',
} as const;

export async function startCheckout(priceId: string): Promise<CheckoutResult> {
  // Future:
  //   const res = await fetch('/api/checkout', { method: 'POST', body: JSON.stringify({ priceId }) });
  //   const { url } = await res.json();
  //   return { ok: true, url, message: 'Redirecting…' };
  void priceId;
  return {
    ok: false,
    message: 'Online checkout isn’t live yet. Enter a license key below — or use the demo key — to activate Pro.',
  };
}
