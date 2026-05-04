import { test, expect, loginAsAdmin, loginAsTA } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page);
  // The Headcount tab is gone in PR-C — no separate nav click needed.
});

test('headcount-style stat row + funnel + merged city table render', async ({ page }) => {
  await page.getByRole('button', { name: /^Dashboard$/i }).click();
  // 4 new headcount-focused StatCards.
  await expect(page.getByText('Target Headcount (AOP)')).toBeVisible();
  await expect(page.getByText('Active Headcount').first()).toBeVisible();
  await expect(page.getByText('At Risk (Notice + PIP)')).toBeVisible();
  await expect(page.getByText('Net Deficit').first()).toBeVisible();
  // Funnel still present.
  await expect(page.getByText('Hiring Funnel', { exact: true })).toBeVisible();
  // Merged headcount-by-city table — On Notice / PIP / In Training / Offered
  // / Deficit are the new columns.
  await expect(page.getByRole('columnheader', { name: 'On Notice' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'In Training' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Deficit' })).toBeVisible();
});

test('Headcount tab is gone from sidebar (merged into Dashboard)', async ({ page }) => {
  await expect(page.getByRole('button', { name: /^Headcount$/i })).toHaveCount(0);
});

test('city row expands to show open requisitions', async ({ page }) => {
  await page.getByRole('button', { name: /^Dashboard$/i }).click();
  const cityRow = page.locator('tr', { hasText: 'Bangalore' }).first();
  await cityRow.click();
  await expect(page.getByText(/Sakra & Kauvery|Marathahalli/)).toBeVisible();
});

test('admin sees Target HC pencil-edit after switching to a specific BU', async ({ page }) => {
  await page.getByRole('button', { name: /^Dashboard$/i }).click();
  // Pencil only appears on a per-BU view. Click the "CPM · Lending" toggle in
  // the header BU switcher.
  await page.getByRole('button', { name: /CPM · Lending/i }).click();
  const pencil = page.locator('button[title="Edit Target HC (admin)"]').first();
  await expect(pencil).toBeVisible();
});

// PR-D / R1 polish — Pending Approvals chip headline must surface the hospital,
// not the BD type. Sahil's complaint was that "City + Focus BD" alone wasn't
// enough to identify which req he was looking at.
test('Pending Approvals chip headlines with the hospital name', async ({ page }) => {
  await page.getByRole('button', { name: /^Dashboard$/i }).click();
  // Seed REQ-003 (Pending Approval) — hospital "Amrita Fortis & Marengo Faridabad"
  // OR REQ-004 (Pending Approval) — "Kokilaben Dhirubhai Ambani"
  // OR REQ-008 (Pending Approval) — "Max Smart Super Specialty"
  // Any one of these texts must appear inside the Pending Approvals card.
  const pendingCard = page.locator('div', { hasText: /^Pending Approvals/ }).first();
  await expect(pendingCard).toContainText(/Amrita|Kokilaben|Max Smart/);
});

// PR-J — TAs see a stripped-down Dashboard: no headcount StatCards, no
// Pending Approvals card. Funnel + city table remain (informational).
test.describe('TA Dashboard (PR-J)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTA(page);
    // Wait for the TA auto-redirect to Candidates to settle BEFORE clicking
    // Dashboard. Otherwise the redirect effect can fire after our click and
    // race us back to Pipeline. In production TAs don't click Dashboard
    // before `me` loads, so this is a test-only sequencing concern.
    // PR-J.5: the owner-filter dropdown defaulting to the TA's name is the
    // signal that the redirect has settled.
    await expect(page.getByRole('combobox', { name: /Filter by owner/i })).toHaveValue('Payal');
    await page.getByRole('button', { name: /^Dashboard$/i }).click();
    // Wait for Dashboard to actually mount + render (city table is the
    // last-rendered piece; if it's there, the funnel is too).
    await expect(page.getByText('Hiring Funnel', { exact: true })).toBeVisible();
  });

  test('TA does not see headcount stat cards', async ({ page }) => {
    await expect(page.getByText('Target Headcount (AOP)')).toHaveCount(0);
    await expect(page.getByText('At Risk (Notice + PIP)')).toHaveCount(0);
    await expect(page.getByText('Net Deficit')).toHaveCount(0);
  });

  test('TA does not see the Pending Approvals card', async ({ page }) => {
    await expect(page.getByText('Pending Approvals')).toHaveCount(0);
  });

  test('TA still sees the Hiring Funnel', async ({ page }) => {
    // Already asserted in beforeEach, but keep an explicit test for clarity.
    await expect(page.getByText('Hiring Funnel', { exact: true })).toBeVisible();
  });
});
