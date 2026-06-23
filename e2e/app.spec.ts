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

  // View tabs appear and the calendar is the default.
  await expect(page.getByRole('button', { name: /Calendar/i })).toBeVisible();

  // Switch to Trade Atlas.
  await page.getByRole('button', { name: /Trade Atlas/i }).click();
  await expect(page.getByRole('heading', { name: 'Trade Atlas' })).toBeVisible();

  // Switch to the Weekly Review.
  await page.getByRole('button', { name: /^Review$/i }).click();
  await expect(page.getByText(/WEEKLY REVIEW/i)).toBeVisible();
});

test('open a day detail modal from the calendar', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Explore with sample data/i }).click();

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
