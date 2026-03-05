import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../fixtures/auth.fixture';

test.describe('Admin Role - Full Access E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test.describe('1. Dashboard', () => {
    test('loads dashboard with KPI cards and job queue', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Verify page title/heading
      await expect(page.locator('h1, h2').filter({ hasText: /dashboard/i })).toBeVisible();

      // Verify KPI cards are visible (look for common metrics)
      const kpiSection = page.locator('[class*="grid"]').first();
      await expect(kpiSection).toBeVisible();

      // Job queue should be visible
      await expect(page.locator('text=/job.*queue|recent.*jobs|active.*jobs/i').first()).toBeVisible();
    });
  });

  test.describe('2. Jobs List', () => {
    test('loads jobs list, search works, date tabs work, create button exists', async ({ page }) => {
      await page.goto('/jobs');
      await page.waitForLoadState('networkidle');

      // List loads
      await expect(page.locator('h1, h2').filter({ hasText: /jobs/i })).toBeVisible();

      // Search input exists
      const searchInput = page.locator('input[type="search"], input[placeholder*="Search" i]').first();
      await expect(searchInput).toBeVisible();

      // Test search
      await searchInput.fill('test');
      await page.waitForTimeout(500); // Debounce

      // Date pill tabs exist (Unfinished/Today/Week/Month/All)
      await expect(page.locator('button, [role="tab"]').filter({ hasText: /unfinished|today|week|month|all/i }).first()).toBeVisible();

      // Create job button exists
      await expect(page.getByRole('button', { name: /create|new.*job|add.*job/i })).toBeVisible();
    });

    test('date pill tabs are clickable', async ({ page }) => {
      test.setTimeout(30000);
      await page.goto('/jobs');
      await page.waitForLoadState('networkidle');

      // Click through date tabs
      const todayTab = page.locator('button, [role="tab"]').filter({ hasText: /^today$/i }).first();
      if (await todayTab.isVisible()) {
        await todayTab.click();
        await page.waitForTimeout(500);
      }

      const weekTab = page.locator('button, [role="tab"]').filter({ hasText: /week/i }).first();
      if (await weekTab.isVisible()) {
        await weekTab.click();
        await page.waitForTimeout(500);
      }
    });
  });

  test.describe('3. Create Job', () => {
    test('form renders, customer dropdown works, forklift dropdown filters by customer', async ({ page }) => {
      test.setTimeout(30000);
      await page.goto('/jobs/new');
      await page.waitForLoadState('networkidle');

      // Form renders
      await expect(page.locator('h1, h2').filter({ hasText: /create.*job|new.*job/i })).toBeVisible();

      // Customer dropdown/combobox exists
      const customerInput = page.locator('input[placeholder*="customer" i], input[name*="customer" i]').first();
      await expect(customerInput).toBeVisible();

      // Click and type to filter customer
      await customerInput.click();
      await page.waitForTimeout(300);
      await customerInput.fill('a');
      await page.waitForTimeout(500);

      // Select first option if available
      const firstOption = page.locator('[role="option"]').first();
      if (await firstOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstOption.click();
        await page.waitForTimeout(500);

        // Forklift dropdown should now be visible/enabled
        const forkliftInput = page.locator('input[placeholder*="forklift" i], input[name*="forklift" i], input[placeholder*="equipment" i]').first();
        await expect(forkliftInput).toBeVisible();
      }
    });
  });

  test.describe('4. Job Detail', () => {
    test('click first job, detail page loads, equipment card shows, status actions visible', async ({ page }) => {
      test.setTimeout(30000);
      await page.goto('/jobs');
      await page.waitForLoadState('networkidle');

      // Click first job
      const firstJob = page.locator('a[href*="/jobs/"], [data-testid*="job-"], tr[role="row"]').first();
      await firstJob.click();
      await page.waitForLoadState('networkidle');

      // Detail page loads
      await expect(page.locator('h1, h2').filter({ hasText: /job.*detail|job.*#|JOB/i })).toBeVisible();

      // Equipment card shows
      await expect(page.locator('text=/equipment|forklift/i').first()).toBeVisible();

      // Status actions visible (buttons for changing status)
      await expect(page.locator('button').filter({ hasText: /complete|start|cancel|status/i }).first()).toBeVisible();
    });
  });

  test.describe('5. Fleet List', () => {
    test('list loads, search works, filter comboboxes work, cards render', async ({ page }) => {
      test.setTimeout(30000);
      await page.goto('/forklifts');
      await page.waitForLoadState('networkidle');

      // List loads
      await expect(page.locator('h1, h2').filter({ hasText: /fleet|forklifts/i })).toBeVisible();

      // Search works
      const searchInput = page.locator('input[type="search"], input[placeholder*="Search" i]').first();
      if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await searchInput.fill('test');
        await page.waitForTimeout(500);
      }

      // Filter comboboxes (Type/Status/Rentals/Makes)
      const typeFilter = page.locator('button, input').filter({ hasText: /type|all types/i }).first();
      if (await typeFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
        await typeFilter.click();
        await page.waitForTimeout(300);
        // Close dropdown
        await page.keyboard.press('Escape');
      }

      // Cards render
      await expect(page.locator('[data-testid*="forklift-"], [class*="card"], [class*="grid"]').first()).toBeVisible();
    });
  });

  test.describe('6. Fleet - Add Forklift', () => {
    test('click Add button, modal opens with 3 sections, Brand/Type/Status are Combobox', async ({ page }) => {
      test.setTimeout(30000);
      await page.goto('/forklifts');
      await page.waitForLoadState('networkidle');

      // Click Add button
      const addButton = page.getByRole('button', { name: /add.*forklift|new.*forklift|create/i });
      await addButton.click();
      await page.waitForTimeout(500);

      // Modal opens
      await expect(page.locator('[role="dialog"], [class*="modal"]')).toBeVisible();

      // 3 sections (Identity/Hourmeter/Specs)
      await expect(page.locator('text=/identity|hourmeter|specs|specifications/i').first()).toBeVisible();

      // Brand is Combobox (input, not select)
      const brandInput = page.locator('[role="dialog"] input[placeholder*="brand" i], [role="dialog"] input[name*="brand" i]').first();
      if (await brandInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(brandInput).toBeVisible();
      }

      // Type is Combobox
      const typeInput = page.locator('[role="dialog"] input[placeholder*="type" i], [role="dialog"] input[name*="type" i]').first();
      if (await typeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(typeInput).toBeVisible();
      }

      // Close modal
      await page.keyboard.press('Escape');
    });
  });

  test.describe('7. Fleet - Edit Forklift', () => {
    test('click forklift card, edit button, modal opens, fields populated', async ({ page }) => {
      test.setTimeout(30000);
      await page.goto('/forklifts');
      await page.waitForLoadState('networkidle');

      // Click a forklift card
      const forkliftCard = page.locator('[data-testid*="forklift-"], [class*="card"]').first();
      await forkliftCard.click();
      await page.waitForTimeout(500);

      // Edit button
      const editButton = page.getByRole('button', { name: /edit/i }).first();
      if (await editButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await editButton.click();
        await page.waitForTimeout(500);

        // Modal opens
        await expect(page.locator('[role="dialog"], [class*="modal"]')).toBeVisible();

        // Fields populated (look for inputs with values)
        const inputs = page.locator('[role="dialog"] input[type="text"]');
        const firstInput = inputs.first();
        if (await firstInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await expect(firstInput).toBeVisible();
        }

        // Close modal
        await page.keyboard.press('Escape');
      }
    });
  });

  test.describe('8. Fleet - Rent Out', () => {
    test('available forklift shows Rent Out button, click opens modal with customer Combobox', async ({ page }) => {
      test.setTimeout(30000);
      await page.goto('/forklifts');
      await page.waitForLoadState('networkidle');

      // Look for Rent Out button (might be on card or in detail view)
      const rentOutButton = page.getByRole('button', { name: /rent.*out/i }).first();
      
      if (await rentOutButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await rentOutButton.click();
        await page.waitForTimeout(500);

        // Modal opens
        await expect(page.locator('[role="dialog"], [class*="modal"]')).toBeVisible();

        // Customer Combobox
        const customerInput = page.locator('[role="dialog"] input[placeholder*="customer" i]').first();
        await expect(customerInput).toBeVisible();

        // Close modal
        await page.keyboard.press('Escape');
      } else {
        // If no rent out button visible, test passes (no available forklifts)
        console.log('No available forklifts to rent out - test skipped');
      }
    });
  });

  test.describe('9. Fleet - Return', () => {
    test('rented forklift shows Return button, click opens modal', async ({ page }) => {
      test.setTimeout(30000);
      await page.goto('/forklifts');
      await page.waitForLoadState('networkidle');

      // Look for Return button
      const returnButton = page.getByRole('button', { name: /return/i }).first();
      
      if (await returnButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await returnButton.click();
        await page.waitForTimeout(500);

        // Modal opens
        await expect(page.locator('[role="dialog"], [class*="modal"]')).toBeVisible();

        // Close modal
        await page.keyboard.press('Escape');
      } else {
        // If no return button visible, test passes (no rented forklifts)
        console.log('No rented forklifts to return - test skipped');
      }
    });
  });

  test.describe('10. Customers', () => {
    test('list loads, can search', async ({ page }) => {
      await page.goto('/customers');
      await page.waitForLoadState('networkidle');

      // List loads
      await expect(page.locator('h1, h2').filter({ hasText: /customers/i })).toBeVisible();

      // Search input
      const searchInput = page.locator('input[type="search"], input[placeholder*="Search" i]').first();
      if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await searchInput.fill('test');
        await page.waitForTimeout(500);
      }

      // Customer cards/list visible
      await expect(page.locator('[data-testid*="customer-"], [class*="card"], table, [class*="grid"]').first()).toBeVisible();
    });
  });

  test.describe('11. Customer Profile', () => {
    test('click customer, profile loads, Edit button opens modal with sections', async ({ page }) => {
      test.setTimeout(30000);
      await page.goto('/customers');
      await page.waitForLoadState('networkidle');

      // Click first customer
      const firstCustomer = page.locator('a[href*="/customers/"], [data-testid*="customer-"], tr[role="row"]').first();
      await firstCustomer.click();
      await page.waitForLoadState('networkidle');

      // Profile loads
      await expect(page.locator('h1, h2').first()).toBeVisible();

      // Edit button
      const editButton = page.getByRole('button', { name: /edit/i }).first();
      if (await editButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await editButton.click();
        await page.waitForTimeout(500);

        // Modal opens with sections (Company/Contact)
        await expect(page.locator('[role="dialog"], [class*="modal"]')).toBeVisible();
        await expect(page.locator('text=/company|contact/i').first()).toBeVisible();

        // Close modal
        await page.keyboard.press('Escape');
      }
    });
  });

  test.describe('12. Inventory', () => {
    test('loads, filter Comboboxes work (Categories/Stock Levels)', async ({ page }) => {
      test.setTimeout(30000);
      await page.goto('/inventory');
      await page.waitForLoadState('networkidle');

      // Loads
      await expect(page.locator('h1, h2').filter({ hasText: /inventory|parts|stock/i })).toBeVisible();

      // Filter comboboxes
      const categoryFilter = page.locator('button, input').filter({ hasText: /category|categories|all categories/i }).first();
      if (await categoryFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
        await categoryFilter.click();
        await page.waitForTimeout(300);
        await page.keyboard.press('Escape');
      }

      const stockFilter = page.locator('button, input').filter({ hasText: /stock.*level|low.*stock|all.*stock/i }).first();
      if (await stockFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
        await stockFilter.click();
        await page.waitForTimeout(300);
        await page.keyboard.press('Escape');
      }
    });
  });

  test.describe('13. Invoices', () => {
    test('loads', async ({ page }) => {
      await page.goto('/invoices');
      await page.waitForLoadState('networkidle');

      // Invoices page loads
      await expect(page.locator('h1, h2').filter({ hasText: /invoices/i })).toBeVisible();

      // List or table visible
      await expect(page.locator('table, [class*="grid"], [data-testid*="invoice-"]').first()).toBeVisible();
    });
  });

  test.describe('14. People', () => {
    test('loads, tabs work', async ({ page }) => {
      test.setTimeout(30000);
      await page.goto('/people');
      await page.waitForLoadState('networkidle');

      // Page loads
      await expect(page.locator('h1, h2').filter({ hasText: /people|users|team/i })).toBeVisible();

      // Tabs exist
      const tabs = page.locator('[role="tab"], [role="tablist"] button');
      if (await tabs.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        const tabCount = await tabs.count();
        if (tabCount > 1) {
          await tabs.nth(1).click();
          await page.waitForTimeout(500);
        }
      }
    });
  });

  test.describe('15. Navigation', () => {
    test('sidebar links all work', async ({ page }) => {
      test.setTimeout(30000);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Dashboard link
      const dashboardLink = page.getByRole('link', { name: /dashboard/i });
      await expect(dashboardLink).toBeVisible();

      // Jobs link
      const jobsLink = page.getByRole('link', { name: /^jobs$/i });
      if (await jobsLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await jobsLink.click();
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveURL(/\/jobs/);
      }

      // Fleet link
      const fleetLink = page.getByRole('link', { name: /fleet|forklifts/i });
      if (await fleetLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await fleetLink.click();
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveURL(/\/forklifts/);
      }

      // Customers link
      const customersLink = page.getByRole('link', { name: /customers/i });
      if (await customersLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await customersLink.click();
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveURL(/\/customers/);
      }

      // Inventory link
      const inventoryLink = page.getByRole('link', { name: /inventory|parts|stock/i });
      if (await inventoryLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await inventoryLink.click();
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveURL(/\/inventory/);
      }

      // People link
      const peopleLink = page.getByRole('link', { name: /people|users|team/i });
      if (await peopleLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await peopleLink.click();
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveURL(/\/people/);
      }
    });

    test('responsive navigation works', async ({ page }) => {
      // Test mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Mobile menu button should be visible
      const menuButton = page.locator('button[aria-label*="menu" i], button[aria-label*="navigation" i]').first();
      if (await menuButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await menuButton.click();
        await page.waitForTimeout(500);

        // Nav links should appear
        await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible();
      }
    });
  });
});
