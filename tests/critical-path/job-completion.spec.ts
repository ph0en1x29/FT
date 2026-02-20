import { expect, test } from '@playwright/test';
import { loginAsTechnician } from '../fixtures/auth.fixture';

test.describe('Critical Path - Job Completion', () => {
  test('technician moves job to completed', async ({ page }) => {
    await loginAsTechnician(page);

    await page.goto('/#/jobs');
    const firstJobLink = page.locator('a[href*="jobs/"]').first();
    await expect(firstJobLink).toBeVisible({ timeout: 15000 });
    await firstJobLink.click();
    await expect.poll(() => page.url()).toMatch(/jobs\/(?!$)[^/?#]+/);

    const startButton = page.getByRole('button', { name: /start|in progress|mark in progress/i }).first();
    await startButton.click();

    const completionNotes = `Completed by Playwright at ${new Date().toISOString()}`;
    const notesField = page.locator(
      'textarea[name*="completion" i], textarea[id*="completion" i], textarea[name*="note" i], textarea[id*="note" i]',
    ).first();
    await notesField.fill(completionNotes);

    await page.getByRole('button', { name: /complete|mark complete|finish/i }).first().click();

    await page.reload();
    await expect(page.getByText(/completed/i).first()).toBeVisible({ timeout: 15000 });
  });
});
