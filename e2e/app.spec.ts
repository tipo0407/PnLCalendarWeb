import { test, expect, type Page } from '@playwright/test';

// Start every test from a clean local state so the landing page is shown.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
  });
});

// Bootstrap the app with data by importing the CSV fixture through the wizard.
// (The fixture has 4 rows, one exact duplicate -> 3 unique trades.)
async function loadTrades(page: Page) {
  await page.setInputFiles('input[type="file"]', 'e2e/fixtures/trades.csv');
  await expect(page.getByRole('heading', { name: /Import trades/i })).toBeVisible();
  await page.getByRole('button', { name: /Import 3 trades/i }).click();
  await expect(page.getByRole('button', { name: 'Trade Atlas', exact: true })).toBeVisible();
}

test('landing → import data → switch views', async ({ page }) => {
  await page.goto('/');

  // Landing hero is visible before any data is loaded.
  await expect(page.getByRole('heading', { name: /visual discipline journal/i })).toBeVisible();

  await loadTrades(page);

  // Switch to Trade Atlas via its tab.
  await page.getByRole('button', { name: 'Trade Atlas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Trade Atlas' })).toBeVisible();
});

test('open a day detail modal from the calendar', async ({ page }) => {
  await page.goto('/');
  await loadTrades(page);
  await page.getByRole('button', { name: /^Calendar$/i }).click();

  // Click the first calendar day that has trade data.
  const day = page.locator('.cal-cell.clickable').first();
  await expect(day).toBeVisible();
  await day.click();

  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText(/Day P&L/i)).toBeVisible();
});

test('command palette (Cmd/Ctrl+K) navigates to a view', async ({ page }) => {
  await page.goto('/');
  await loadTrades(page);

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

test('add a custom mistake tag to a trade', async ({ page }) => {
  await page.goto('/');
  await loadTrades(page);
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
  await loadTrades(page);
  await page.getByRole('button', { name: 'Trade Atlas', exact: true }).click();

  const filter = page.getByPlaceholder(/Filter by symbol/i);
  await filter.scrollIntoViewIfNeeded();
  await filter.fill('zzzzzznomatch');
  await expect(page.getByText('No matching trades.')).toBeVisible();
});

test('keyboard shortcuts overlay opens with ? and closes with Escape', async ({ page }) => {
  await page.goto('/');
  await loadTrades(page);

  await page.keyboard.press('?');
  const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Command palette')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('Settings modal traps focus and closes on Escape', async ({ page }) => {
  await page.goto('/');
  await loadTrades(page);

  await page.getByTitle('Settings').click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible();

  // Focus moved into the dialog on open.
  await expect.poll(() => page.evaluate(() => {
    const card = document.querySelector('.settings-card');
    return card ? card.contains(document.activeElement) : false;
  })).toBe(true);

  // Escape closes it (focus-trap hook behavior).
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
