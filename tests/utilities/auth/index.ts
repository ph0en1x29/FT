/**
 * AUTH UTILITIES
 *
 * Use when project has authentication.
 * Configured for FieldPro's Supabase auth.
 */

import { Page,expect } from '@playwright/test';

// ===========================================
// CONFIGURATION - FIELDPRO SPECIFIC
// ===========================================

const AUTH_CONFIG = {
  loginUrl: '/login',
  logoutUrl: '/logout',

  // Selectors - FieldPro specific
  selectors: {
    email: 'input[type="email"], input[name="email"], #email, [data-testid="email"]',
    password: 'input[type="password"], input[name="password"], #password, [data-testid="password"]',
    submit: 'button[type="submit"], [data-testid="login-button"]',
    loggedInIndicator: '[data-testid="user-menu"], .user-avatar, .logout-button, nav a[href*="logout"]',
    error: '.error, [data-testid="error"], [role="alert"], .text-red-500',
  },

  // URL patterns after login
  successUrlPattern: /dashboard|home|app|\/$/,
};

// ===========================================
// LOGIN HELPER
// ===========================================

export async function login(
  page: Page,
  email: string,
  password: string,
  options: Partial<typeof AUTH_CONFIG> = {}
): Promise<boolean> {
  const config = { ...AUTH_CONFIG, ...options };

  await page.goto(config.loginUrl);

  // Fill credentials
  await page.fill(config.selectors.email, email);
  await page.fill(config.selectors.password, password);

  // Submit
  await page.click(config.selectors.submit);

  // Wait for result
  try {
    await page.waitForURL(config.successUrlPattern, { timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

// ===========================================
// LOGOUT HELPER
// ===========================================

export async function logout(page: Page, logoutUrl = AUTH_CONFIG.logoutUrl): Promise<void> {
  await page.goto(logoutUrl);
  // Or click logout button if needed:
  // await page.click('[data-testid="logout-button"]');
}

// ===========================================
// CHECK LOGIN STATE
// ===========================================

export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    await page.waitForSelector(AUTH_CONFIG.selectors.loggedInIndicator, { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

// ===========================================
// PERMISSION TESTS
// ===========================================

export async function testProtectedRoute(
  page: Page,
  url: string,
  shouldRedirectToLogin = true
): Promise<{ accessible: boolean; redirectedToLogin: boolean }> {
  await page.goto(url);
  await page.waitForTimeout(1000);

  const currentUrl = page.url();
  const redirectedToLogin = currentUrl.includes('login') || currentUrl.includes('signin');
  const accessible = !redirectedToLogin;

  if (shouldRedirectToLogin) {
    expect(redirectedToLogin, `Protected route ${url} should redirect to login`).toBeTruthy();
  }

  return { accessible, redirectedToLogin };
}

export async function testRoleAccess(
  page: Page,
  routes: { url: string; allowedRoles: string[] }[],
  currentRole: string
): Promise<{ url: string; expected: boolean; actual: boolean; passed: boolean }[]> {
  const results = [];

  for (const route of routes) {
    const expected = route.allowedRoles.includes(currentRole);

    await page.goto(route.url);
    await page.waitForTimeout(500);

    const currentUrl = page.url();
    const blocked = currentUrl.includes('login') ||
                   currentUrl.includes('unauthorized') ||
                   currentUrl.includes('403');
    const actual = !blocked;

    results.push({
      url: route.url,
      expected,
      actual,
      passed: expected === actual,
    });
  }

  return results;
}

// ===========================================
// AUTH FLOW TESTS
// ===========================================

export async function testLoginWithInvalidCredentials(page: Page): Promise<boolean> {
  await page.goto(AUTH_CONFIG.loginUrl);

  await page.fill(AUTH_CONFIG.selectors.email, 'invalid@test.com');
  await page.fill(AUTH_CONFIG.selectors.password, 'wrongpassword');
  await page.click(AUTH_CONFIG.selectors.submit);

  await page.waitForTimeout(1000);

  // Should show error or stay on login page
  const hasError = await page.locator(AUTH_CONFIG.selectors.error).isVisible().catch(() => false);
  const stillOnLogin = page.url().includes('login');

  return hasError || stillOnLogin;
}

export async function testSessionPersistence(page: Page, email: string, password: string): Promise<boolean> {
  // Login
  await login(page, email, password);

  // Refresh page
  await page.reload();

  // Should still be logged in
  return isLoggedIn(page);
}

// ===========================================
// ROLE-BASED LOGIN HELPER
// ===========================================

export type TestRole = 'admin' | 'supervisor' | 'technician' | 'accountant';

const ROLE_CREDENTIALS: Record<TestRole, { emailVar: string; passwordVar: string }> = {
  admin: { emailVar: 'TEST_ADMIN_EMAIL', passwordVar: 'TEST_ADMIN_PASSWORD' },
  supervisor: { emailVar: 'TEST_SUPERVISOR_EMAIL', passwordVar: 'TEST_SUPERVISOR_PASSWORD' },
  technician: { emailVar: 'TEST_TECHNICIAN_EMAIL', passwordVar: 'TEST_TECHNICIAN_PASSWORD' },
  accountant: { emailVar: 'TEST_ACCOUNTANT_EMAIL', passwordVar: 'TEST_ACCOUNTANT_PASSWORD' },
};

/**
 * Login as a specific role using environment variables.
 * Requires TEST_[ROLE]_EMAIL and TEST_[ROLE]_PASSWORD in .env.local
 *
 * Returns true if login succeeded, false if login failed.
 * Throws error if credentials are not configured in environment.
 */
export async function loginAs(page: Page, role: TestRole): Promise<boolean> {
  const creds = ROLE_CREDENTIALS[role];
  const email = process.env[creds.emailVar];
  const password = process.env[creds.passwordVar];

  if (!email || !password) {
    throw new Error(`Missing credentials for ${role}. Set ${creds.emailVar} and ${creds.passwordVar} in .env.local`);
  }

  // Navigate to login
  await page.goto('/login');
  await page.waitForTimeout(1000);

  // Fill credentials
  await page.fill(AUTH_CONFIG.selectors.email, email);
  await page.fill(AUTH_CONFIG.selectors.password, password);

  // Submit
  await page.click(AUTH_CONFIG.selectors.submit);

  // Wait for login to process - give Supabase time to respond
  await page.waitForTimeout(5000);

  // FT uses client-side auth - check if login form is still visible
  // Check multiple times to handle loading states
  for (let i = 0; i < 3; i++) {
    const loginFormVisible = await page.locator('input[type="email"]').isVisible().catch(() => false);
    if (loginFormVisible) {
      console.log(`Login failed for ${role} (${email}) - login form still visible`);
      return false;
    }
    // Also check for "Sign in" button text which indicates login form
    const signInButton = await page.locator('button:has-text("Sign In")').isVisible().catch(() => false);
    if (signInButton) {
      console.log(`Login failed for ${role} (${email}) - Sign In button still visible`);
      return false;
    }
    await page.waitForTimeout(500);
  }

  // Final check - look for any indicator that we're logged in
  // FT shows sidebar navigation when logged in
  const hasNavigation = await page.locator('aside, nav, [class*="sidebar"]').first().isVisible().catch(() => false);
  if (!hasNavigation) {
    // Double check login form one more time
    const loginFormVisible = await page.locator('input[type="email"]').isVisible().catch(() => false);
    if (loginFormVisible) {
      console.log(`Login failed for ${role} (${email}) - login form still visible after final check`);
      return false;
    }
  }

  return true;
}

/**
 * Check if test credentials are valid by attempting login.
 * Use this to skip tests when credentials aren't set up in Supabase.
 */
export async function hasValidCredentials(page: Page, role: TestRole): Promise<boolean> {
  try {
    return await loginAs(page, role);
  } catch {
    return false;
  }
}
