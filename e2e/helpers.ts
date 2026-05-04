import { test as base, expect, type Page } from '@playwright/test';

// Mock-mode auth: the frontend reads localStorage.devUserEmail and the backend
// trusts the x-user-email header. setCaller() sets the email before navigation
// so the very first page load already has the desired identity.
export const ADMIN_EMAIL = 'sahil@carepalmoney.com';
// Payal is a TA who owns seed candidate C-001 (Sakthivel A) — needed so the
// "Mine only" filter in PR-J returns at least one row in tests. Akhlaque
// (formerly the TA test user) was promoted to admin in PR-J.
export const TA_EMAIL = 'payal@carepalmoney.com';
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

export async function loginAsTA(page: Page): Promise<void> {
  await setCaller(page, TA_EMAIL);
  await page.goto('/');
}

export const test = base;
export { expect };
