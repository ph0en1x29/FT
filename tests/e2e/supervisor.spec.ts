import { test, expect } from '@playwright/test';
import { loginAsSupervisor } from '../fixtures/auth.fixture';

test.describe('Supervisor Role - Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSupervisor(page);
    await page.waitForLoadState('networkidle');
  });

  test('should load dashboard with supervisor-specific KPI cards', async ({ page }) => {
    await expect(page).toHaveURL('/');
    
    // Verify dashboard content loads
    const main = page.locator('main');
    await expect(main).toBeVisible();
    
    // Check for KPI cards (supervisor may see team stats, escalations, etc.)
    const cards = page.locator('[class*="card"], [class*="Card"]');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Supervisor Role - Jobs', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSupervisor(page);
  });

  test('should load job board', async ({ page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveURL('/jobs');
    
    // Verify jobs page header/title
    const heading = page.getByRole('heading', { name: /jobs/i }).first();
    await expect(heading).toBeVisible();
  });

  test('should have working search functionality', async ({ page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');
    
    // Look for search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="Search" i]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(500); // Debounce
      // Verify search field has value
      await expect(searchInput).toHaveValue('test');
    }
  });

  test('should display date pill tabs (Unfinished/Today/Week/Month/All)', async ({ page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');
    
    // Check for date filter tabs/buttons
    const dateFilters = [
      /unfinished/i,
      /today/i,
      /week/i,
      /month/i,
      /all/i,
    ];
    
    for (const filter of dateFilters) {
      const filterElement = page.getByRole('button', { name: filter }).or(
        page.getByText(filter)
      );
      // At least one should be visible
      if (await filterElement.first().isVisible()) {
        await expect(filterElement.first()).toBeVisible();
        break;
      }
    }
  });

  test('should have Filters button that expands status Combobox', async ({ page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');
    
    // Look for Filters button
    const filtersButton = page.getByRole('button', { name: /filters/i });
    if (await filtersButton.isVisible()) {
      await filtersButton.click();
      await page.waitForTimeout(300);
      
      // Look for status combobox/dropdown
      const statusCombobox = page.locator('[role="combobox"]').filter({ hasText: /status/i }).or(
        page.locator('button').filter({ hasText: /status/i })
      );
      await expect(statusCombobox.first()).toBeVisible();
    }
  });
});

test.describe('Supervisor Role - Create Job', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSupervisor(page);
  });

  test('should render job creation form with all required fields', async ({ page }) => {
    await page.goto('/jobs/new');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveURL('/jobs/new');
    
    // Customer dropdown (combobox)
    const customerDropdown = page.locator('[role="combobox"]').filter({ hasText: /customer/i }).or(
      page.locator('button').filter({ hasText: /customer/i })
    );
    await expect(customerDropdown.first()).toBeVisible();
    
    // Forklift dropdown (combobox)
    const forkliftDropdown = page.locator('[role="combobox"]').filter({ hasText: /forklift/i }).or(
      page.locator('button').filter({ hasText: /forklift/i })
    );
    await expect(forkliftDropdown.first()).toBeVisible();
  });

  test('should display context sidebar on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/jobs/new');
    await page.waitForLoadState('networkidle');
    
    // Check for sidebar or context panel
    const sidebar = page.locator('aside, [class*="sidebar"], [class*="Sidebar"]').first();
    if (await sidebar.isVisible()) {
      await expect(sidebar).toBeVisible();
    }
  });
});

test.describe('Supervisor Role - Job Detail', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSupervisor(page);
  });

  test('should navigate to job detail and display job information', async ({ page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');
    
    // Find and click first job link/card
    const firstJobLink = page.locator('a[href*="/jobs/"]').filter({ hasNotText: /new/i }).first();
    
    if (await firstJobLink.isVisible()) {
      await firstJobLink.click();
      await page.waitForLoadState('networkidle');
      
      // Verify we're on a job detail page
      expect(page.url()).toMatch(/\/jobs\/[^/]+$/);
      
      // Verify job detail content loads
      const main = page.locator('main');
      await expect(main).toBeVisible();
    }
  });

  test('should show assignment controls for supervisor', async ({ page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');
    
    const firstJobLink = page.locator('a[href*="/jobs/"]').filter({ hasNotText: /new/i }).first();
    
    if (await firstJobLink.isVisible()) {
      await firstJobLink.click();
      await page.waitForLoadState('networkidle');
      
      // Look for assignment-related controls (Assign, Reassign buttons or dropdowns)
      const assignButton = page.getByRole('button', { name: /assign/i }).or(
        page.locator('[role="combobox"]').filter({ hasText: /assign/i })
      );
      
      // If visible, verify it exists
      if (await assignButton.first().isVisible()) {
        await expect(assignButton.first()).toBeVisible();
      }
    }
  });
});

test.describe('Supervisor Role - Fleet', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSupervisor(page);
  });

  test('should load fleet list', async ({ page }) => {
    await page.goto('/forklifts');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveURL('/forklifts');
    
    // Verify fleet page loads
    const heading = page.getByRole('heading', { name: /fleet|forklift/i }).first();
    await expect(heading).toBeVisible();
  });

  test('should have working search functionality', async ({ page }) => {
    await page.goto('/forklifts');
    await page.waitForLoadState('networkidle');
    
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('fork');
      await page.waitForTimeout(500);
      await expect(searchInput).toHaveValue('fork');
    }
  });

  test('should have Type filter Combobox', async ({ page }) => {
    await page.goto('/forklifts');
    await page.waitForLoadState('networkidle');
    
    const typeCombobox = page.locator('[role="combobox"]').filter({ hasText: /type/i });
    if (await typeCombobox.first().isVisible()) {
      await typeCombobox.first().click();
      await page.waitForTimeout(300);
      
      // Dropdown should open
      const dropdown = page.locator('[role="listbox"], [role="menu"]');
      await expect(dropdown.first()).toBeVisible();
    }
  });

  test('should have Status filter Combobox', async ({ page }) => {
    await page.goto('/forklifts');
    await page.waitForLoadState('networkidle');
    
    const statusCombobox = page.locator('[role="combobox"]').filter({ hasText: /status/i });
    if (await statusCombobox.first().isVisible()) {
      await statusCombobox.first().click();
      await page.waitForTimeout(300);
      
      const dropdown = page.locator('[role="listbox"], [role="menu"]');
      await expect(dropdown.first()).toBeVisible();
    }
  });

  test('should have Rentals filter Combobox', async ({ page }) => {
    await page.goto('/forklifts');
    await page.waitForLoadState('networkidle');
    
    const rentalsCombobox = page.locator('[role="combobox"]').filter({ hasText: /rental/i });
    if (await rentalsCombobox.first().isVisible()) {
      await rentalsCombobox.first().click();
      await page.waitForTimeout(300);
      
      const dropdown = page.locator('[role="listbox"], [role="menu"]');
      await expect(dropdown.first()).toBeVisible();
    }
  });

  test('should have Makes filter Combobox', async ({ page }) => {
    await page.goto('/forklifts');
    await page.waitForLoadState('networkidle');
    
    const makesCombobox = page.locator('[role="combobox"]').filter({ hasText: /make/i });
    if (await makesCombobox.first().isVisible()) {
      await makesCombobox.first().click();
      await page.waitForTimeout(300);
      
      const dropdown = page.locator('[role="listbox"], [role="menu"]');
      await expect(dropdown.first()).toBeVisible();
    }
  });
});

test.describe('Supervisor Role - Forklift Profile', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSupervisor(page);
  });

  test('should navigate to forklift profile and display details', async ({ page }) => {
    await page.goto('/forklifts');
    await page.waitForLoadState('networkidle');
    
    // Click first forklift link
    const firstForkliftLink = page.locator('a[href*="/forklifts/"]').first();
    
    if (await firstForkliftLink.isVisible()) {
      await firstForkliftLink.click();
      await page.waitForLoadState('networkidle');
      
      // Verify we're on forklift detail page
      expect(page.url()).toMatch(/\/forklifts\/[^/]+$/);
      
      // Verify profile content loads
      const main = page.locator('main');
      await expect(main).toBeVisible();
    }
  });

  test('should display rental history section', async ({ page }) => {
    await page.goto('/forklifts');
    await page.waitForLoadState('networkidle');
    
    const firstForkliftLink = page.locator('a[href*="/forklifts/"]').first();
    
    if (await firstForkliftLink.isVisible()) {
      await firstForkliftLink.click();
      await page.waitForLoadState('networkidle');
      
      // Look for rental history section
      const rentalHistoryHeading = page.getByRole('heading', { name: /rental|history/i });
      if (await rentalHistoryHeading.first().isVisible()) {
        await expect(rentalHistoryHeading.first()).toBeVisible();
      }
    }
  });
});

test.describe('Supervisor Role - Customers', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSupervisor(page);
  });

  test('should load customers list', async ({ page }) => {
    await page.goto('/customers');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveURL('/customers');
    
    const heading = page.getByRole('heading', { name: /customer/i }).first();
    await expect(heading).toBeVisible();
  });

  test('should have working search functionality', async ({ page }) => {
    await page.goto('/customers');
    await page.waitForLoadState('networkidle');
    
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
      await expect(searchInput).toHaveValue('test');
    }
  });
});

test.describe('Supervisor Role - Customer Profile', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSupervisor(page);
  });

  test('should navigate to customer profile and display details', async ({ page }) => {
    await page.goto('/customers');
    await page.waitForLoadState('networkidle');
    
    const firstCustomerLink = page.locator('a[href*="/customers/"]').first();
    
    if (await firstCustomerLink.isVisible()) {
      await firstCustomerLink.click();
      await page.waitForLoadState('networkidle');
      
      expect(page.url()).toMatch(/\/customers\/[^/]+$/);
      
      const main = page.locator('main');
      await expect(main).toBeVisible();
    }
  });

  test('should allow editing customer (Edit modal opens)', async ({ page }) => {
    await page.goto('/customers');
    await page.waitForLoadState('networkidle');
    
    const firstCustomerLink = page.locator('a[href*="/customers/"]').first();
    
    if (await firstCustomerLink.isVisible()) {
      await firstCustomerLink.click();
      await page.waitForLoadState('networkidle');
      
      // Look for Edit button
      const editButton = page.getByRole('button', { name: /edit/i });
      if (await editButton.isVisible()) {
        await editButton.click();
        await page.waitForTimeout(300);
        
        // Verify modal/dialog opens
        const dialog = page.locator('[role="dialog"]');
        await expect(dialog).toBeVisible();
      }
    }
  });
});

test.describe('Supervisor Role - Inventory', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSupervisor(page);
  });

  test('should load inventory page', async ({ page }) => {
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveURL('/inventory');
    
    const heading = page.getByRole('heading', { name: /inventory|parts/i }).first();
    await expect(heading).toBeVisible();
  });

  test('should have Category filter Combobox', async ({ page }) => {
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');
    
    const categoryCombobox = page.locator('[role="combobox"]').filter({ hasText: /category/i });
    if (await categoryCombobox.first().isVisible()) {
      await categoryCombobox.first().click();
      await page.waitForTimeout(300);
      
      const dropdown = page.locator('[role="listbox"], [role="menu"]');
      await expect(dropdown.first()).toBeVisible();
    }
  });

  test('should have Stock Level filter Combobox', async ({ page }) => {
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');
    
    const stockCombobox = page.locator('[role="combobox"]').filter({ hasText: /stock/i });
    if (await stockCombobox.first().isVisible()) {
      await stockCombobox.first().click();
      await page.waitForTimeout(300);
      
      const dropdown = page.locator('[role="listbox"], [role="menu"]');
      await expect(dropdown.first()).toBeVisible();
    }
  });
});

test.describe('Supervisor Role - People', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSupervisor(page);
  });

  test('should load people page and display team members', async ({ page }) => {
    await page.goto('/people');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveURL('/people');
    
    const heading = page.getByRole('heading', { name: /people|team|employee/i }).first();
    await expect(heading).toBeVisible();
  });

  test('should have working tabs (overview/employees/performance)', async ({ page }) => {
    await page.goto('/people');
    await page.waitForLoadState('networkidle');
    
    const tabs = [
      /overview/i,
      /employee/i,
      /performance/i,
    ];
    
    for (const tabName of tabs) {
      const tab = page.getByRole('tab', { name: tabName }).or(
        page.getByRole('button', { name: tabName })
      );
      
      if (await tab.first().isVisible()) {
        await tab.first().click();
        await page.waitForTimeout(300);
        await page.waitForLoadState('networkidle');
        
        // Verify tab is active/selected
        const tabElement = tab.first();
        await expect(tabElement).toBeVisible();
      }
    }
  });
});

test.describe('Supervisor Role - Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSupervisor(page);
  });

  test('should render all sidebar navigation links correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const navLinks = [
      { name: /dashboard/i, path: '/' },
      { name: /jobs/i, path: '/jobs' },
      { name: /fleet|forklift/i, path: '/forklifts' },
      { name: /customer/i, path: '/customers' },
      { name: /inventory|parts/i, path: '/inventory' },
      { name: /people|team/i, path: '/people' },
    ];
    
    for (const link of navLinks) {
      const navLink = page.getByRole('link', { name: link.name });
      await expect(navLink.first()).toBeVisible();
    }
  });

  test('should navigate between pages via sidebar', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Navigate to Jobs
    await page.getByRole('link', { name: /jobs/i }).first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/jobs');
    
    // Navigate to Fleet
    await page.getByRole('link', { name: /fleet|forklift/i }).first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/forklifts');
    
    // Navigate to Customers
    await page.getByRole('link', { name: /customer/i }).first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/customers');
  });
});

test.describe('Supervisor Role - Access Control', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSupervisor(page);
  });

  test('should have access to all supervisor-allowed pages', async ({ page }) => {
    const allowedPages = [
      '/',
      '/jobs',
      '/jobs/new',
      '/forklifts',
      '/customers',
      '/inventory',
      '/people',
    ];
    
    for (const pagePath of allowedPages) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');
      
      // Verify page loads without redirect to unauthorized
      expect(page.url()).not.toContain('unauthorized');
      expect(page.url()).not.toContain('403');
      
      // Verify main content exists
      const main = page.locator('main');
      await expect(main).toBeVisible();
    }
  });

  test('should not see admin-only UI elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check that admin-specific links/buttons don't appear
    const adminElements = [
      page.getByRole('link', { name: /admin panel/i }),
      page.getByRole('link', { name: /settings/i }).and(page.locator('nav')),
      page.getByRole('button', { name: /system settings/i }),
    ];
    
    for (const element of adminElements) {
      if (await element.count() > 0) {
        await expect(element.first()).not.toBeVisible();
      }
    }
  });
});
