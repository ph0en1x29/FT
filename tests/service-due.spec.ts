/**
 * SERVICE DUE TAB TESTS - FieldPro
 *
 * Tests for the Fleet > Service Due tab functionality.
 * Covers: table loading, columns, priority badges, Est. Service Date.
 * Run: npx playwright test tests/service-due.spec.ts --headed
 */

import { expect,Page,test } from '@playwright/test';

// ===========================================
// CONFIGURATION
// ===========================================

const CONFIG = {
  auth: {
    loginUrl: '/login',
    emailSelector: 'input[type="email"]',
    passwordSelector: 'input[type="password"]',
    submitSelector: 'button[type="submit"]',
  },
  testUser: {
    email: 'dev@test.com',
    password: 'Dev123!',
  },
  serviceDueUrl: '/forklifts?tab=service-due',
};

// Expected table columns (matching actual ServiceDueTab component)
const EXPECTED_COLUMNS = [
  'Forklift',
  'Type',
  'Last Serviced',
  'Next Target',
  'Current',
  'Daily Usage',
  'Est. Service Date',
  'Status',
  'Action',
];

// ===========================================
// HELPERS
// ===========================================

async function loginAsAdmin(page: Page): Promise<boolean> {
  await page.goto(CONFIG.auth.loginUrl);
  await page.fill(CONFIG.auth.emailSelector, CONFIG.testUser.email);
  await page.fill(CONFIG.auth.passwordSelector, CONFIG.testUser.password);
  await page.click(CONFIG.auth.submitSelector);

  // Wait for auth resolution
  const start = Date.now();
  while (Date.now() - start < 15000) {
    // Check for sidebar (logged in)
    if (await page.locator('aside').isVisible().catch(() => false)) {
      return true;
    }
    // Still on login = credentials invalid
    if (await page.locator(CONFIG.auth.emailSelector).isVisible().catch(() => false)) {
      await page.waitForTimeout(500);
      continue;
    }
    await page.waitForTimeout(500);
  }
  return false;
}

async function navigateToServiceDue(page: Page): Promise<void> {
  // Navigate to Fleet page first via sidebar
  const fleetLink = page.locator('aside a:has-text("Fleet"), aside button:has-text("Fleet")').first();
  if (await fleetLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await fleetLink.click();
    await page.waitForTimeout(2000);
  } else {
    // Direct navigation fallback
    await page.goto('/forklifts');
    await page.waitForTimeout(2000);
  }

  // Click Service Due tab (exact match to avoid matching config buttons)
  const serviceDueTab = page.getByRole('button', { name: 'Service Due', exact: true });
  await serviceDueTab.waitFor({ state: 'visible', timeout: 10000 });
  await serviceDueTab.click();
  await page.waitForTimeout(2000);
}

// ===========================================
// TESTS
// ===========================================

test.describe('Service Due Tab', () => {

  test.beforeEach(async ({ page }) => {
    const loggedIn = await loginAsAdmin(page);
    test.skip(!loggedIn, 'Could not login - credentials may not exist in Supabase');
  });

  test('Service Due tab loads and shows table or empty state', async ({ page }) => {
    await navigateToServiceDue(page);

    // Should show either table or "All caught up" message
    const table = page.locator('table');
    const emptyState = page.locator('text=All caught up');

    await expect(table.or(emptyState)).toBeVisible({ timeout: 15000 });
  });

  test('Service Due table has required columns', async ({ page }) => {
    await navigateToServiceDue(page);

    // Wait for table or empty state
    const table = page.locator('table');
    const emptyState = page.locator('text=All caught up');

    await expect(table.or(emptyState)).toBeVisible({ timeout: 15000 });

    // Only check columns if table is visible (not empty state)
    if (await table.isVisible()) {
      for (const col of EXPECTED_COLUMNS) {
        const header = page.locator(`th:has-text("${col}")`);
        await expect(header, `Column "${col}" should be visible`).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('Priority badges show correct colors', async ({ page }) => {
    await navigateToServiceDue(page);

    const table = page.locator('table');
    const emptyState = page.locator('text=All caught up');

    await expect(table.or(emptyState)).toBeVisible({ timeout: 15000 });

    if (await table.isVisible()) {
      // Check for Overdue badges (red styling)
      const overdueBadges = page.locator('span.bg-red-100.text-red-700:has-text("Overdue")');
      const overdueBadgeCount = await overdueBadges.count();

      if (overdueBadgeCount > 0) {
        const firstOverdue = overdueBadges.first();
        await expect(firstOverdue).toBeVisible();
        await expect(firstOverdue).toHaveClass(/bg-red-100/);
        await expect(firstOverdue).toHaveClass(/text-red-700/);
      }

      // Check for Due Soon badges (amber styling)
      const dueSoonBadges = page.locator('span.bg-amber-100.text-amber-700:has-text("Due Soon")');
      const dueSoonBadgeCount = await dueSoonBadges.count();

      if (dueSoonBadgeCount > 0) {
        const firstDueSoon = dueSoonBadges.first();
        await expect(firstDueSoon).toBeVisible();
        await expect(firstDueSoon).toHaveClass(/bg-amber-100/);
        await expect(firstDueSoon).toHaveClass(/text-amber-700/);
      }

      // Check for Job Created badges (green styling)
      const jobCreatedBadges = page.locator('span.bg-green-100.text-green-700:has-text("Job Created")');
      const jobCreatedBadgeCount = await jobCreatedBadges.count();

      if (jobCreatedBadgeCount > 0) {
        const firstJobCreated = jobCreatedBadges.first();
        await expect(firstJobCreated).toBeVisible();
        await expect(firstJobCreated).toHaveClass(/bg-green-100/);
        await expect(firstJobCreated).toHaveClass(/text-green-700/);
      }

      // Log badge counts for debugging
      console.log(`Badge counts - Overdue: ${overdueBadgeCount}, Due Soon: ${dueSoonBadgeCount}, Job Created: ${jobCreatedBadgeCount}`);

      // At least one badge type should exist if table has rows
      const rowCount = await page.locator('tbody tr').count();
      if (rowCount > 0) {
        const totalBadges = overdueBadgeCount + dueSoonBadgeCount + jobCreatedBadgeCount;
        expect(totalBadges).toBeGreaterThan(0);
      }
    }
  });

  test('Est. Service Date shows correctly or dash for no data', async ({ page }) => {
    await navigateToServiceDue(page);

    const table = page.locator('table');
    const emptyState = page.locator('text=All caught up');

    await expect(table.or(emptyState)).toBeVisible({ timeout: 15000 });

    if (await table.isVisible()) {
      // Wait for daily usage data to load (background fetch)
      await page.waitForTimeout(3000);

      const rows = page.locator('tbody tr');
      const rowCount = await rows.count();

      let foundValidDate = false;
      let foundDash = false;

      for (let i = 0; i < Math.min(rowCount, 5); i++) {
        const row = rows.nth(i);
        const cells = row.locator('td');

        // Est. Service Date is column index 6 (0-based)
        const estServiceDateCell = cells.nth(6);
        const cellText = await estServiceDateCell.textContent();

        if (cellText) {
          if (cellText.includes('—') || cellText.includes('N/A')) {
            foundDash = true;
            console.log(`Row ${i}: Est. Service Date shows dash/N/A`);
          } else if (cellText.match(/\w{3}\s+\d+,?\s*\d{4}|Overdue|2\+ years/)) {
            foundValidDate = true;
            console.log(`Row ${i}: Est. Service Date = ${cellText.trim()}`);
          }
        }
      }

      // Just verify we found some content
      expect(foundValidDate || foundDash || rowCount === 0).toBeTruthy();
    }
  });

  test('Filter stat cards are visible and clickable', async ({ page }) => {
    await navigateToServiceDue(page);

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Verify stat cards exist
    const overdueCard = page.locator('button:has-text("Overdue")').first();
    const dueSoonCard = page.locator('button:has-text("Due Soon")').first();
    const jobCreatedCard = page.locator('button:has-text("Jobs Created")').first();
    const showAllButton = page.locator('button:has-text("Show All")');

    await expect(overdueCard).toBeVisible({ timeout: 10000 });
    await expect(dueSoonCard).toBeVisible({ timeout: 5000 });
    await expect(jobCreatedCard).toBeVisible({ timeout: 5000 });

    // Test clicking overdue filter
    await overdueCard.click();
    await page.waitForTimeout(500);

    // Should highlight the overdue card (border-red-500)
    const activeOverdueCard = page.locator('button.border-red-500:has-text("Overdue")');
    await expect(activeOverdueCard).toBeVisible({ timeout: 5000 });

    // Test Show All button
    await showAllButton.click();
    await page.waitForTimeout(500);

    // Show All should be highlighted
    const activeShowAll = page.locator('button.text-blue-600:has-text("Show All")');
    await expect(activeShowAll).toBeVisible({ timeout: 5000 });
  });

});
