// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useFocusTrap } from './useFocusTrap';

// jsdom does no layout, so offsetParent is always null; polyfill it so the
// hook's visibility filter behaves like a real browser.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get() { return this.parentNode; },
  });
});

afterEach(cleanup);

function Dialog({ onClose }: { onClose: () => void }) {
  const ref = useFocusTrap<HTMLDivElement>(onClose);
  return (
    <div ref={ref} role="dialog" aria-label="test">
      <button>first</button>
      <button>last</button>
    </div>
  );
}

describe('useFocusTrap', () => {
  it('moves focus to the first focusable on mount', () => {
    render(<Dialog onClose={vi.fn()} />);
    expect(screen.getByText('first')).toHaveFocus();
  });

  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    render(<Dialog onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('wraps focus with Tab / Shift+Tab', () => {
    render(<Dialog onClose={vi.fn()} />);
    const last = screen.getByText('last');
    last.focus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' });
    expect(screen.getByText('first')).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true });
    expect(screen.getByText('last')).toHaveFocus();
  });

  it('restores focus to the previously focused element on unmount', () => {
    const outside = document.createElement('button');
    outside.textContent = 'outside';
    document.body.appendChild(outside);
    outside.focus();
    const { unmount } = render(<Dialog onClose={vi.fn()} />);
    expect(screen.getByText('first')).toHaveFocus();
    unmount();
    expect(outside).toHaveFocus();
    outside.remove();
  });
});
