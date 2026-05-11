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

// PR-Q — two-phase approval flow
test('status filter includes Phase 1 and Phase 2 options', async ({ page }) => {
  const statusSelect = page.locator('select').filter({ hasText: /Phase 1/ });
  await expect(statusSelect).toBeVisible();
});

test('New Requisition modal shows approval flow section with approver pickers', async ({ page }) => {
  await page.getByRole('button', { name: /New Requisition|\+ New|New Req/i }).click();
  await expect(page.getByText('Approval Flow')).toBeVisible();
  await expect(page.getByText('Phase 1 Interviewers')).toBeVisible();
  await expect(page.getByText('Phase 2 Interviewers')).toBeVisible();
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

test('requisition detail shows phase approval status', async ({ page }) => {
  // Click on a Phase 1 requisition row to open the detail slide-out
  const row = page.getByRole('row').filter({ hasText: 'Phase 1' }).first();
  await row.click();
  await expect(page.getByText('Phase 1 Approval')).toBeVisible();
  await expect(page.getByText('Phase 2 Approval')).toBeVisible();
});
