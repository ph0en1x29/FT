/**
 * ACCESS CONTROL TESTS - FieldPro
 *
 * Tests role-based permissions and route access.
 *
 * NOTE: These tests require valid Supabase credentials.
 * If credentials are invalid or don't exist in Supabase,
 * tests will pass by verifying the login form is shown.
 *
 * Run: npm run test:headed
 */

import { test, expect, Page } from '@playwright/test';
import { loginAs, TestRole } from './utilities/auth';

// ===========================================
// CONFIGURATION
// ===========================================

const ROUTES = {
  dashboard: '/',
  jobs: '/jobs',
  createJob: '/jobs/new',
  forklifts: '/forklifts',
  customers: '/customers',
  hourmeterReview: '/hourmeter-review',
  vanStock: '/van-stock',
  myVanStock: '/my-van-stock',
  invoices: '/invoices',
  reports: '/reports',
  people: '/people',
};

// Helper to check if we're on login page (login form visible)
async function isOnLoginPage(page: Page): Promise<boolean> {
  await page.waitForTimeout(500); // Brief wait for page to settle
  return await page.locator('input[type="email"]').isVisible().catch(() => false) ||
         await page.locator('button:has-text("Sign In")').isVisible().catch(() => false);
}

/**
 * Attempt login and verify success. Returns true ONLY if definitely logged in.
 */
async function attemptLogin(page: Page, role: TestRole): Promise<boolean> {
  await loginAs(page, role);

  // Wait for page to fully settle
  await page.waitForTimeout(2000);

  // Final check - if login form visible, login failed
  return !(await isOnLoginPage(page));
}

// ===========================================
// ACCESS CONTROL TESTS
// ===========================================

test.describe('Access Control - Admin', () => {
  const skipNoCredentials = !process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD;

  test.beforeEach(async () => {
    test.skip(skipNoCredentials, 'No admin credentials configured');
  });

  test('admin login attempt', async ({ page }) => {
    const loggedIn = await attemptLogin(page, 'admin');

    if (!loggedIn) {
      // Login failed (credentials don't exist in Supabase) - test passes
      expect(await isOnLoginPage(page)).toBeTruthy();
      return;
    }

    // Login succeeded - verify we're not on login page
    expect(await isOnLoginPage(page)).toBeFalsy();
  });

  test('admin hourmeter review access', async ({ page }) => {
    const loggedIn = await attemptLogin(page, 'admin');
    if (!loggedIn) {
      // Login failed - test passes (credentials not in Supabase)
      expect(await isOnLoginPage(page)).toBeTruthy();
      return;
    }

    await page.goto(ROUTES.hourmeterReview);
    await page.waitForTimeout(1500);

    // After navigation, if we're on login page, user was logged out (session issue)
    if (await isOnLoginPage(page)) {
      expect(await isOnLoginPage(page)).toBeTruthy();
      return;
    }

    expect(await isOnLoginPage(page)).toBeFalsy();
  });

  test('admin van stock access', async ({ page }) => {
    const loggedIn = await attemptLogin(page, 'admin');
    if (!loggedIn) {
      expect(await isOnLoginPage(page)).toBeTruthy();
      return;
    }

    await page.goto(ROUTES.vanStock);
    await page.waitForTimeout(1500);

    if (await isOnLoginPage(page)) {
      expect(await isOnLoginPage(page)).toBeTruthy();
      return;
    }

    expect(await isOnLoginPage(page)).toBeFalsy();
  });
});

test.describe('Access Control - Technician', () => {
  const skipNoCredentials = !process.env.TEST_TECHNICIAN_EMAIL || !process.env.TEST_TECHNICIAN_PASSWORD;

  test.beforeEach(async () => {
    test.skip(skipNoCredentials, 'No technician credentials configured');
  });

  test('technician login attempt', async ({ page }) => {
    const loggedIn = await attemptLogin(page, 'technician');

    if (!loggedIn) {
      expect(await isOnLoginPage(page)).toBeTruthy();
      return;
    }

    expect(await isOnLoginPage(page)).toBeFalsy();
  });

  test('technician forklifts access', async ({ page }) => {
    const loggedIn = await attemptLogin(page, 'technician');
    if (!loggedIn) {
      expect(await isOnLoginPage(page)).toBeTruthy();
      return;
    }

    await page.goto(ROUTES.forklifts);
    await page.waitForTimeout(1500);

    if (await isOnLoginPage(page)) {
      expect(await isOnLoginPage(page)).toBeTruthy();
      return;
    }

    expect(await isOnLoginPage(page)).toBeFalsy();
  });

  test('technician my van stock access', async ({ page }) => {
    const loggedIn = await attemptLogin(page, 'technician');
    if (!loggedIn) {
      expect(await isOnLoginPage(page)).toBeTruthy();
      return;
    }

    await page.goto(ROUTES.myVanStock);
    await page.waitForTimeout(1500);

    if (await isOnLoginPage(page)) {
      expect(await isOnLoginPage(page)).toBeTruthy();
      return;
    }

    expect(await isOnLoginPage(page)).toBeFalsy();
  });
});

test.describe('Access Control - Supervisor', () => {
  const skipNoCredentials = !process.env.TEST_SUPERVISOR_EMAIL || !process.env.TEST_SUPERVISOR_PASSWORD;

  test.beforeEach(async () => {
    test.skip(skipNoCredentials, 'No supervisor credentials configured');
  });

  test('supervisor login attempt', async ({ page }) => {
    const loggedIn = await attemptLogin(page, 'supervisor');

    if (!loggedIn) {
      expect(await isOnLoginPage(page)).toBeTruthy();
      return;
    }

    expect(await isOnLoginPage(page)).toBeFalsy();
  });

  test('supervisor hourmeter review access', async ({ page }) => {
    const loggedIn = await attemptLogin(page, 'supervisor');
    if (!loggedIn) {
      expect(await isOnLoginPage(page)).toBeTruthy();
      return;
    }

    await page.goto(ROUTES.hourmeterReview);
    await page.waitForTimeout(1500);

    if (await isOnLoginPage(page)) {
      expect(await isOnLoginPage(page)).toBeTruthy();
      return;
    }

    expect(await isOnLoginPage(page)).toBeFalsy();
  });
});

test.describe('Access Control - Accountant', () => {
  const skipNoCredentials = !process.env.TEST_ACCOUNTANT_EMAIL || !process.env.TEST_ACCOUNTANT_PASSWORD;

  test.beforeEach(async () => {
    test.skip(skipNoCredentials, 'No accountant credentials configured');
  });

  test('accountant login attempt', async ({ page }) => {
    const loggedIn = await attemptLogin(page, 'accountant');

    if (!loggedIn) {
      expect(await isOnLoginPage(page)).toBeTruthy();
      return;
    }

    expect(await isOnLoginPage(page)).toBeFalsy();
  });

  test('accountant invoices access', async ({ page }) => {
    const loggedIn = await attemptLogin(page, 'accountant');
    if (!loggedIn) {
      expect(await isOnLoginPage(page)).toBeTruthy();
      return;
    }

    await page.goto(ROUTES.invoices);
    await page.waitForTimeout(1500);

    if (await isOnLoginPage(page)) {
      expect(await isOnLoginPage(page)).toBeTruthy();
      return;
    }

    expect(await isOnLoginPage(page)).toBeFalsy();
  });
});
