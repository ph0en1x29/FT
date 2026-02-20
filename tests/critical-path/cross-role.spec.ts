import { expect, test } from '@playwright/test';
import { loginAsAccountant, loginAsSupervisor } from '../fixtures/auth.fixture';

test.describe('Critical Path - Cross Role', () => {
  test('supervisor sees completed history and accountant can open invoices with data', async ({ browser }) => {
    const supervisorContext = await browser.newContext({ baseURL: 'http://localhost:3000' });
    const supervisorPage = await supervisorContext.newPage();

    await loginAsSupervisor(supervisorPage);
    await supervisorPage.goto('/#/jobs?tab=history');
    await expect(supervisorPage.getByText(/completed/i).first()).toBeVisible({ timeout: 15000 });

    await supervisorContext.close();

    const accountantContext = await browser.newContext({ baseURL: 'http://localhost:3000' });
    const accountantPage = await accountantContext.newPage();

    await loginAsAccountant(accountantPage);
    await accountantPage.goto('/#/invoices');
    await expect(accountantPage.getByRole('heading', { name: /invoice/i }).first()).toBeVisible({ timeout: 15000 });

    const invoiceRows = accountantPage.locator(
      'table tbody tr, [data-testid*="invoice-row"], [data-testid*="invoice-item"], a[href*="invoice/"]',
    );
    await expect.poll(async () => invoiceRows.count()).toBeGreaterThan(0);

    await accountantContext.close();
  });
});
