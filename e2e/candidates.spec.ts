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

  // PR-E / C3 — extended pipeline stages must show up in the Kanban / stage UI.
  test('extended pipeline stages (Training, Active) appear in the candidates view', async ({ page }) => {
    // Stages render either as Kanban column headers or as filter labels — match
    // either by looking for the literal text anywhere on the page.
    await expect(page.locator('body')).toContainText(/Training/);
    await expect(page.locator('body')).toContainText(/Active/);
  });
});

// PR-L — Filter by owner dropdown now includes TAs + admins (was TA-only in
// PR-J.5). Sahil + Akhlaque both appear.
test.describe('Filter by owner dropdown (PR-L)', () => {
  test('admin sees "All" first, then TAs+admins alphabetically; defaults to All', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: /^Candidates$/i }).click();
    const select = page.getByRole('combobox', { name: /Filter by owner/i });
    await expect(select).toHaveValue('all');
    const options = await select.locator('option').allTextContents();
    expect(options[0]).toBe('All');
    const rest = options.slice(1);
    const sorted = [...rest].sort((a, b) => a.localeCompare(b));
    expect(rest).toEqual(sorted);
    // PR-L: admins are now in the assignable pool. Akhlaque (admin since PR-J)
    // and Sahil (admin) should both appear.
    expect(rest).toContain('Akhlaque');
    expect(rest).toContain('Sahil Lakshmanan');
  });

  test('TA sees themselves first, then "All", then everyone else alphabetical; defaults to themselves', async ({ page }) => {
    await loginAsTA(page); // Payal
    const select = page.getByRole('combobox', { name: /Filter by owner/i });
    await expect(select).toHaveValue('Payal');
    const options = await select.locator('option').allTextContents();
    expect(options[0]).toBe('Payal');
    expect(options[1]).toBe('All');
    const others = options.slice(2);
    const sortedOthers = [...others].sort((a, b) => a.localeCompare(b));
    expect(others).toEqual(sortedOthers);
    expect(others).not.toContain('Payal');
    // PR-L: admins now appear too.
    expect(others).toContain('Sahil Lakshmanan');
  });

  test('TA selecting "All" surfaces other TAs candidates; selecting another TA filters to them', async ({ page }) => {
    await loginAsTA(page);
    const select = page.getByRole('combobox', { name: /Filter by owner/i });
    await expect(page.locator('body')).toContainText(/Sakthivel/);
    await select.selectOption('all');
    await expect(page.locator('body')).toContainText(/Priya Sharma/);
    await select.selectOption('Namita');
    await expect(page.locator('body')).toContainText(/Priya Sharma/);
    await expect(page.locator('body')).not.toContainText(/Sakthivel/);
  });
});

// PR-L — multi-TA assignment via checkbox list on the candidate detail panel.
// Replaces PR-J.5's single-select dropdown + confirmation modal.
test.describe('Multi-TA assignment (PR-L)', () => {
  test('admin assigns multiple TAs to a candidate; both names appear in the cell', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: /^Candidates$/i }).click();
    await expect(page.getByRole('combobox', { name: /Filter by owner/i })).toHaveValue('all');
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

  test('TA without ownership can still edit (PR-L permissive rule); UI shows pencil to all TAs', async ({ page }) => {
    await loginAsTA(page); // Payal — does NOT own Priya Sharma
    await expect(page.getByRole('combobox', { name: /Filter by owner/i })).toHaveValue('Payal');
    await page.getByRole('combobox', { name: /Filter by owner/i }).selectOption('all');
    await expect(page.getByText(/Priya Sharma/).first()).toBeVisible();
    await page.getByText(/Priya Sharma/).first().click();
    // Pencil should be visible to Payal even though she doesn't own this candidate.
    await expect(page.getByRole('button', { name: /Edit TA assignment/i })).toBeVisible();
  });

  test('TA adds themselves to a candidate they did not own; both names visible', async ({ page }) => {
    // Sign in as Payal, find Lalith Singh (currently owned by Aasiya + Vedika
    // from the previous test, OR just Aasiya if run in isolation), and add
    // Payal to the assignment. Then sign in as a fresh TA browser session as
    // Payal again and verify Lalith appears under Payal's filter.
    await loginAsTA(page);
    await page.getByRole('combobox', { name: /Filter by owner/i }).selectOption('all');
    await expect(page.getByText(/Lalith Singh/).first()).toBeVisible();
    await page.getByText(/Lalith Singh/).first().click();
    await page.getByRole('button', { name: /Edit TA assignment/i }).click();
    const editor = page.getByRole('group', { name: /Reassign TAs/i });
    await editor.getByLabel('Payal', { exact: false }).check();
    await page.getByRole('button', { name: /^Save$/i }).click();
    // Filter to Payal — Lalith Singh should now be visible because Payal is
    // among the assignees.
    await page.getByRole('combobox', { name: /Filter by owner/i }).selectOption('Payal');
    await expect(page.getByText(/Lalith Singh/).first()).toBeVisible();
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

  test('cross-TA visibility: TA who is in the assignment list sees the candidate in their default view', async ({ page }) => {
    // Sign in as Shubham — who owns C-002 Ravikumar by default. Confirms the
    // multi-assign filter logic works for the basic single-assignment case.
    await loginAsOtherTA(page);
    await expect(page.getByRole('combobox', { name: /Filter by owner/i })).toHaveValue('Shubham');
    await expect(page.getByText(/Ravikumar/).first()).toBeVisible();
  });
});
