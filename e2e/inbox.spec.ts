import { test, expect, loginAsAdmin, loginAsTA, ADMIN_EMAIL, APPROVER_EMAIL, setCaller } from './helpers.js';

// Seed a test application via the admin-only POST /api/applications endpoint.
async function seedApplication(page: import('@playwright/test').Page) {
  const res = await page.request.post('http://localhost:4000/api/applications', {
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': ADMIN_EMAIL,
    },
    data: {
      senderEmail: 'applicant@example.com',
      senderName: 'Test Applicant',
      subject: 'BD Role Application',
      receivedAt: new Date().toISOString(),
      parsedName: 'Test Applicant',
      parsedPhone: '9876543210',
      parsedEmail: 'applicant@example.com',
      bodySnippet: 'Please find my CV attached.',
    },
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

test.describe('Inbox section (TA)', () => {
  test.beforeEach(async ({ page }) => {
    await seedApplication(page);
  });

  test('TA sees Inbox in sidebar and can open it', async ({ page }) => {
    await loginAsTA(page);
    const inboxBtn = page.getByRole('button', { name: /Inbox/i });
    await expect(inboxBtn).toBeVisible();
    await inboxBtn.click();
    await expect(page.locator('body')).toContainText(/Incoming applications/i);
  });

  test('TA sees pending application in Inbox table', async ({ page }) => {
    await loginAsTA(page);
    await page.getByRole('button', { name: /Inbox/i }).click();
    await expect(page.locator('body')).toContainText('Test Applicant');
    await expect(page.locator('body')).toContainText('applicant@example.com');
    await expect(page.locator('body')).toContainText('BD Role Application');
  });

  test('TA can accept an application and it opens the candidate form', async ({ page }) => {
    await loginAsTA(page);
    await page.getByRole('button', { name: /Inbox/i }).click();
    await page.getByRole('button', { name: /Accept/i }).first().click();
    // The NewCandidateModal opens with "Accept Application" title
    await expect(page.locator('body')).toContainText(/Accept Application/i);
    // Name should be prefilled
    const nameInput = page.locator('input[placeholder*="e.g. Priya Sharma"]');
    await expect(nameInput).toHaveValue('Test Applicant');
  });

  test('TA can reject an application', async ({ page }) => {
    await loginAsTA(page);
    await page.getByRole('button', { name: /Inbox/i }).click();
    // Count rows before rejecting
    const rowsBefore = await page.getByRole('button', { name: /Reject/i }).count();
    await page.getByRole('button', { name: /Reject/i }).first().click();
    await expect(page.locator('body')).toContainText(/Reject Application/i);
    // Type a reason and confirm
    await page.locator('textarea').fill('Not qualified');
    // Click the confirm button in the modal
    await page.getByRole('button', { name: /^Reject$/i }).last().click({ force: true });
    // One fewer reject button in the table means the row was removed
    await expect(page.getByRole('button', { name: /Reject/i })).toHaveCount(rowsBefore - 1);
  });
});

test.describe('Inbox section (Admin)', () => {
  test('admin sees Inbox in sidebar', async ({ page }) => {
    await loginAsAdmin(page);
    const inboxBtn = page.getByRole('button', { name: /Inbox/i });
    await expect(inboxBtn).toBeVisible();
  });
});

test.describe('Inbox section (Approver)', () => {
  test('approver does NOT see Inbox in sidebar', async ({ page }) => {
    await setCaller(page, APPROVER_EMAIL);
    await page.goto('/');
    const inboxBtn = page.getByRole('button', { name: /Inbox/i });
    await expect(inboxBtn).toHaveCount(0);
  });
});
