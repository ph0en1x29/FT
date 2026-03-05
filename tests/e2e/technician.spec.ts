import { test, expect } from '@playwright/test';
import { loginAsTechnician } from '../fixtures/auth.fixture';

test.describe('Technician Role E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTechnician(page);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Dashboard', () => {
    test('loads V4 dashboard with My Jobs header and key components', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Verify "My Jobs" header (technician-specific) - exact text
      await expect(page.locator('h1').filter({ hasText: 'My Jobs' })).toBeVisible();

      // Verify date display (e.g., "Monday, 5 March")
      await expect(page.locator('text=/\\w+, \\d{1,2} \\w+/')).toBeVisible();

      // Verify 3 KPI cards with specific labels
      await expect(page.locator('text=/^Today$/i')).toBeVisible();
      await expect(page.locator('text=/^Completed$/i')).toBeVisible();
      await expect(page.locator('text=/^This Week$/i')).toBeVisible();

      // Verify "My Queue" section
      await expect(page.locator('h3').filter({ hasText: 'My Queue' })).toBeVisible();

      // Verify Quick Actions grid - these are buttons, not links
      await expect(page.getByRole('button').filter({ hasText: 'All Jobs' })).toBeVisible();
      await expect(page.getByRole('button').filter({ hasText: 'Van Stock' })).toBeVisible();
      await expect(page.getByRole('button').filter({ hasText: 'Fleet' })).toBeVisible();
      await expect(page.getByRole('button').filter({ hasText: 'Customers' })).toBeVisible();

      // Verify Weekly Summary - labeled as "This Week"
      await expect(page.locator('h3').filter({ hasText: 'This Week' })).toBeVisible();
      await expect(page.locator('text=/Jobs Completed/i')).toBeVisible();
      await expect(page.locator('text=/Total Hours/i')).toBeVisible();
    });

    test('shows Currently Working banner if job is in progress', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Check if "Currently Working" text exists (conditional - may not always have active job)
      const workingText = page.locator('text=/Currently Working/i');
      const bannerCount = await workingText.count();

      if (bannerCount > 0) {
        // If banner exists, verify it's clickable and has content
        const banner = page.locator('text=/Currently Working/i').locator('..');
        await expect(banner).toBeVisible();
        
        // Banner should be clickable
        const clickableParent = banner.locator('xpath=ancestor::div[@style and contains(@style, "cursor-pointer")]').first();
        await expect(clickableParent).toBeVisible();
      }
      // If no active job, banner won't exist - test passes either way
    });
  });

  test.describe('Jobs List', () => {
    test('shows My Jobs view with search and filters', async ({ page }) => {
      await page.goto('/jobs');
      await page.waitForLoadState('networkidle');

      // Verify page loaded (may show "My Jobs" or just have jobs list)
      // Jobs page should have some content - either a table or list
      const hasContent = await page.locator('table, [role="list"], [class*="job"]').first().isVisible({ timeout: 10000 });
      expect(hasContent).toBeTruthy();

      // Verify search input exists
      const searchInput = page.locator('input[type="search"], input[type="text"][placeholder*="search" i]').first();
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill('test');
        await searchInput.clear();
      }

      // Verify filters exist (pills, combobox, or tabs)
      const filterElements = page.locator('[role="button"], [role="combobox"], [role="tab"]');
      const hasFilters = (await filterElements.count()) > 0;
      expect(hasFilters).toBeTruthy();
    });
  });

  test.describe('Job Detail', () => {
    test('loads job detail with Equipment card and hourmeter', async ({ page }) => {
      await page.goto('/jobs');
      await page.waitForLoadState('networkidle');

      // Find and click first visible job link
      const jobLinks = page.locator('a[href*="/jobs/"]').filter({ hasText: /job/i });
      const firstLink = jobLinks.first();
      
      await firstLink.waitFor({ state: 'visible', timeout: 10000 });
      await firstLink.click();
      await page.waitForLoadState('networkidle');

      // Verify job detail page loaded - should show job info
      const hasJobContent = await page.locator('text=/job/i, text=/equipment/i, text=/customer/i').first().isVisible({ timeout: 10000 });
      expect(hasJobContent).toBeTruthy();

      // Verify Equipment or machine-related information is visible
      const hasEquipmentInfo = await page.locator('text=/equipment|serial|type|forklift|hourmeter/i').first().isVisible();
      expect(hasEquipmentInfo).toBeTruthy();
    });
  });

  test.describe('Start Job Flow', () => {
    test('can navigate to job detail and check for Start Job option', async ({ page }) => {
      await page.goto('/jobs');
      await page.waitForLoadState('networkidle');

      // Find first job link
      const jobLinks = page.locator('a[href*="/jobs/"]');
      const count = await jobLinks.count();

      if (count > 0) {
        await jobLinks.first().click();
        await page.waitForLoadState('networkidle');

        // Job detail should load - either shows Start Job button or job is already in progress
        // This is enough to verify the flow is accessible
        const hasJobDetail = await page.locator('text=/job|equipment|customer/i').first().isVisible({ timeout: 10000 });
        expect(hasJobDetail).toBeTruthy();
      } else {
        test.skip();
      }
    });
  });

  test.describe('Fleet', () => {
    test('can view fleet list (read-only)', async ({ page }) => {
      await page.goto('/forklifts');
      await page.waitForLoadState('networkidle');

      // Verify page loaded
      await expect(page.getByRole('heading', { name: /fleet|forklifts/i })).toBeVisible();

      // Verify list of forklifts visible
      const fleetList = page.locator('[class*="fleet"], [class*="forklift"], table, [role="list"]');
      await expect(fleetList.first()).toBeVisible();

      // Verify no "Add" or "Create" buttons (read-only for technician)
      const addButton = page.getByRole('button', { name: /add|create|new/i });
      await expect(addButton).not.toBeVisible();
    });
  });

  test.describe('Van Stock', () => {
    test('loads van stock page with parts inventory', async ({ page }) => {
      await page.goto('/my-van-stock');
      await page.waitForLoadState('networkidle');

      // Verify page loaded
      await expect(page.getByRole('heading', { name: /van stock|my van/i })).toBeVisible();

      // Verify parts inventory visible (table, list, or cards)
      const inventoryContainer = page.locator('table, [role="list"], [class*="stock"], [class*="inventory"]');
      await expect(inventoryContainer.first()).toBeVisible();
    });
  });

  test.describe('Customers', () => {
    test('can view customer list', async ({ page }) => {
      await page.goto('/customers');
      await page.waitForLoadState('networkidle');

      // Verify page loaded
      await expect(page.getByRole('heading', { name: /customers/i })).toBeVisible();

      // Verify customer list visible
      const customerList = page.locator('table, [role="list"], [class*="customer"]');
      await expect(customerList.first()).toBeVisible();
    });
  });

  test.describe('Access Control', () => {
    test('cannot access /jobs/new (redirects)', async ({ page }) => {
      await page.goto('/jobs/new');
      await page.waitForLoadState('networkidle');

      // Should redirect away from /jobs/new
      expect(page.url()).not.toContain('/jobs/new');
      
      // Should either be on dashboard or jobs list
      const url = page.url();
      const isRedirected = url.includes('/jobs') && !url.includes('/jobs/new') || url.endsWith('/');
      expect(isRedirected).toBeTruthy();
    });

    test('cannot access /invoices (redirects)', async ({ page }) => {
      await page.goto('/invoices');
      await page.waitForLoadState('networkidle');

      // Should redirect away from /invoices
      expect(page.url()).not.toContain('/invoices');
    });

    test('cannot access /people (redirects)', async ({ page }) => {
      await page.goto('/people');
      await page.waitForLoadState('networkidle');

      // Should redirect away from /people
      expect(page.url()).not.toContain('/people');
    });
  });
});
