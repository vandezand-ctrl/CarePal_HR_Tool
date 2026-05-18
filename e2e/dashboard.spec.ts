import { test, expect, loginAsAdmin, loginAsTA, ADMIN_EMAIL } from './helpers.js';

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

// PR-N: pencil is visible in every BU view (gate dropped). All-BUs opens the
// two-input editor; per-BU views keep the existing inline form.
test('admin sees Target HC pencil-edit in every BU view (PR-N)', async ({ page }) => {
  await page.getByRole('button', { name: /^Dashboard$/i }).click();
  const pencil = page.locator('button[title="Edit Target HC (admin)"]').first();
  // All-BUs view by default — pencil should already be there.
  await expect(pencil).toBeVisible();
  // Switching to a specific BU also shows the pencil (sanity).
  await page.getByRole('button', { name: /CPM · Lending/i }).click();
  await expect(page.locator('button[title="Edit Target HC (admin)"]').first()).toBeVisible();
});

// PR-N: full round-trip for the empty-state banner + All-BUs popover. We
// snapshot AOPs, zero them all, assert banner + edit via popover, then
// restore — keeps the rest of the test suite seeing the seeded state.
test('PR-N: empty-state banner + All-BUs popover round-trip', async ({ page, request }) => {
  const headers = { 'x-user-email': ADMIN_EMAIL };
  // 1. Snapshot current targets
  const before = await (await request.get('/api/headcount', { headers })).json();
  // 2. Zero them all so the banner trigger fires
  for (const r of before) {
    const resp = await request.put(`/api/headcount/${encodeURIComponent(r.city)}/${r.bu}`, {
      headers, data: { aop: 0 },
    });
    if (!resp.ok()) {
      const body = await resp.text();
      throw new Error(`PATCH ${r.city}/${r.bu} -> ${resp.status()} ${body}`);
    }
  }
  try {
    // beforeEach already logged us in and loaded dash with the original (now
    // stale) values. Reload to refetch the dashboard payload with all-zero
    // AOPs in it.
    await page.reload();
    await page.getByRole('button', { name: /^Dashboard$/i }).click();
    // 3. Banner is visible in All-BUs view
    await expect(page.getByTestId('aop-empty-banner')).toBeVisible();
    // 4. Click the pencil on Bangalore — All-BUs view opens the two-input editor
    const bangaloreRow = page.locator('tr', { hasText: 'Bangalore' }).first();
    await bangaloreRow.locator('button[title="Edit Target HC (admin)"]').click();
    const editor = page.getByTestId('aop-editor-all-Bangalore');
    await expect(editor).toBeVisible();
    // 5. Type values into both BU inputs and Save
    await editor.getByLabel('Target HC for Bangalore CPM').fill('5');
    await editor.getByLabel('Target HC for Bangalore IGIV').fill('3');
    await editor.getByRole('button', { name: 'Save' }).click();
    // 6. Editor closes, the row reflects the new sum (8), banner gone
    await expect(editor).toBeHidden();
    await expect(page.getByTestId('aop-empty-banner')).toBeHidden();
    // Bangalore row's Target HC cell now reads 8
    await expect(bangaloreRow).toContainText('8');
  } finally {
    // 7. Restore so subsequent tests see the seeded state
    for (const r of before) {
      await request.put(`/api/headcount/${encodeURIComponent(r.city)}/${r.bu}`, {
        headers, data: { aop: r.aop },
      });
    }
  }
});

// PR-O: cross-admin notification flow. Akhlaque edits an AOP, Sahil opens
// the Dashboard and sees a toast attributing the change to Akhlaque. Click
// "Got it" → toast disappears via the dash refetch.
test('PR-O: AOP changes by another admin appear in the toast and dismiss with Got it', async ({ page, request }) => {
  const sahilHeaders = { 'x-user-email': ADMIN_EMAIL };
  const akhlaqueHeaders = { 'x-user-email': 'akhlaque@carepalmoney.com' };

  // Snapshot for restore.
  const before = await (await request.get('/api/headcount', { headers: sahilHeaders })).json();
  const blrCpmBefore = before.find((r: { city: string; bu: string; aop: number }) => r.city === 'Bangalore' && r.bu === 'CPM').aop;

  // 1. Sahil acknowledges his current state (so last_aop_seen_at is non-null
  //    and the "brand-new admin returns []" rule doesn't fire).
  await request.post('/api/me/aop-seen', { headers: sahilHeaders });
  // Tiny delay so the next edit's updated_at is strictly after last_aop_seen_at.
  await new Promise((r) => setTimeout(r, 1100));
  // 2. Akhlaque edits Bangalore CPM.
  const editResp = await request.put('/api/headcount/Bangalore/CPM', {
    headers: akhlaqueHeaders, data: { aop: 11 },
  });
  if (!editResp.ok()) throw new Error(`PUT failed: ${editResp.status()} ${await editResp.text()}`);

  try {
    // 3. Sahil opens the Dashboard — toast visible with Akhlaque's name.
    await page.reload();
    await page.getByRole('button', { name: /^Dashboard$/i }).click();
    const toast = page.getByTestId('aop-changes-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Bangalore CPM');
    await expect(toast).toContainText('now 11');
    await expect(toast).toContainText('Akhlaque');
    // 4. Click "Got it" → backend bumps last_aop_seen_at, dash refetches, toast gone.
    await toast.getByRole('button', { name: 'Got it' }).click();
    await expect(toast).toBeHidden();
  } finally {
    // 5. Restore Bangalore CPM AOP for subsequent tests.
    await request.put('/api/headcount/Bangalore/CPM', {
      headers: sahilHeaders, data: { aop: blrCpmBefore },
    });
  }
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
    // Dashboard. The "Add Candidate" button is the signal that Candidates
    // has rendered and the redirect has settled.
    await expect(page.getByRole('button', { name: /Add Candidate/i })).toBeVisible();
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
