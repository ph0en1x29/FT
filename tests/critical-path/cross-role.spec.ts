import { expect, test, type Page } from '@playwright/test';

test.describe('Critical Path - Cross Role', () => {
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

  test('supervisor sees completed history and accountant can open invoices with data', async ({ browser }) => {
    const supervisorContext = await browser.newContext({ baseURL: 'http://localhost:3000' });
    const supervisorPage = await supervisorContext.newPage();

    await login(supervisorPage, 'super1234@gmail.com', 'Super123!');
    await openRoute(supervisorPage, '/jobs?tab=history');
    await expect(supervisorPage.getByText(/completed/i).first()).toBeVisible({ timeout: 15000 });

    await supervisorContext.close();

    const accountantContext = await browser.newContext({ baseURL: 'http://localhost:3000' });
    const accountantPage = await accountantContext.newPage();

    await login(accountantPage, 'accountant1@example.com', 'Account123!');
    await openRoute(accountantPage, '/invoices');
    await expect(accountantPage.getByRole('heading', { name: /invoice/i }).first()).toBeVisible({ timeout: 15000 });

    const invoiceRows = accountantPage.locator(
      'table tbody tr, [data-testid*="invoice-row"], [data-testid*="invoice-item"], a[href*="invoice/"]',
    );
    await expect.poll(async () => invoiceRows.count()).toBeGreaterThan(0);

    await accountantContext.close();
  });
});
