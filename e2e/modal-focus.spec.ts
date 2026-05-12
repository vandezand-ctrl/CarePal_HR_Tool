// F-2: focus-trap-react wraps every modal so Tab/Shift-Tab stay inside the
// modal and Escape closes it. These are smoke tests for the trap behavior;
// per-modal feature tests live in their own spec files.

import { test, expect, loginAsAdmin } from './helpers.js';

test.describe('Modal focus trapping (F-2)', () => {
  test('Cancel Interview modal: Escape closes and focus is trapped', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: /^Interviews$/i }).click();
    // First Cancel button — admin sees it on every non-completed interview row.
    await page.getByRole('button', { name: 'Cancel' }).first().click();
    // Modal is open.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/Cancel R[12] interview for/);

    // Tab around — focus should remain inside the dialog.
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      const focusInsideDialog = await page.evaluate(() => {
        const active = document.activeElement;
        const dialog = document.querySelector('[role="dialog"]');
        return !!(active && dialog && dialog.contains(active));
      });
      expect(focusInsideDialog, `focus inside dialog after Tab #${i + 1}`).toBe(true);
    }

    // Escape closes the modal.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('Schedule Interview modal: Escape closes; Tab wraps inside dialog', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: /^Interviews$/i }).click();
    await page.getByRole('button', { name: /Schedule Interview/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Tab a few times — focus must stay within the dialog.
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => {
        const a = document.activeElement;
        const d = document.querySelector('[role="dialog"]');
        return !!(a && d && d.contains(a));
      });
      expect(inside, `focus inside dialog after Tab #${i + 1}`).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('New Requisition modal: dialog role + Tab stays inside', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: /^Requisitions$/i }).click();
    await page.getByRole('button', { name: /New Requisition/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => {
        const a = document.activeElement;
        const d = document.querySelector('[role="dialog"]');
        return !!(a && d && d.contains(a));
      });
      expect(inside).toBe(true);
    }

    // Shift-Tab should also keep focus inside.
    await page.keyboard.press('Shift+Tab');
    const stillInside = await page.evaluate(() => {
      const a = document.activeElement;
      const d = document.querySelector('[role="dialog"]');
      return !!(a && d && d.contains(a));
    });
    expect(stillInside).toBe(true);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('Nested modals: opening Cancel Interview inside Candidate detail keeps focus in the inner modal', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: /^Candidates$/i }).click();
    // Lalith Singh — has a scheduled R1 interview that can be cancelled.
    await page.getByText(/Lalith Singh/).first().click();
    const outerDialog = page.getByRole('dialog');
    await expect(outerDialog).toBeVisible();

    // Click the Cancel button on the scheduled R1 interview, if present.
    const cancelBtn = page.getByTitle('Cancel this interview (reverts candidate stage)').first();
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
      // Now TWO dialogs exist. The inner one should hold the focus trap.
      const dialogs = page.getByRole('dialog');
      await expect(dialogs).toHaveCount(2);

      // The inner dialog is the one containing "Cancel R1 interview for"
      // — focus should be inside it after tab.
      await page.keyboard.press('Tab');
      const insideInner = await page.evaluate(() => {
        const a = document.activeElement;
        const inner = Array.from(document.querySelectorAll('[role="dialog"]'))
          .find(d => d.textContent?.includes('Cancel R1 interview'));
        return !!(a && inner && inner.contains(a));
      });
      expect(insideInner).toBe(true);

      // Dismiss inner with Escape — outer should remain open.
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(1);
      await expect(outerDialog).toBeVisible();
    }
  });
});
