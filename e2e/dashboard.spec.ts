import { test, expect, loginAsAdmin } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page);
  // The Headcount tab is gone in PR-C — no separate nav click needed.
});

test('headcount-style stat row + funnel + merged city table render', async ({ page }) => {
  await page.getByRole('button', { name: /^Dashboard$/i }).click();
  // 4 new headcount-focused StatCards.
  await expect(page.getByText('Target Headcount (AOP)')).toBeVisible();
  await expect(page.getByText('Active Headcount').first()).toBeVisible();
  await expect(page.getByText('At Risk (Notice + PIP)')).toBeVisible();
  await expect(page.getByText('Net Deficit').first()).toBeVisible();
  // Funnel still present.
  await expect(page.getByText('Hiring Funnel', { exact: true })).toBeVisible();
  // Merged headcount-by-city table — On Notice / PIP / In Training / Offered
  // / Deficit are the new columns.
  await expect(page.getByRole('columnheader', { name: 'On Notice' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'In Training' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Deficit' })).toBeVisible();
});

test('Headcount tab is gone from sidebar (merged into Dashboard)', async ({ page }) => {
  await expect(page.getByRole('button', { name: /^Headcount$/i })).toHaveCount(0);
});

test('city row expands to show open requisitions', async ({ page }) => {
  await page.getByRole('button', { name: /^Dashboard$/i }).click();
  const cityRow = page.locator('tr', { hasText: 'Bangalore' }).first();
  await cityRow.click();
  await expect(page.getByText(/Sakra & Kauvery|Marathahalli/)).toBeVisible();
});

test('admin sees Target HC pencil-edit after switching to a specific BU', async ({ page }) => {
  await page.getByRole('button', { name: /^Dashboard$/i }).click();
  // Pencil only appears on a per-BU view. Click the "CPM · Lending" toggle in
  // the header BU switcher.
  await page.getByRole('button', { name: /CPM · Lending/i }).click();
  const pencil = page.locator('button[title="Edit Target HC (admin)"]').first();
  await expect(pencil).toBeVisible();
});
