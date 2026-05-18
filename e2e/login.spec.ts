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

// TAs land on Candidates by default. The "Add Candidate" button confirms
// the Candidates section rendered after the auto-redirect.
test('TA lands on Candidates section by default', async ({ page }) => {
  await setCaller(page, TA_EMAIL);
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Add Candidate/i })).toBeVisible();
  // TA should NOT see the Filter by TA dropdown (backend scoping enforced).
  await expect(page.getByRole('combobox', { name: /Filter by TA/i })).toHaveCount(0);
});
