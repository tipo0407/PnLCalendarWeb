/** Tiny event bus so any component can ask the app shell to open the pricing modal. */
export const OPEN_PRICING_EVENT = 'pnlcalendar:open-pricing';

export function openPricing() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OPEN_PRICING_EVENT));
}
