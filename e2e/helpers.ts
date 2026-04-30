import { test as base, expect, type Page } from '@playwright/test';

// Mock-mode auth: the frontend reads localStorage.devUserEmail and the backend
// trusts the x-user-email header. setCaller() sets the email before navigation
// so the very first page load already has the desired identity.
export const ADMIN_EMAIL = 'sahil@carepalmoney.com';
export const TA_EMAIL = 'akhlaque@carepalmoney.com';
export const APPROVER_EMAIL = 'soundappan@carepalmoney.com';

export async function setCaller(page: Page, email: string): Promise<void> {
  // Must visit the origin first so localStorage is available.
  await page.goto('/');
  await page.evaluate((e) => localStorage.setItem('devUserEmail', e), email);
}

export async function loginAsAdmin(page: Page): Promise<void> {
  await setCaller(page, ADMIN_EMAIL);
  await page.goto('/');
}

export const test = base;
export { expect };
