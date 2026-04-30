import { test, expect, loginAsAdmin } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole('button', { name: /^Headcount$/i }).click();
});

// NOTE: this spec is removed in PR-C (when Headcount is folded into Dashboard).
test('headcount table renders cities + columns', async ({ page }) => {
  await expect(page.getByText(/Target Headcount|Active Headcount/i)).toBeVisible();
  await expect(page.getByText('Bangalore')).toBeVisible();
});
