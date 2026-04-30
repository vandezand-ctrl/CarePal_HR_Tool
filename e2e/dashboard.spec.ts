import { test, expect, loginAsAdmin } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page);
});

test('dashboard renders 4 stat cards + funnel + city summary', async ({ page }) => {
  await page.getByRole('button', { name: /^Dashboard$/i }).click();
  await expect(page.getByText('Open Reqs')).toBeVisible();
  await expect(page.getByText('Confirmed Joins')).toBeVisible();
  await expect(page.getByText('Hiring Funnel', { exact: true })).toBeVisible();
  await expect(page.getByText('City Summary')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'In Process' })).toBeVisible();
});

test('city row expands to show open requisitions', async ({ page }) => {
  await page.getByRole('button', { name: /^Dashboard$/i }).click();
  // Bangalore is seeded with multiple reqs
  const cityRow = page.locator('tr', { hasText: 'Bangalore' }).first();
  await cityRow.click();
  // After expansion, hospital text from a Bangalore req should be visible
  await expect(page.getByText(/Sakra & Kauvery|Marathahalli/)).toBeVisible();
});
