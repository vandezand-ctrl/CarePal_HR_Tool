import { test, expect, loginAsAdmin, loginAsTA } from './helpers.js';

test.describe('Admin candidate view', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: /^Candidates$/i }).click();
  });

  test('candidates section renders without errors', async ({ page }) => {
    // Section heading or filter UI must render — exact text TBD by current UI
    await expect(page.locator('body')).toContainText(/Candidates|Sourced|Pipeline/i);
  });

  // PR-E / C3 — extended pipeline stages must show up in the Kanban / stage UI.
  test('extended pipeline stages (Training, Active) appear in the candidates view', async ({ page }) => {
    // Stages render either as Kanban column headers or as filter labels — match
    // either by looking for the literal text anywhere on the page.
    await expect(page.locator('body')).toContainText(/Training/);
    await expect(page.locator('body')).toContainText(/Active/);
  });

  test('admin does not see the Mine only / Show all chip', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^Mine only$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Show all$/i })).toHaveCount(0);
  });
});

// PR-J — TAs default to "Mine only" filter. The chip toggles between
// "Mine only" (active, filtered) and "Show all" (inactive, all candidates).
test.describe('TA candidate view (PR-J)', () => {
  test('TA lands with "Mine only" chip active by default', async ({ page }) => {
    await loginAsTA(page);
    // TA auto-redirects to Candidates section; the chip should be visible.
    await expect(page.getByRole('button', { name: /^Mine only$/i })).toBeVisible();
    // Payal owns seed candidate C-001 (Sakthivel A) — confirm "mine" filter
    // returns at least the Payal-owned row.
    await expect(page.locator('body')).toContainText(/Sakthivel/);
  });

  test('toggling chip switches to "Show all" and surfaces other TAs candidates', async ({ page }) => {
    await loginAsTA(page);
    await page.getByRole('button', { name: /^Mine only$/i }).click();
    await expect(page.getByRole('button', { name: /^Show all$/i })).toBeVisible();
    // After Show all, candidates owned by other TAs (e.g. Namita's "Priya Sharma")
    // should now be visible.
    await expect(page.locator('body')).toContainText(/Priya Sharma/);
  });
});
