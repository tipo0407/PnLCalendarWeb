import type { ReactNode } from 'react';

interface Props {
  /** Tooltip text. Also mirrored onto the trigger for assistive tech. */
  tip: string;
  children: ReactNode;
  side?: 'top' | 'bottom';
  className?: string;
}

/**
 * Unified, styled, touch/keyboard-friendly tooltip. Replaces scattered native
 * `title=` attributes (which have a delay, can't be styled, and are invisible on
 * touch). The bubble is CSS-driven and shows on hover and keyboard focus.
 */
export default function Tooltip({ tip, children, side = 'top', className = '' }: Props) {
  return (
    <span className={`tip ${side === 'bottom' ? 'tip-bottom' : 'tip-top'} ${className}`} data-tip={tip}>
      {children}
    </span>
  );
}
