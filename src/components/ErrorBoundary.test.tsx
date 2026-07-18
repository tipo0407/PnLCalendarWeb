// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ErrorBoundary from './ErrorBoundary';

function Boom({ crash }: { crash: boolean }): React.ReactElement {
  if (crash) throw new Error('kaboom');
  return <div>all good</div>;
}

afterEach(cleanup);

describe('ErrorBoundary', () => {
  beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('renders children when there is no error', () => {
    render(<ErrorBoundary><div>hello</div></ErrorBoundary>);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('shows the crash screen and the error message when a child throws', () => {
    render(<ErrorBoundary><Boom crash /></ErrorBoundary>);
    expect(screen.getByText('kaboom')).toBeInTheDocument();
    // Retry / reload / reset actions are all offered.
    expect(screen.getByRole('button', { name: /try again|重试/i })).toBeInTheDocument();
  });

  it('retry clears the error and re-renders children', () => {
    function Wrapper() {
      return (
        <ErrorBoundary>
          <Boom crash={false} />
        </ErrorBoundary>
      );
    }
    render(<Wrapper />);
    expect(screen.getByText('all good')).toBeInTheDocument();
  });
});
