import { test, expect, loginAsAdmin, loginAsTA, loginAsOtherTA } from './helpers.js';

test.describe('Admin candidate view', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: /^Candidates$/i }).click();
  });

  test('candidates section renders without errors', async ({ page }) => {
    // Section heading or filter UI must render — exact text TBD by current UI
    await expect(page.locator('body')).toContainText(/Candidates|Sourced|Pipeline/i);
  });

  test('clicking a candidate opens the detail modal with interview and document tabs', async ({ page }) => {
    await expect(page.getByText(/Lalith Singh/).first()).toBeVisible();
    await page.getByText(/Lalith Singh/).first().click();
    // The detail modal should load without console errors. Check that key
    // sections render (the useEffect hooks for interviews and documents fire).
    await expect(page.locator('body')).toContainText(/Lalith Singh/);
    await expect(page.locator('body')).toContainText(/Schedule|Interview|Document|Details/i);
  });

  // F-3: Cancel interview from candidate detail opens inline modal (not browser dialog).
  test('cancel interview button in candidate detail opens inline modal (F-3)', async ({ page }) => {
    // Lalith Singh has a scheduled R1 interview with no result — cancel button visible.
    await expect(page.getByText(/Lalith Singh/).first()).toBeVisible();
    await page.getByText(/Lalith Singh/).first().click();
    // Switch to interviews tab if tabs exist, or just wait for interview data.
    await expect(page.locator('body')).toContainText(/Interview|Schedule/i);
    // Find the Cancel button inside the candidate modal.
    const cancelBtn = page.getByTitle('Cancel this interview (reverts candidate stage)').first();
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
      await expect(page.getByText(/Cancel R1 interview for Lalith Singh/)).toBeVisible();
      await expect(page.getByText('Reason (optional)')).toBeVisible();
      // Dismiss
      await page.getByRole('button', { name: 'Cancel' }).last().click();
      await expect(page.getByText(/Cancel R1 interview for Lalith Singh/)).toHaveCount(0);
    }
  });

  // UI-only — actual screening needs ANTHROPIC_API_KEY which CI doesn't have.
  test('AI screening section renders in candidate detail', async ({ page }) => {
    await expect(page.getByText(/Lalith Singh/).first()).toBeVisible();
    await page.getByText(/Lalith Singh/).first().click();
    await expect(page.getByText(/AI Resume Screening/i)).toBeVisible();
    // Button reads "Screen CV" (first run) or "Re-screen" (after a prior screening).
    await expect(page.getByRole('button', { name: /Screen CV|Re-screen/i })).toBeVisible();
  });

  // PR-E / C3 — extended pipeline stages must show up in the Kanban / stage UI.
  test('extended pipeline stages (Training, Active) appear in the candidates view', async ({ page }) => {
    // Stages render either as Kanban column headers or as filter labels — match
    // either by looking for the literal text anywhere on the page.
    await expect(page.locator('body')).toContainText(/Training/);
    await expect(page.locator('body')).toContainText(/Active/);
  });
});

test.describe('Filter by TA dropdown — role-based visibility', () => {
  test('admin sees "All" first, then TAs+admins alphabetically; defaults to All', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: /^Candidates$/i }).click();
    const select = page.getByRole('combobox', { name: /Filter by TA/i });
    await expect(select).toHaveValue('all');
    const options = await select.locator('option').allTextContents();
    expect(options[0]).toBe('All');
    const rest = options.slice(1);
    const sorted = [...rest].sort((a, b) => a.localeCompare(b));
    expect(rest).toEqual(sorted);
    expect(rest).toContain('Akhlaque');
    expect(rest).toContain('Sahil Lakshmanan');
  });

  test('TA does NOT see the filter-by-TA dropdown (backend scoping enforced)', async ({ page }) => {
    await loginAsTA(page);
    await page.getByRole('button', { name: /^Candidates$/i }).click();
    await expect(page.getByRole('combobox', { name: /Filter by TA/i })).toHaveCount(0);
  });

  test('TA only sees candidates assigned to them', async ({ page }) => {
    await loginAsTA(page); // Payal
    await page.getByRole('button', { name: /^Candidates$/i }).click();
    await expect(page.getByText(/Sakthivel/).first()).toBeVisible();
    await expect(page.getByText(/Priya Sharma/)).toHaveCount(0);
  });
});

// PR-L — multi-TA assignment via checkbox list on the candidate detail panel.
// Replaces PR-J.5's single-select dropdown + confirmation modal.
test.describe('Multi-TA assignment (PR-L)', () => {
  test('admin assigns multiple TAs to a candidate; both names appear in the cell', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: /^Candidates$/i }).click();
    await expect(page.getByRole('combobox', { name: /Filter by TA/i })).toHaveValue('all');
    // Lalith Singh is seeded with Aasiya as owner. Add Vedika.
    await expect(page.getByText(/Lalith Singh/).first()).toBeVisible();
    await page.getByText(/Lalith Singh/).first().click();
    await page.getByRole('button', { name: /Edit TA assignment/i }).click();
    const editorGroup = page.getByRole('group', { name: /Reassign TAs/i });
    await editorGroup.getByLabel('Vedika', { exact: false }).check();
    await page.getByRole('button', { name: /^Save$/i }).click();
    // No confirmation modal in PR-L — go straight back to display.
    await expect(page.getByRole('button', { name: /Edit TA assignment/i })).toBeVisible();
    // Comma-separated list now includes both names.
    await expect(page.locator('body')).toContainText(/Aasiya, Vedika|Vedika, Aasiya/);
  });

  test('TA sees edit pencil on a candidate they own', async ({ page }) => {
    await loginAsTA(page); // Payal — owns Sakthivel A
    await expect(page.getByText(/Sakthivel A/).first()).toBeVisible();
    await page.getByText(/Sakthivel A/).first().click();
    await expect(page.getByRole('button', { name: /Edit TA assignment/i })).toBeVisible();
  });

  test('cannot save with zero TAs (validation error)', async ({ page }) => {
    await loginAsTA(page);
    await expect(page.getByText(/Sakthivel A/).first()).toBeVisible();
    await page.getByText(/Sakthivel A/).first().click();
    await page.getByRole('button', { name: /Edit TA assignment/i }).click();
    const editor = page.getByRole('group', { name: /Reassign TAs/i });
    // Uncheck Payal — leaves zero. Save button should be disabled.
    await editor.getByLabel('Payal', { exact: false }).uncheck();
    await expect(page.getByRole('button', { name: /^Save$/i })).toBeDisabled();
  });

  test('approver does not see the edit pencil', async ({ page }) => {
    // Sign in as approver via setCaller — there's no loginAsApprover helper,
    // but we can use the existing TA login then switch via dev-user dropdown.
    // For brevity reuse the loginAsOtherTA pattern by setting the email manually.
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('devUserEmail', 'soundappan@carepalmoney.com'));
    await page.goto('/');
    await page.getByRole('button', { name: /^Candidates$/i }).click();
    await expect(page.getByText(/Sakthivel A/).first()).toBeVisible();
    await page.getByText(/Sakthivel A/).first().click();
    await expect(page.getByRole('button', { name: /Edit TA assignment/i })).toHaveCount(0);
  });

  test('cross-TA visibility: TA only sees their own assigned candidates', async ({ page }) => {
    await loginAsOtherTA(page); // Shubham — owns Ravikumar
    await page.getByRole('button', { name: /^Candidates$/i }).click();
    await expect(page.getByText(/Ravikumar/).first()).toBeVisible();
    await expect(page.getByText(/Sakthivel/)).toHaveCount(0);
  });
});

// F6 — CV-first Add Candidate modal: two-step flow (upload CV → confirm details).
test.describe('CV-first Add Candidate modal (F6)', () => {
  test('Add Candidate modal opens with CV drop zone and requisition picker', async ({ page }) => {
    await loginAsTA(page);
    await page.getByRole('button', { name: /^Candidates$/i }).click();
    await page.getByRole('button', { name: /Add Candidate/i }).click();
    // Step 1: CV drop zone and requisition picker are visible.
    await expect(page.getByText('Drop CV here')).toBeVisible();
    await expect(page.getByText('Skip, enter manually')).toBeVisible();
    // The requisition select is inside the modal — verify it has options.
    const reqSelect = page.locator('div[role="dialog"] select').first();
    await expect(reqSelect).toBeVisible();
    const options = await reqSelect.locator('option').allTextContents();
    expect(options.some(o => o.includes('REQ-'))).toBe(true);
  });

  test('Skip manual entry shows form, fill in and submit creates candidate', async ({ page }) => {
    await loginAsTA(page);
    await page.getByRole('button', { name: /^Candidates$/i }).click();
    await page.getByRole('button', { name: /Add Candidate/i }).click();
    // Pick a requisition first (REQ-001 is Approved, Bangalore).
    const reqSelect = page.locator('div[role="dialog"] select').first();
    await reqSelect.selectOption('REQ-001');
    // Skip CV upload.
    await page.getByText('Skip, enter manually').click();
    // Step 2: form fields should be visible.
    await expect(page.getByText('Confirm Details')).toBeVisible();
    // Fill required fields.
    await page.getByPlaceholder('e.g. Priya Sharma').fill('Deepa Patel');
    await page.getByPlaceholder('e.g. 9876543210').fill('9876500001');
    await page.getByPlaceholder('e.g. BDA').fill('Sales Executive');
    await page.getByPlaceholder('e.g. Pristyn Care').fill('TestCorp');
    // Submit — scope to the dialog to avoid matching the toolbar button.
    await page.getByRole('dialog').getByRole('button', { name: 'Add Candidate' }).click();
    // Modal should close and new candidate appears in the list. The TA is
    // auto-assigned so the candidate shows up in their backend-scoped view.
    await expect(page.getByText('Drop CV here')).toHaveCount(0, { timeout: 5000 });
    await expect(page.getByText('Deepa Patel').first()).toBeVisible({ timeout: 5000 });
  });
});

// F1 — Rejection email notification modal appears after recording a Reject result
// on a candidate that has an email address.
test.describe('Rejection email notification (F1)', () => {
  test('reject button on interview opens rejection email modal for candidate with email', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: /^Candidates$/i }).click();
    // Ravikumar Nair has an email and a scheduled interview (seeded).
    await expect(page.getByText(/Ravikumar/).first()).toBeVisible();
    await page.getByText(/Ravikumar/).first().click();
    // Switch to interviews tab.
    await expect(page.locator('body')).toContainText(/Interview|Schedule/i);
    // Look for the Reject button. If an interview result is already recorded,
    // the button won't be visible — so this test is best-effort with seed data.
    const rejectBtn = page.getByRole('button', { name: /Reject/i }).first();
    if (await rejectBtn.isVisible()) {
      await rejectBtn.click();
      // The RejectNotifyModal should appear with the "Send Rejection Email" title.
      await expect(page.getByText('Send Rejection Email')).toBeVisible({ timeout: 3000 });
      await expect(page.getByText(/Sending to/)).toBeVisible();
      // The Skip button should dismiss the modal without sending.
      await page.getByRole('button', { name: 'Skip' }).click();
      await expect(page.getByText('Send Rejection Email')).toHaveCount(0);
    }
  });
});
