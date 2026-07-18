/**
 * Tiny dependency-free toast store (pub/sub). Any module can raise a toast via
 * showToast(); the <Toaster /> component subscribes and renders them. Toasts are
 * stackable, auto-dismiss after a TTL, and can be closed manually.
 */

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
const listeners = new Set<Listener>();
let seq = 0;

function emit() {
  for (const l of listeners) l(toasts);
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener(toasts);
  return () => { listeners.delete(listener); };
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/** Raise a toast. Returns its id. `ttl` <= 0 keeps it until dismissed. */
export function showToast(message: string, kind: ToastKind = 'info', ttl = 4000): number {
  const id = ++seq;
  toasts = [...toasts, { id, kind, message }];
  emit();
  if (ttl > 0 && typeof window !== 'undefined') {
    window.setTimeout(() => dismissToast(id), ttl);
  }
  return id;
}
