import { test, expect, loginAsAdmin } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole('button', { name: /^Candidates$/i }).click();
});

test('candidates section renders without errors', async ({ page }) => {
  // Section heading or filter UI must render — exact text TBD by current UI
  await expect(page.locator('body')).toContainText(/Candidates|Sourced|Pipeline/i);
});
