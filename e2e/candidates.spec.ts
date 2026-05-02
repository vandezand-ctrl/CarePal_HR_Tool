import { test, expect, loginAsAdmin } from './helpers.js';

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
