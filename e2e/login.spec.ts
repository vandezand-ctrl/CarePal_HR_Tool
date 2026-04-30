import { test, expect, ADMIN_EMAIL, setCaller } from './helpers.js';

test('lands on home after mock-mode auth, sidebar visible', async ({ page }) => {
  await setCaller(page, ADMIN_EMAIL);
  await page.goto('/');
  // Mock mode bypasses the Login screen entirely. Sidebar should render.
  await expect(page.getByRole('button', { name: /^Dashboard$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Requisitions$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Candidates$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Headcount$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Interviews$/i })).toBeVisible();
});
