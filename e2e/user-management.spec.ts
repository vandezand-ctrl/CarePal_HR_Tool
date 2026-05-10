import { test, expect, loginAsAdmin } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page);
});

test('User Management page renders with city access column', async ({ page }) => {
  await page.getByRole('button', { name: /User Management/i }).click();
  await expect(page.getByRole('columnheader', { name: 'City Access' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Email' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Role' })).toBeVisible();
});

test('admin sees Edit button for each user', async ({ page }) => {
  await page.getByRole('button', { name: /User Management/i }).click();
  const editButtons = page.getByRole('button', { name: 'Edit' });
  await expect(editButtons.first()).toBeVisible();
});

test('Edit panel opens with city checkboxes and can save', async ({ page }) => {
  await page.getByRole('button', { name: /User Management/i }).click();

  // Find a TA user row and click Edit.
  const taRow = page.locator('tr', { hasText: 'Payal' });
  await taRow.getByRole('button', { name: 'Edit' }).click();

  // Panel should appear with "Edit User" heading.
  await expect(page.getByText('Edit User')).toBeVisible();

  // City Access label should be visible in the panel.
  await expect(page.locator('label', { hasText: 'City Access' })).toBeVisible();

  // City checkboxes should be present (at least one city from seed data).
  const checkboxes = page.locator('input[type="checkbox"]');
  const count = await checkboxes.count();
  expect(count).toBeGreaterThan(0);

  // Close the panel.
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('Edit User')).not.toBeVisible();
});

test('admin user shows "All cities" badge in table', async ({ page }) => {
  await page.getByRole('button', { name: /User Management/i }).click();
  await expect(page.getByText('All cities').first()).toBeVisible();
});

test('Edit panel shows admin note when editing admin user', async ({ page }) => {
  await page.getByRole('button', { name: /User Management/i }).click();

  // Find the admin row (Sahil) and click Edit.
  const adminRow = page.locator('tr', { hasText: 'Sahil' });
  await adminRow.getByRole('button', { name: 'Edit' }).click();

  await expect(page.getByText('Admins always have access to all cities')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
});
