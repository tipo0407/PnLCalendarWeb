import { test, expect } from '@playwright/test';

// Start every test from a clean local state so the landing page is shown.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
  });
});

test('landing → sample data → switch views', async ({ page }) => {
  await page.goto('/');

  // Landing hero is visible before any data is loaded.
  await expect(page.getByRole('heading', { name: /visual discipline journal/i })).toBeVisible();

  // Load the bundled sample data.
  await page.getByRole('button', { name: /Explore with sample data/i }).click();

  // View tabs appear (Home is the default landing view).
  await expect(page.getByRole('button', { name: 'Calendar', exact: true })).toBeVisible();

  // Switch to Trade Atlas via its tab.
  await page.getByRole('button', { name: 'Trade Atlas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Trade Atlas' })).toBeVisible();

  // Switch to the Weekly Review.
  await page.getByRole('button', { name: /^Review$/i }).click();
  await expect(page.locator('.review-eyebrow')).toHaveText(/WEEKLY REVIEW/i);
});

test('open a day detail modal from the calendar', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Explore with sample data/i }).click();
  await page.getByRole('button', { name: /^Calendar$/i }).click();

  // Click the first calendar day that has trade data.
  const day = page.locator('.cal-cell.clickable').first();
  await expect(day).toBeVisible();
  await day.click();

  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText(/Day P&L/i)).toBeVisible();
});

test('activate Pro with the demo license key', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Explore with sample data/i }).click();

  // Open the pricing modal from the topbar "Pro" pill.
  await page.getByTitle('Plans & pricing').click();
  await expect(page.getByRole('dialog', { name: /Plans & pricing/i })).toBeVisible();

  // Enter the demo key and activate (offline fallback verifies it locally).
  await page.getByPlaceholder(/License key/i).fill('PNLCAL-PRO-DEMO');
  await page.getByRole('button', { name: /^Activate$/i }).click();

  await expect(page.getByText(/Pro activated/i)).toBeVisible();
});

test('command palette (Cmd/Ctrl+K) navigates to a view', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Explore with sample data/i }).click();

  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: /Command palette/i });
  await expect(palette).toBeVisible();

  await palette.getByPlaceholder(/Search trades/i).fill('atlas');
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { name: 'Trade Atlas' })).toBeVisible();
});

test('import a CSV via the wizard and dedupe duplicate rows', async ({ page }) => {
  await page.goto('/');

  // Upload the CSV fixture (4 rows, one exact duplicate -> 3 unique trades).
  await page.setInputFiles('input[type="file"]', 'e2e/fixtures/trades.csv');

  // The import wizard appears; the duplicate row is dropped.
  await expect(page.getByRole('heading', { name: /Import trades/i })).toBeVisible();
  const importBtn = page.getByRole('button', { name: /Import 3 trades/i });
  await expect(importBtn).toBeVisible();
  await importBtn.click();

  // Calendar renders after import.
  await expect(page.getByRole('button', { name: 'Trade Atlas', exact: true })).toBeVisible();
});

test('create and switch a local profile', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Explore with sample data/i }).click();

  // Open the profile switcher and create a new profile.
  await page.getByTitle('Switch profile').click();
  await page.getByRole('button', { name: /New profile/i }).click();

  // Rename it and confirm with Enter.
  const edit = page.locator('.profile-edit');
  await expect(edit).toBeVisible();
  await edit.fill('Funded');
  await edit.press('Enter');

  // Switch to the new profile; the switcher button reflects it.
  await page.getByRole('button', { name: 'Funded' }).click();
  await expect(page.locator('.profile-btn')).toContainText('Funded');
});

test('add a custom mistake tag to a trade', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Explore with sample data/i }).click();
  await page.getByRole('button', { name: /^Calendar$/i }).click();

  await page.locator('.cal-cell.clickable').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();

  // Open the first trade's tag picker and add a custom mistake.
  await page.getByRole('button', { name: /Add tag/i }).first().click();
  const input = page.getByPlaceholder('+ custom mistake');
  await input.fill('OverLeverage');
  await input.press('Enter');

  // The new custom tag appears as a selected pill.
  await expect(page.locator('.utag.mistake', { hasText: 'OverLeverage' })).toBeVisible();
});

test('filter the All Trades table', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Explore with sample data/i }).click();
  await page.getByRole('button', { name: 'Trade Atlas', exact: true }).click();

  const filter = page.getByPlaceholder(/Filter by symbol/i);
  await filter.scrollIntoViewIfNeeded();
  await filter.fill('zzzzzznomatch');
  await expect(page.getByText('No matching trades.')).toBeVisible();
});

test('sign in and push to cloud (mocked API)', async ({ page }) => {
  // Mock the auth + sync endpoints so the client flow runs without a backend.
  await page.route('**/api/auth/login', (route) =>
    route.fulfill({ json: { token: 'test-token', email: 'e2e@example.com' } }));
  await page.route('**/api/sync/pull', (route) =>
    route.fulfill({ json: { blob: null, updatedAt: null } }));
  await page.route('**/api/sync/push', (route) =>
    route.fulfill({ json: { ok: true, updatedAt: '2026-06-23T00:00:00.000Z' } }));

  await page.goto('/');
  await page.getByRole('button', { name: /Explore with sample data/i }).click();

  // Open Settings and sign in via the Account section.
  await page.getByTitle('Settings').click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  await page.getByPlaceholder('you@example.com').fill('e2e@example.com');
  await page.getByPlaceholder(/Password \(min 8\)/).fill('supersecret');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText(/Signed in as/i)).toBeVisible();

  // Push to cloud and confirm the success message.
  await page.getByRole('button', { name: /Push to cloud/i }).click();
  await expect(page.getByText(/Pushed to cloud/i)).toBeVisible();
});

test('keyboard shortcuts overlay opens with ? and closes with Escape', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Explore with sample data/i }).click();

  await page.keyboard.press('?');
  const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Command palette')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
