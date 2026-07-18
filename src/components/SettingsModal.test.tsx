// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import SettingsModal from './SettingsModal';

afterEach(cleanup);

describe('SettingsModal', () => {
  it('exposes accent swatches with pressed state and one active', () => {
    render(<SettingsModal onClose={vi.fn()} />);
    const group = screen.getByRole('group');
    const swatches = group.querySelectorAll('button[aria-pressed]');
    expect(swatches.length).toBeGreaterThan(1);
    const pressed = group.querySelectorAll('button[aria-pressed="true"]');
    expect(pressed.length).toBe(1);
  });

  it('selecting an accent moves the pressed state', () => {
    render(<SettingsModal onClose={vi.fn()} />);
    const group = screen.getByRole('group');
    const swatches = Array.from(group.querySelectorAll<HTMLButtonElement>('button[aria-pressed]'));
    const target = swatches.find((b) => b.getAttribute('aria-pressed') === 'false')!;
    fireEvent.click(target);
    expect(target).toHaveAttribute('aria-pressed', 'true');
  });

  it('Escape closes via the focus trap', () => {
    const onClose = vi.fn();
    render(<SettingsModal onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
