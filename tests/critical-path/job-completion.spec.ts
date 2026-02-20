import { expect, test, type Page } from '@playwright/test';

test.describe('Critical Path - Job Completion', () => {
  test.use({ baseURL: 'http://localhost:3000' });

  async function login(page: Page, email: string, password: string) {
    await page.goto('/');
    await page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first().fill(email);
    await page.locator('input[type="password"], input[name="password"], input[placeholder*="password" i]').first().fill(password);
    await page.getByRole('button', { name: /sign in|log in/i }).first().click();
    await page.waitForURL(/#\//, { timeout: 15000 });
  }

  async function openRoute(page: Page, path: string) {
    await page.goto(path);
    if (!page.url().includes(path)) {
      await page.goto(`/#${path}`);
    }
    await expect.poll(() => page.url()).toContain(path);
  }

  test('technician moves job to completed', async ({ page }) => {
    await login(page, 'tech1@example.com', 'Tech123!');

    await openRoute(page, '/jobs');
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
