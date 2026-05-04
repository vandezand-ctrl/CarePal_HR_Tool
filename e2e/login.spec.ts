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

// PR-J / PR-J.5: TAs land on Candidates by default. The owner-filter dropdown
// (PR-J.5 replacement for the original "Mine only" chip) defaults to the
// signed-in TA's name — that's the definitive signal the TA was redirected.
test('TA lands on Candidates section by default with owner filter set to themselves', async ({ page }) => {
  await setCaller(page, TA_EMAIL);
  await page.goto('/');
  // Payal is the seed TA we sign in as. The dropdown's selected value should be 'Payal'.
  await expect(page.getByRole('combobox', { name: /Filter by owner/i })).toHaveValue('Payal');
});
