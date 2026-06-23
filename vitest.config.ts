import { defineConfig } from 'vitest/config';

// Keep unit tests (Vitest) scoped to src and out of the Playwright e2e folder.
export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
});
