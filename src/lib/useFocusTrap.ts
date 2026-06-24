import { useEffect, useRef } from 'react';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal focus management. Attach the returned ref to a dialog
 * container to:
 *  - move focus into the dialog on open (first focusable, or the container),
 *  - keep Tab / Shift+Tab cycling within it (a focus trap),
 *  - close on Escape,
 *  - restore focus to the previously-focused element on close.
 *
 * Keeps keyboard and screen-reader users from wandering behind an open modal.
 */
export function useFocusTrap<T extends HTMLElement>(onClose?: () => void) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () => Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);

    // Move focus inside on open.
    const initial = focusables()[0];
    if (initial) initial.focus();
    else { node.setAttribute('tabindex', '-1'); node.focus(); }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };

    node.addEventListener('keydown', onKey);
    return () => {
      node.removeEventListener('keydown', onKey);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
    };
  }, [onClose]);

  return ref;
}
