import { expect,Page,test } from '@playwright/test';
import {
  loginAsAccountant,
  loginAsAdmin,
  loginAsSupervisor,
  loginAsTechnician,
} from '../fixtures/auth.fixture';

async function expectDashboardLoaded(page: Page): Promise<void> {
  await expect(page).toHaveURL(/#\//);
  await expect(page.locator('aside')).toBeVisible();
  await expect(page.locator('main')).toBeVisible();
  await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
}

test.describe('Critical Path - Auth Flow', () => {
  test('Admin can sign in and load dashboard', async ({ page }) => {
    await loginAsAdmin(page);
    await expectDashboardLoaded(page);
  });

  test('Supervisor can sign in and load dashboard', async ({ page }) => {
    await loginAsSupervisor(page);
    await expectDashboardLoaded(page);
  });

  test('Technician can sign in and load dashboard', async ({ page }) => {
    await loginAsTechnician(page);
    await expectDashboardLoaded(page);
  });

  test('Accountant can sign in and load dashboard', async ({ page }) => {
    await loginAsAccountant(page);
    await expectDashboardLoaded(page);
  });
});
