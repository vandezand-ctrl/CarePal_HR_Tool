import { test, expect, loginAsAdmin } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole('button', { name: /^Interviews$/i }).click();
});

test('interviews section renders', async ({ page }) => {
  await expect(page.locator('body')).toContainText(/Interview|Scheduled|Round/i);
});
