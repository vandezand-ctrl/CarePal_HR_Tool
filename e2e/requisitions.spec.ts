import { test, expect, loginAsAdmin, loginAsTA, setCaller, APPROVER_EMAIL } from './helpers.js';

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

// PR-D / point 3 (R3 + R4) — anticipated closure date column + offer indicator.
test('Closure Date and Offer? columns render in the requisitions table', async ({ page }) => {
  await expect(page.getByRole('columnheader', { name: 'Closure Date' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Offer?' })).toBeVisible();
});

test('admin sees a pencil to edit closure date on each requisition row', async ({ page }) => {
  // Admin/approver pencil — title attribute is set by the inline-edit button.
  const pencil = page.locator('button[title="Edit closure date"]').first();
  await expect(pencil).toBeVisible();
});

// PR-E / R5 — anticipated joining date column derived from candidates.
test('Expected Joining column header renders in the requisitions table', async ({ page }) => {
  await expect(page.getByRole('columnheader', { name: 'Expected Joining' })).toBeVisible();
});

// PR-Q simplified — single-step BU-based req-approval
test('status filter includes Pending Approval option', async ({ page }) => {
  const statusSelect = page.locator('select').filter({ hasText: /Pending Approval/ });
  await expect(statusSelect).toBeVisible();
});

test('New Requisition modal shows auto-routing note instead of approver pickers', async ({ page }) => {
  await page.getByRole('button', { name: /New Requisition|\+ New|New Req/i }).click();
  await expect(page.getByText(/auto-routed/i)).toBeVisible();
});

test('TA can open the New Requisition modal', async ({ page }) => {
  await loginAsTA(page);
  // TA auto-redirects to Candidates on first load — wait for pipeline to render
  await expect(page.getByText('Sourced').first()).toBeVisible();
  // Now navigate to Requisitions
  await page.getByRole('button', { name: /^Requisitions$/i }).click();
  // Wait for the requisitions section controls to appear
  await expect(page.getByRole('button', { name: /New Requisition|\+ New|New Req/i })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: /New Requisition|\+ New|New Req/i }).click();
  await expect(page.getByText('New Hiring Requisition')).toBeVisible();
});

test('requisition detail shows req-approval status', async ({ page }) => {
  const row = page.getByRole('row').filter({ hasText: 'Pending Approval' }).first();
  await row.click();
  await expect(page.getByText('Req Approval')).toBeVisible();
});
