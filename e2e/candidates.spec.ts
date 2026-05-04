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

  // PR-E / C3 — extended pipeline stages must show up in the Kanban / stage UI.
  test('extended pipeline stages (Training, Active) appear in the candidates view', async ({ page }) => {
    // Stages render either as Kanban column headers or as filter labels — match
    // either by looking for the literal text anywhere on the page.
    await expect(page.locator('body')).toContainText(/Training/);
    await expect(page.locator('body')).toContainText(/Active/);
  });
});

// PR-J.5 — Filter by owner dropdown replaces PR-J's Mine only/Show all chip.
test.describe('Filter by owner dropdown (PR-J.5)', () => {
  test('admin sees "All" first, then TAs alphabetically; defaults to All', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: /^Candidates$/i }).click();
    const select = page.getByRole('combobox', { name: /Filter by owner/i });
    await expect(select).toHaveValue('all');
    // Option order: All, then TAs alphabetical by first name.
    const options = await select.locator('option').allTextContents();
    expect(options[0]).toBe('All');
    // The remaining options should be in ascending alphabetical order
    // (Aasiya, Namita, Payal, Riddhi, Shubham, Vedika as TA seeds).
    const tasInOrder = options.slice(1);
    const sorted = [...tasInOrder].sort((a, b) => a.localeCompare(b));
    expect(tasInOrder).toEqual(sorted);
    // Admin doesn't appear in the list (Sahil, role=admin, is excluded).
    expect(tasInOrder).not.toContain('Sahil Lakshmanan');
  });

  test('TA sees themselves first, then "All", then other TAs alphabetical; defaults to themselves', async ({ page }) => {
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
  });

  test('TA selecting "All" surfaces other TAs candidates; selecting another TA filters to them', async ({ page }) => {
    await loginAsTA(page);
    const select = page.getByRole('combobox', { name: /Filter by owner/i });
    // Default is "Payal" — only her candidates (e.g. Sakthivel A — C-001) visible.
    await expect(page.locator('body')).toContainText(/Sakthivel/);
    // Switch to All — Namita-owned "Priya Sharma" should appear.
    await select.selectOption('all');
    await expect(page.locator('body')).toContainText(/Priya Sharma/);
    // Filter to a specific other TA (Namita) — she owns Priya Sharma.
    await select.selectOption('Namita');
    await expect(page.locator('body')).toContainText(/Priya Sharma/);
    // Sakthivel (Payal's) should NOT appear under Namita.
    await expect(page.locator('body')).not.toContainText(/Sakthivel/);
  });
});

// PR-J.5 — TA reassignment from the candidate detail panel.
test.describe('TA reassignment (PR-J.5)', () => {
  // Tests in this group share DB state (Playwright runs them sequentially in
  // one worker against the same backend), so each test reassigns a *different*
  // seed candidate to avoid interfering with the others. There's no per-test
  // DB reset hook in this repo.

  test('TA cannot reassign a candidate they do not own (no pencil shown)', async ({ page }) => {
    await loginAsTA(page); // Payal
    await expect(page.getByRole('combobox', { name: /Filter by owner/i })).toHaveValue('Payal');
    await page.getByRole('combobox', { name: /Filter by owner/i }).selectOption('all');
    // Priya Sharma is owned by Namita — Payal can't reassign her.
    await expect(page.getByText(/Priya Sharma/).first()).toBeVisible();
    await page.getByText(/Priya Sharma/).first().click();
    await expect(page.getByRole('button', { name: /Reassign to another TA/i })).toHaveCount(0);
  });

  test('admin reassigns Lalith Singh from Aasiya to Vedika without confirmation modal', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: /^Candidates$/i }).click();
    await expect(page.getByRole('combobox', { name: /Filter by owner/i })).toHaveValue('all');
    await expect(page.getByText(/Lalith Singh/).first()).toBeVisible();
    await page.getByText(/Lalith Singh/).first().click();
    await page.getByRole('button', { name: /Reassign to another TA/i }).click();
    await page.getByRole('combobox', { name: /Reassign TA/i }).selectOption('Vedika');
    await page.getByRole('button', { name: /^Save$/i }).click();
    // Admins skip the confirmation modal.
    await expect(page.getByRole('dialog', { name: /Confirm reassignment/i })).toHaveCount(0);
    // After save, the cell returns to display mode (pencil visible again).
    await expect(page.getByRole('button', { name: /Reassign to another TA/i })).toBeVisible();
  });

  test('TA reassigns own candidate via confirmation modal; new owner sees them in their default view', async ({ page }) => {
    // Step 1: Sign in as Payal, reassign Sakthivel A (her seed candidate) to Shubham.
    await loginAsTA(page);
    await expect(page.getByRole('combobox', { name: /Filter by owner/i })).toHaveValue('Payal');
    await expect(page.getByText(/Sakthivel A/).first()).toBeVisible();
    await page.getByText(/Sakthivel A/).first().click();
    await page.getByRole('button', { name: /Reassign to another TA/i }).click();
    await page.getByRole('combobox', { name: /Reassign TA/i }).selectOption('Shubham');
    await page.getByRole('button', { name: /^Save$/i }).click();
    const dialog = page.getByRole('dialog', { name: /Confirm reassignment/i });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Shubham');
    await dialog.getByRole('button', { name: /Confirm reassignment/i }).click();
    await expect(page.getByRole('dialog', { name: /Confirm reassignment/i })).toHaveCount(0);

    // Step 2: Sign in as Shubham — default view (filter=Shubham) should include Sakthivel.
    await loginAsOtherTA(page);
    await expect(page.getByRole('combobox', { name: /Filter by owner/i })).toHaveValue('Shubham');
    await expect(page.getByText(/Sakthivel/).first()).toBeVisible();
  });
});
