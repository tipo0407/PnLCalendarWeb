// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import CommandPalette from './CommandPalette';

afterEach(cleanup);

function setup(overrides: Partial<Parameters<typeof CommandPalette>[0]> = {}) {
  const props = {
    trades: [],
    onClose: vi.fn(),
    onSelectDay: vi.fn(),
    onSetView: vi.fn(),
    onOpenSettings: vi.fn(),
    onToggleTheme: vi.fn(),
    onShowShortcuts: vi.fn(),
    ...overrides,
  };
  render(<CommandPalette {...props} />);
  return props;
}

describe('CommandPalette', () => {
  it('exposes listbox semantics with selectable options', () => {
    setup();
    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeInTheDocument();
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThan(0);
    // First option is selected initially.
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('arrow keys move the active option and the combobox tracks it', () => {
    setup();
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const options = screen.getAllByRole('option');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', 'cp-opt-1');
  });

  it('Enter runs the active command and closes', () => {
    const props = setup();
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onSetView).toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });
});
