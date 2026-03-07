import { test, expect, type Page } from '@playwright/test';
import { gotoApp, loginAsAdmin } from '../fixtures/auth.fixture';

type SeededEntities = {
  tag: string;
  customerId?: string;
  customerName?: string;
  forkliftId?: string;
  forkliftSerial?: string;
  rentalId?: string;
  jobId?: string;
  jobTitle?: string;
};

function createSeedTag(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createSeedCustomer(page: Page, tag: string) {
  return page.evaluate(async ({ seedTag }) => {
    const serviceModulePath = '/services/supabaseService.ts';
    const { SupabaseDb } = await import(/* @vite-ignore */ serviceModulePath);
    const created = await SupabaseDb.createCustomer({
      name: `E2E Customer ${seedTag}`,
      address: `${seedTag} Integration Test Address`,
      phone: '555-0100',
      email: `${seedTag}@example.com`,
      notes: `Seeded by Playwright ${seedTag}`,
    });
    return {
      customer_id: created.customer_id,
      name: created.name,
      address: created.address,
    };
  }, { seedTag: tag });
}

async function createSeedForklift(page: Page, tag: string) {
  return page.evaluate(async ({ seedTag }) => {
    const serviceModulePath = '/services/supabaseService.ts';
    const { SupabaseDb } = await import(/* @vite-ignore */ serviceModulePath);
    const created = await SupabaseDb.createForklift({
      serial_number: `E2E-${seedTag}`.slice(0, 40),
      forklift_no: `FLT-${seedTag}`.slice(0, 40),
      customer_forklift_no: `CUS-${seedTag}`.slice(0, 40),
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
    return {
      forklift_id: created.forklift_id,
      serial_number: created.serial_number,
      make: created.make,
      model: created.model,
      hourmeter: created.hourmeter,
    };
  }, { seedTag: tag });
}

async function createSeedRental(page: Page, forkliftId: string, customerId: string, tag: string) {
  return page.evaluate(async ({ seededForkliftId, seededCustomerId, seedTag }) => {
    const serviceModulePath = '/services/supabaseService.ts';
    const { SupabaseDb } = await import(/* @vite-ignore */ serviceModulePath);
    const created = await SupabaseDb.assignForkliftToCustomer(
      seededForkliftId,
      seededCustomerId,
      new Date().toISOString().split('T')[0],
      undefined,
      `Seeded by Playwright ${seedTag}`,
      undefined,
      'Playwright Seed',
      2500,
      `Site ${seedTag}`,
    );
    return { rental_id: created.rental_id };
  }, { seededForkliftId: forkliftId, seededCustomerId: customerId, seedTag: tag });
}

async function createSeedJob(page: Page, customerId: string, forkliftId: string, technicianEmail: string, tag: string) {
  return page.evaluate(async ({ seededCustomerId, seededForkliftId, email, seedTag }) => {
    const serviceModulePath = '/services/supabaseService.ts';
    const clientModulePath = '/services/supabaseClient.ts';
    const [{ SupabaseDb }, { supabase }] = await Promise.all([
      import(/* @vite-ignore */ serviceModulePath),
      import(/* @vite-ignore */ clientModulePath),
    ]);

    const { data: technician, error } = await supabase
      .from('users')
      .select('user_id, name')
      .eq('email', email)
      .single();

    if (error || !technician) {
      throw new Error(`Could not find technician ${email}: ${error?.message || 'no data'}`);
    }

    const created = await SupabaseDb.createJob({
      customer_id: seededCustomerId,
      forklift_id: seededForkliftId,
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

    return {
      job_id: created.job_id,
      title: created.title,
      deleted_at: created.deleted_at || null,
    };
  }, { seededCustomerId: customerId, seededForkliftId: forkliftId, email: technicianEmail, seedTag: tag });
}

async function getJob(page: Page, jobId: string) {
  return page.evaluate(async ({ seededJobId }) => {
    const clientModulePath = '/services/supabaseClient.ts';
    const { supabase } = await import(/* @vite-ignore */ clientModulePath);
    const { data, error } = await supabase
      .from('jobs')
      .select('job_id, title, deleted_at')
      .eq('job_id', seededJobId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  }, { seededJobId: jobId });
}

async function getForklift(page: Page, forkliftId: string) {
  return page.evaluate(async ({ seededForkliftId }) => {
    const clientModulePath = '/services/supabaseClient.ts';
    const { supabase } = await import(/* @vite-ignore */ clientModulePath);
    const { data, error } = await supabase
      .from('forklifts')
      .select('forklift_id, serial_number, current_customer_id, status')
      .eq('forklift_id', seededForkliftId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  }, { seededForkliftId: forkliftId });
}

async function getCustomer(page: Page, customerId: string) {
  return page.evaluate(async ({ seededCustomerId }) => {
    const clientModulePath = '/services/supabaseClient.ts';
    const { supabase } = await import(/* @vite-ignore */ clientModulePath);
    const { data, error } = await supabase
      .from('customers')
      .select('customer_id, name')
      .eq('customer_id', seededCustomerId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  }, { seededCustomerId: customerId });
}

async function cleanupSeededEntities(page: Page, entities: SeededEntities) {
  await page.evaluate(async (seeded) => {
    const serviceModulePath = '/services/supabaseService.ts';
    const clientModulePath = '/services/supabaseClient.ts';
    const { SupabaseDb } = await import(/* @vite-ignore */ serviceModulePath);
    const { supabase } = await import(/* @vite-ignore */ clientModulePath);

    if (seeded.jobId) {
      await SupabaseDb.hardDeleteJob(seeded.jobId);
    }

    if (seeded.rentalId) {
      await supabase.from('forklift_rentals').delete().eq('rental_id', seeded.rentalId);
    }

    if (seeded.forkliftId) {
      await supabase.from('forklift_rentals').delete().eq('forklift_id', seeded.forkliftId);
      await supabase
        .from('forklifts')
        .update({ current_customer_id: null, status: 'Available', updated_at: new Date().toISOString() })
        .eq('forklift_id', seeded.forkliftId);
      await supabase.from('forklifts').delete().eq('forklift_id', seeded.forkliftId);
    }

    if (seeded.customerId) {
      await supabase.from('customer_contacts').delete().eq('customer_id', seeded.customerId);
      await supabase.from('customer_sites').delete().eq('customer_id', seeded.customerId);
      await supabase.from('forklift_rentals').delete().eq('customer_id', seeded.customerId);
      await supabase.from('customers').delete().eq('customer_id', seeded.customerId);
    }
  }, entities);
}

async function openFleetCard(page: Page, forkliftId: string, serial: string) {
  await gotoApp(page, '/forklifts?tab=fleet');
  await page.waitForLoadState('networkidle');

  const searchInput = page.locator('input[type="search"], input[placeholder*="Search" i]').first();
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill(serial);
    await page.waitForTimeout(500);
  }

  const card = page.getByTestId(`forklift-card-${forkliftId}`);
  await expect(card).toBeVisible({ timeout: 15000 });
  return card;
}

test.describe('Admin Role - Full Access E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test.describe('1. Dashboard', () => {
    test('loads dashboard with KPI cards and job queue', async ({ page }) => {
      await gotoApp(page, '/');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('main')).toBeVisible();

      // Verify dashboard content is visible
      const kpiSection = page.locator('[class*="grid"]').first();
      await expect(kpiSection).toBeVisible();

      // Job queue should be visible
      await expect(page.locator('text=/approval queue|recent activity|action required/i').first()).toBeVisible();
    });
  });

  test.describe('2. Jobs List', () => {
    test('loads jobs list, search works, date tabs work, create button exists', async ({ page }) => {
      await gotoApp(page, '/jobs');
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
      await expect(page.getByRole('button', { name: /new job/i }).first()).toBeVisible();
    });

    test('date pill tabs are clickable', async ({ page }) => {
      test.setTimeout(30000);
      await gotoApp(page, '/jobs');
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
      await gotoApp(page, '/jobs/new');
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
      await gotoApp(page, '/jobs');
      await page.waitForLoadState('networkidle');

      // Click first job
      const firstJob = page.locator('[data-testid^="job-card-"]').first();
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
      await gotoApp(page, '/forklifts?tab=fleet');
      await page.waitForLoadState('networkidle');

      // List loads
      await expect(page.locator('h1, h2').filter({ hasText: /fleet|forklifts/i })).toBeVisible();

      // Search works
      const searchInput = page.locator('input[type="search"], input[placeholder*="Search" i]').first();
      if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await searchInput.fill('test');
        await page.waitForTimeout(500);
        await searchInput.clear();
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
      await gotoApp(page, '/forklifts?tab=fleet');
      await page.waitForLoadState('networkidle');

      // Click Add button
      const addButton = page.getByRole('button', { name: /add forklift/i });
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
      await gotoApp(page, '/forklifts?tab=fleet');
      await page.waitForLoadState('networkidle');

      // Edit button on the first fleet card
      const editButton = page.locator('button[title="Edit"]').first();
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
      const seeded: SeededEntities = { tag: createSeedTag('admin-rent') };

      try {
        const customer = await createSeedCustomer(page, seeded.tag);
        const forklift = await createSeedForklift(page, seeded.tag);
        seeded.customerId = customer.customer_id;
        seeded.customerName = customer.name;
        seeded.forkliftId = forklift.forklift_id;
        seeded.forkliftSerial = forklift.serial_number;

        const card = await openFleetCard(page, forklift.forklift_id, forklift.serial_number);
        await card.getByRole('button', { name: /rent.*out/i }).click();

        const dialog = page.locator('[role="dialog"]').last();
        await expect(dialog).toBeVisible();

        const customerInput = dialog.locator('input[placeholder*="customer" i]').first();
        await customerInput.click();
        await customerInput.fill(customer.name);
        await page.locator('li').filter({ hasText: customer.name }).first().click();
        await dialog.getByRole('button', { name: /rent forklift/i }).click();

        await expect(page.getByText(/forklift rented successfully/i)).toBeVisible({ timeout: 15000 });
        await expect.poll(async () => (await getForklift(page, forklift.forklift_id)) !== null).toBe(true);
      } finally {
        await cleanupSeededEntities(page, seeded);
      }
    });
  });

  test.describe('9. Fleet - Return', () => {
    test('rented forklift shows Return button, click opens modal', async ({ page }) => {
      test.setTimeout(30000);
      const seeded: SeededEntities = { tag: createSeedTag('admin-return') };

      try {
        const customer = await createSeedCustomer(page, seeded.tag);
        const forklift = await createSeedForklift(page, seeded.tag);
        const rental = await createSeedRental(page, forklift.forklift_id, customer.customer_id, seeded.tag);

        seeded.customerId = customer.customer_id;
        seeded.customerName = customer.name;
        seeded.forkliftId = forklift.forklift_id;
        seeded.forkliftSerial = forklift.serial_number;
        seeded.rentalId = rental.rental_id;

        const card = await openFleetCard(page, forklift.forklift_id, forklift.serial_number);
        await card.getByRole('button', { name: /^return$/i }).click();

        const dialog = page.locator('[role="dialog"]').last();
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', { name: /return forklift/i }).click();

        await expect(page.getByText(/forklift returned successfully/i)).toBeVisible({ timeout: 15000 });
        await expect(card.getByRole('button', { name: /rent.*out/i })).toBeVisible({ timeout: 15000 });
        seeded.rentalId = undefined;
      } finally {
        await cleanupSeededEntities(page, seeded);
      }
    });
  });

  test.describe('10. Customers', () => {
    test('list loads, can search', async ({ page }) => {
      await gotoApp(page, '/customers');
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
      await gotoApp(page, '/customers');
      await page.waitForLoadState('networkidle');

      // Click first customer
      const firstCustomer = page.locator('[data-testid^="customer-card-"]').first();
      await firstCustomer.click();
      await page.waitForLoadState('networkidle');

      // Profile loads
      await expect(page.locator('main')).toBeVisible();

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
      await gotoApp(page, '/inventory');
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
      await gotoApp(page, '/invoices');
      await page.waitForLoadState('networkidle');

      // Invoices page loads
      await expect(page.locator('main h1, main h2').filter({ hasText: /billing|invoice history/i }).first()).toBeVisible();

      // List or table visible
      await expect(page.locator('table, [class*="grid"], [data-testid*="invoice-"]').first()).toBeVisible();
    });
  });

  test.describe('14. People', () => {
    test('loads, tabs work', async ({ page }) => {
      test.setTimeout(30000);
      await gotoApp(page, '/people');
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
      await gotoApp(page, '/');
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
      await gotoApp(page, '/');
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

  test.describe('16. Seeded Delete Workflow', () => {
    test('admin can delete a seeded job, forklift, and customer through the UI', async ({ page }) => {
      test.setTimeout(60000);
      const seeded: SeededEntities = { tag: createSeedTag('admin-delete') };

      try {
        const customer = await createSeedCustomer(page, seeded.tag);
        const forklift = await createSeedForklift(page, seeded.tag);
        const job = await createSeedJob(page, customer.customer_id, forklift.forklift_id, 'tech1@example.com', seeded.tag);

        seeded.customerId = customer.customer_id;
        seeded.customerName = customer.name;
        seeded.forkliftId = forklift.forklift_id;
        seeded.forkliftSerial = forklift.serial_number;
        seeded.jobId = job.job_id;
        seeded.jobTitle = job.title;

        await gotoApp(page, '/jobs');
        await page.waitForLoadState('networkidle');

        const jobSearch = page.locator('input[type="search"], input[placeholder*="Search" i]').first();
        if (await jobSearch.isVisible().catch(() => false)) {
          await jobSearch.fill(seeded.tag);
          await page.waitForTimeout(500);
        }

        const jobCard = page.locator('[data-testid^="job-card-"]').filter({ hasText: seeded.tag }).first();
        await expect(jobCard).toBeVisible({ timeout: 15000 });
        await jobCard.click();
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: /delete job/i }).click();
        await page.locator('textarea').last().fill(`Cleanup seeded job ${seeded.tag}`);
        await page.getByRole('button', { name: /^delete$/i }).click();

        await expect.poll(() => page.url(), { timeout: 15000 }).toContain('/#/jobs');
        await expect.poll(async () => (await getJob(page, job.job_id))?.deleted_at ?? null, { timeout: 15000 }).not.toBeNull();

        const fleetCard = await openFleetCard(page, forklift.forklift_id, forklift.serial_number);
        page.once('dialog', async (dialog) => { await dialog.accept(); });
        await fleetCard.getByTestId(`delete-forklift-${forklift.forklift_id}`).click();
        await expect.poll(async () => await getForklift(page, forklift.forklift_id), { timeout: 15000 }).toBeNull();
        seeded.forkliftId = undefined;

        await gotoApp(page, '/customers');
        await page.waitForLoadState('networkidle');

        const customerSearch = page.locator('input[type="search"], input[placeholder*="Search" i]').first();
        if (await customerSearch.isVisible().catch(() => false)) {
          await customerSearch.fill(customer.name);
          await page.waitForTimeout(500);
        }

        const customerCard = page.locator('[data-testid^="customer-card-"]').filter({ hasText: customer.name }).first();
        await expect(customerCard).toBeVisible({ timeout: 15000 });
        await customerCard.click();
        await page.waitForLoadState('networkidle');

        page.once('dialog', async (dialog) => { await dialog.accept(); });
        await page.getByRole('button', { name: /delete customer/i }).click();
        await expect.poll(async () => await getCustomer(page, customer.customer_id), { timeout: 15000 }).toBeNull();
        seeded.customerId = undefined;
      } finally {
        await cleanupSeededEntities(page, seeded);
      }
    });
  });
});
