import { test, expect, ADMIN_EMAIL, TA_EMAIL, setCaller } from './helpers.js';

test('lands on home after mock-mode auth, sidebar visible', async ({ page }) => {
  await setCaller(page, ADMIN_EMAIL);
  await page.goto('/');
  // Mock mode bypasses the Login screen entirely. Sidebar should render.
  await expect(page.getByRole('button', { name: /^Dashboard$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Requisitions$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Candidates$/i })).toBeVisible();
  // Headcount tab merged into Dashboard in PR-C — no longer expected.
  await expect(page.getByRole('button', { name: /^Interviews$/i })).toBeVisible();
});

// PR-J: TAs land on Candidates by default, not Dashboard. The "Mine only" chip
// is the definitive signal that the TA filter is active in Pipeline.
test('TA lands on Candidates section by default with Mine only filter active', async ({ page }) => {
  await setCaller(page, TA_EMAIL);
  await page.goto('/');
  await expect(page.getByRole('button', { name: /^Mine only$/i })).toBeVisible();
});
