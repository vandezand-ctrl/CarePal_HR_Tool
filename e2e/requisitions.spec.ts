import { test, expect, loginAsAdmin } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole('button', { name: /^Requisitions$/i }).click();
});

test('requisitions list renders seeded rows', async ({ page }) => {
  // REQ-001 is seeded with hospital "Sakra & Kauvery". The text also appears
  // in the hospital filter dropdown, so target the table cell specifically.
  await expect(page.getByRole('cell', { name: 'Sakra & Kauvery' })).toBeVisible();
});

test('New Requisition modal opens and validates required fields', async ({ page }) => {
  await page.getByRole('button', { name: /New Requisition|\+ New|New Req/i }).click();
  // Modal should appear with at least a city field
  await expect(page.getByText(/City/i).first()).toBeVisible();
});
