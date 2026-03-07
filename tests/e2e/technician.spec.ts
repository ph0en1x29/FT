import { test, expect, type Page } from '@playwright/test';
import { gotoApp, loginAsAdmin, loginAsTechnician } from '../fixtures/auth.fixture';

type SeededEntities = {
  tag: string;
  customerId?: string;
  forkliftId?: string;
  jobId?: string;
  jobTitle?: string;
};

function createSeedTag(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function seedTechnicianAssignedJob(adminPage: Page): Promise<SeededEntities> {
  const seeded: SeededEntities = { tag: createSeedTag('technician-job') };

  const customer = await adminPage.evaluate(async ({ seedTag }) => {
    const serviceModulePath = '/services/supabaseService.ts';
    const { SupabaseDb } = await import(/* @vite-ignore */ serviceModulePath);
    const created = await SupabaseDb.createCustomer({
      name: `E2E Customer ${seedTag}`,
      address: `${seedTag} Integration Test Address`,
      phone: '555-0100',
      email: `${seedTag}@example.com`,
      notes: `Seeded by Playwright ${seedTag}`,
    });
    return { customer_id: created.customer_id };
  }, { seedTag: seeded.tag });

  const forklift = await adminPage.evaluate(async ({ seedTag }) => {
    const serviceModulePath = '/services/supabaseService.ts';
    const { SupabaseDb } = await import(/* @vite-ignore */ serviceModulePath);
    const created = await SupabaseDb.createForklift({
      serial_number: `E2E-${seedTag}`.slice(0, 40),
      make: 'Toyota',
      model: `8FD${seedTag.slice(-2)}`,
      type: 'Diesel',
      hourmeter: 1200,
      last_service_hourmeter: 1000,
      last_serviced_hourmeter: 1000,
      next_target_service_hour: 1500,
      year: 2023,
      capacity_kg: 2500,
      location: `Yard ${seedTag}`,
      site: `Yard ${seedTag}`,
      status: 'Available',
      notes: `Seeded by Playwright ${seedTag}`,
      ownership: 'company',
      last_hourmeter_update: new Date().toISOString(),
    });
    return { forklift_id: created.forklift_id };
  }, { seedTag: seeded.tag });

  const job = await adminPage.evaluate(async ({ customerId, forkliftId, seedTag }) => {
    const serviceModulePath = '/services/supabaseService.ts';
    const clientModulePath = '/services/supabaseClient.ts';
    const [{ SupabaseDb }, { supabase }] = await Promise.all([
      import(/* @vite-ignore */ serviceModulePath),
      import(/* @vite-ignore */ clientModulePath),
    ]);

    const { data: technician, error } = await supabase
      .from('users')
      .select('user_id, name')
      .eq('email', 'tech1@example.com')
      .single();

    if (error || !technician) {
      throw new Error(`Could not find technician: ${error?.message || 'no data'}`);
    }

    const created = await SupabaseDb.createJob({
      customer_id: customerId,
      forklift_id: forkliftId,
      title: `E2E Job ${seedTag}`,
      description: `Seeded technician job ${seedTag}`,
      priority: 'Medium',
      job_type: 'Service',
      status: 'Assigned',
      assigned_technician_id: technician.user_id,
      assigned_technician_name: technician.name,
      hourmeter_reading: 1200,
      notes: [`Seeded by Playwright ${seedTag}`],
      labor_cost: 150,
    });

    return { job_id: created.job_id, title: created.title };
  }, { customerId: customer.customer_id, forkliftId: forklift.forklift_id, seedTag: seeded.tag });

  seeded.customerId = customer.customer_id;
  seeded.forkliftId = forklift.forklift_id;
  seeded.jobId = job.job_id;
  seeded.jobTitle = job.title;
  return seeded;
}

async function cleanupSeededEntities(adminPage: Page, seeded: SeededEntities): Promise<void> {
  await adminPage.evaluate(async (entities) => {
    const serviceModulePath = '/services/supabaseService.ts';
    const clientModulePath = '/services/supabaseClient.ts';
    const { SupabaseDb } = await import(/* @vite-ignore */ serviceModulePath);
    const { supabase } = await import(/* @vite-ignore */ clientModulePath);

    if (entities.jobId) {
      await SupabaseDb.hardDeleteJob(entities.jobId);
    }

    if (entities.forkliftId) {
      await supabase.from('forklift_rentals').delete().eq('forklift_id', entities.forkliftId);
      await supabase
        .from('forklifts')
        .update({ current_customer_id: null, status: 'Available', updated_at: new Date().toISOString() })
        .eq('forklift_id', entities.forkliftId);
      await supabase.from('forklifts').delete().eq('forklift_id', entities.forkliftId);
    }

    if (entities.customerId) {
      await supabase.from('customer_contacts').delete().eq('customer_id', entities.customerId);
      await supabase.from('customer_sites').delete().eq('customer_id', entities.customerId);
      await supabase.from('forklift_rentals').delete().eq('customer_id', entities.customerId);
      await supabase.from('customers').delete().eq('customer_id', entities.customerId);
    }
  }, seeded);
}

test.describe('Technician Role E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTechnician(page);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Dashboard', () => {
    test('loads V4 dashboard with My Jobs header and key components', async ({ page }) => {
      await gotoApp(page, '/');
      await page.waitForLoadState('networkidle');

      // Verify "My Jobs" header (technician-specific) - exact text
      await expect(page.locator('h1').filter({ hasText: 'My Jobs' })).toBeVisible();

      // Verify date display (e.g., "Monday, 5 March")
      await expect(page.locator('text=/\\w+, \\d{1,2} \\w+/')).toBeVisible();

      // Verify 3 KPI cards with specific labels
      await expect(page.getByText(/^Today$/i).first()).toBeVisible();
      await expect(page.getByText(/^Completed$/i).first()).toBeVisible();
      await expect(page.getByText(/^This Week$/i).first()).toBeVisible();

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
      await gotoApp(page, '/');
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
    test('shows My Jobs view with search and filters', async ({ page, browser }) => {
      const adminContext = await browser.newContext({ baseURL: 'http://localhost:3000' });
      const adminPage = await adminContext.newPage();
      await loginAsAdmin(adminPage);
      const seeded = await seedTechnicianAssignedJob(adminPage);

      try {
        await gotoApp(page, '/jobs');
        await page.waitForLoadState('networkidle');

        const jobCards = page.locator('[data-testid^="job-card-"]');
        await expect(jobCards.filter({ hasText: seeded.tag }).first()).toBeVisible({ timeout: 15000 });

        const searchInput = page.locator('input[type="search"], input[type="text"][placeholder*="search" i]').first();
        if (await searchInput.isVisible().catch(() => false)) {
          await searchInput.fill(seeded.tag);
          await expect(jobCards.filter({ hasText: seeded.tag }).first()).toBeVisible();
          await searchInput.clear();
        }

        const filterElements = page.locator('[role="button"], [role="combobox"], [role="tab"]');
        const hasFilters = (await filterElements.count()) > 0;
        expect(hasFilters).toBeTruthy();
      } finally {
        await cleanupSeededEntities(adminPage, seeded);
        await adminContext.close();
      }
    });
  });

  test.describe('Job Detail', () => {
    test('loads job detail with Equipment card and hourmeter', async ({ page, browser }) => {
      const adminContext = await browser.newContext({ baseURL: 'http://localhost:3000' });
      const adminPage = await adminContext.newPage();
      await loginAsAdmin(adminPage);
      const seeded = await seedTechnicianAssignedJob(adminPage);

      try {
        await gotoApp(page, '/jobs');
        await page.waitForLoadState('networkidle');

        const jobLink = page.locator('[data-testid^="job-card-"]').filter({ hasText: seeded.tag }).first();
        await jobLink.waitFor({ state: 'visible', timeout: 15000 });
        await jobLink.click();
        await page.waitForLoadState('networkidle');

        await expect(page.locator('main')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText(seeded.jobTitle || seeded.tag).first()).toBeVisible();
        await expect(page.locator('text=/equipment|forklift/i').first()).toBeVisible();
      } finally {
        await cleanupSeededEntities(adminPage, seeded);
        await adminContext.close();
      }
    });
  });

  test.describe('Start Job Flow', () => {
    test('can navigate to job detail and check for Start Job option', async ({ page, browser }) => {
      const adminContext = await browser.newContext({ baseURL: 'http://localhost:3000' });
      const adminPage = await adminContext.newPage();
      await loginAsAdmin(adminPage);
      const seeded = await seedTechnicianAssignedJob(adminPage);

      try {
        await gotoApp(page, '/jobs');
        await page.waitForLoadState('networkidle');

        const jobLink = page.locator('[data-testid^="job-card-"]').filter({ hasText: seeded.tag }).first();
        await expect(jobLink).toBeVisible({ timeout: 15000 });
        await jobLink.click();
        await page.waitForLoadState('networkidle');

        await expect(page.locator('text=/job|equipment|customer/i').first()).toBeVisible({ timeout: 10000 });
        await expect(page.getByRole('button', { name: /accept job/i })).toBeVisible({ timeout: 10000 });
      } finally {
        await cleanupSeededEntities(adminPage, seeded);
        await adminContext.close();
      }
    });
  });

  test.describe('Fleet', () => {
    test('can view fleet list (read-only)', async ({ page }) => {
      await gotoApp(page, '/forklifts');
      await page.waitForLoadState('networkidle');

      // Verify page loaded
      await expect(page.getByRole('heading', { name: /fleet|forklifts/i })).toBeVisible();

      // Verify list of forklifts visible
      const fleetList = page.locator('main');
      await expect(fleetList.first()).toBeVisible();

      // Verify no "Add" or "Create" buttons (read-only for technician)
      const addButton = page.getByRole('button', { name: /add|create|new/i });
      await expect(addButton).not.toBeVisible();
    });
  });

  test.describe('Van Stock', () => {
    test('loads van stock page with parts inventory', async ({ page }) => {
      await gotoApp(page, '/my-van-stock');
      await page.waitForLoadState('networkidle');

      // Verify page loaded
      await expect(page.getByRole('heading', { name: /van stock|my van/i })).toBeVisible();

      // Verify parts inventory visible (table, list, or cards)
      const inventoryContainer = page.locator('main');
      await expect(inventoryContainer.first()).toBeVisible();
    });
  });

  test.describe('Customers', () => {
    test('can view customer list', async ({ page }) => {
      await gotoApp(page, '/customers');
      await page.waitForLoadState('networkidle');

      // Verify page loaded
      await expect(page.getByRole('heading', { name: /customers/i })).toBeVisible();

      // Verify customer list visible
      const customerList = page.locator('[data-testid^="customer-card-"], main');
      await expect(customerList.first()).toBeVisible();
    });
  });

  test.describe('Access Control', () => {
    test('cannot access /jobs/new (redirects)', async ({ page }) => {
      await gotoApp(page, '/jobs/new');
      await page.waitForLoadState('networkidle');

      // Should redirect away from /jobs/new
      await expect.poll(() => page.url(), { timeout: 10000 }).not.toContain('/jobs/new');
      
      // Should either be on dashboard or jobs list
      const url = page.url();
      const isRedirected = url.includes('/jobs') && !url.includes('/jobs/new') || url.endsWith('/');
      expect(isRedirected).toBeTruthy();
    });

    test('cannot access /invoices (redirects)', async ({ page }) => {
      await gotoApp(page, '/invoices');
      await page.waitForLoadState('networkidle');

      // Should redirect away from /invoices
      await expect.poll(() => page.url(), { timeout: 10000 }).not.toContain('/invoices');
    });

    test('cannot access /people (redirects)', async ({ page }) => {
      await gotoApp(page, '/people');
      await page.waitForLoadState('networkidle');

      // Should redirect away from /people
      await expect.poll(() => page.url(), { timeout: 10000 }).not.toContain('/people');
    });
  });
});
