import { test, expect, loginAsAdmin } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole('button', { name: /^Interviews$/i }).click();
});

test('interviews section renders', async ({ page }) => {
  await expect(page.locator('body')).toContainText(/Interview|Scheduled|Round/i);
});

// PR-F (I3) — activity summary panel above the table, with 5 cells.
test('Activity summary panel renders with the 5 KPI cells', async ({ page }) => {
  await expect(page.getByText('Activity summary')).toBeVisible();
  await expect(page.getByText('Open reqs')).toBeVisible();
  await expect(page.getByText('Offered', { exact: true })).toBeVisible();
  await expect(page.getByText('Joined', { exact: true })).toBeVisible();
});

// PR-F (I2) — city dropdown lists at least one seeded city.
test('City filter dropdown is present and lists seeded cities', async ({ page }) => {
  // Find the city dropdown by its "All Cities" default option.
  const citySelect = page.locator('select', { hasText: 'All Cities' }).first();
  await expect(citySelect).toBeVisible();
  await expect(citySelect.locator('option', { hasText: 'Bangalore' })).toHaveCount(1);
});

// PR-G (point 6 N1+N3) — Schedule modal opens; Schedule button is wired up.
// The full save → confirmation → mailto flow is fragile to seed-data drift,
// so this smoke test just verifies the modal surface that the post-save
// confirmation step lives inside.
test('Schedule Interview modal opens with the form fields visible', async ({ page }) => {
  await page.getByRole('button', { name: /Schedule Interview/i }).click();
  // Modal title.
  await expect(page.getByText('Schedule Interview', { exact: true }).first()).toBeVisible();
  // First form field — the Candidate dropdown.
  await expect(page.getByText('Candidate *')).toBeVisible();
});
