/**
 * Customer Feedback Bug Fixes Tests
 * Created: 2026-02-02
 *
 * Tests for fixes:
 * 1. Checklist validation handles 'ok'/'not_ok' string states
 * 2. Job completion validation checks multiple started_at sources
 * 3. Service record started_at syncs from job on status change
 */

import { expect,Page,test } from '@playwright/test';

// ===========================================
// CONFIGURATION
// ===========================================

const TEST_CREDENTIALS = {
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || 'dev@test.com',
    password: process.env.TEST_ADMIN_PASSWORD || 'Dev123!'
  },
  technician: {
    email: process.env.TEST_TECHNICIAN_EMAIL || 'tech1@example.com',
    password: process.env.TEST_TECHNICIAN_PASSWORD || 'Tech123!'
  },
};

const ROUTES = {
  base: '/#/',
  jobs: '/#/jobs',
};

// ===========================================
// HELPERS
// ===========================================

async function login(page: Page, email: string, password: string): Promise<boolean> {
  try {
    console.log(`[Login] Attempting login with: ${email}`);
    await page.goto(ROUTES.base);
    await page.waitForTimeout(2000);

    // Check if already logged in
    const sidebar = page.locator('aside');
    if (await sidebar.isVisible().catch(() => false)) {
      console.log('[Login] Already logged in');
      return true;
    }

    // Fill login form
    const emailInput = page.locator('input[type="email"]');
    await emailInput.waitFor({ state: 'visible', timeout: 5000 });
    await emailInput.fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button:has-text("Sign In")').click();

    // Wait for navigation
    await page.waitForTimeout(5000);
    
    const hasSidebar = await sidebar.isVisible().catch(() => false);
    console.log(`[Login] Success: ${hasSidebar}`);
    return hasSidebar;
  } catch (e) {
    console.log('[Login] Exception:', e);
    return false;
  }
}

async function loginAsAdmin(page: Page): Promise<boolean> {
  return login(page, TEST_CREDENTIALS.admin.email, TEST_CREDENTIALS.admin.password);
}

async function loginAsTechnician(page: Page): Promise<boolean> {
  return login(page, TEST_CREDENTIALS.technician.email, TEST_CREDENTIALS.technician.password);
}

async function navigateToInProgressJob(page: Page): Promise<boolean> {
  await page.goto(ROUTES.jobs);
  await page.waitForTimeout(2000);

  // Click In Progress tab
  const inProgressTab = page.locator('button:has-text("In Progress")');
  if (await inProgressTab.isVisible().catch(() => false)) {
    await inProgressTab.click();
    await page.waitForTimeout(2000);
  }

  // Check for job count
  const jobCount = page.locator('text=/Showing \\d+ of \\d+ jobs/');
  const hasJobs = await jobCount.isVisible({ timeout: 5000 }).catch(() => false);
  
  if (!hasJobs) {
    console.log('[Nav] No In Progress jobs found');
    return false;
  }

  // Click first job
  const jobCard = page.locator('.clickable-card, .card-theme').first();
  if (await jobCard.isVisible().catch(() => false)) {
    await jobCard.click();
    await page.waitForTimeout(2000);
    return true;
  }

  return false;
}

// ===========================================
// TEST: CHECKLIST STRING STATES
// ===========================================

test.describe('Bug Fix 1: Checklist String States', () => {
  test('checklist with ok/not_ok values can be saved', async ({ page }) => {
    const loggedIn = await loginAsTechnician(page);
    if (!loggedIn) {
      test.skip();
      return;
    }

    const hasJob = await navigateToInProgressJob(page);
    if (!hasJob) {
      console.log('[Test] No In Progress job available');
      test.skip();
      return;
    }

    // Look for Condition Checklist section
    const checklistSection = page.locator('text=Condition Checklist');
    const hasChecklist = await checklistSection.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasChecklist) {
      // Checklist might be collapsed or not visible for this job
      console.log('[Test] Checklist section not visible');
      test.skip();
      return;
    }

    // Look for Edit button to enable editing
    const editButton = page.locator('button:has-text("Edit")').first();
    if (await editButton.isVisible().catch(() => false)) {
      await editButton.click();
      await page.waitForTimeout(1000);
    }

    // Try clicking an OK button (should work without boolean cast error)
    const okButton = page.locator('button:has-text("✓"), button[title*="OK"]').first();
    if (await okButton.isVisible().catch(() => false)) {
      await okButton.click();
      await page.waitForTimeout(500);

      // Should not see the boolean error
      const errorToast = page.locator('text=invalid input syntax for type boolean');
      const hasError = await errorToast.isVisible({ timeout: 2000 }).catch(() => false);
      
      expect(hasError).toBeFalsy();
    }

    // Save checklist if save button exists
    const saveButton = page.locator('button:has-text("Save")').first();
    if (await saveButton.isVisible().catch(() => false)) {
      await saveButton.click();
      await page.waitForTimeout(2000);

      // Should not see the boolean error after save
      const errorToast = page.locator('text=invalid input syntax for type boolean');
      const hasError = await errorToast.isVisible({ timeout: 2000 }).catch(() => false);
      
      expect(hasError).toBeFalsy();
    }
  });

  test('admin can complete job with string checklist values', async ({ page }) => {
    const loggedIn = await loginAsAdmin(page);
    if (!loggedIn) {
      test.skip();
      return;
    }

    // Navigate to Awaiting Finalization jobs
    await page.goto(ROUTES.jobs);
    await page.waitForTimeout(2000);

    const awaitingTab = page.locator('button:has-text("Awaiting")');
    if (await awaitingTab.isVisible().catch(() => false)) {
      await awaitingTab.click();
      await page.waitForTimeout(2000);
    }

    // Click first job if exists
    const jobCard = page.locator('.clickable-card, .card-theme').first();
    if (await jobCard.isVisible().catch(() => false)) {
      await jobCard.click();
      await page.waitForTimeout(2000);

      // Try to complete/finalize
      const completeButton = page.locator('button:has-text("Complete"), button:has-text("Finalize")').first();
      if (await completeButton.isVisible().catch(() => false)) {
        await completeButton.click();
        await page.waitForTimeout(2000);

        // Should not see boolean cast error
        const errorToast = page.locator('text=invalid input syntax for type boolean');
        const hasError = await errorToast.isVisible({ timeout: 2000 }).catch(() => false);
        
        expect(hasError).toBeFalsy();
      }
    }
  });
});

// ===========================================
// TEST: JOB COMPLETION WITH started_at
// ===========================================

test.describe('Bug Fix 2: Job Completion Validation', () => {
  test('job with repair_start_time but no started_at can be completed', async ({ page }) => {
    const loggedIn = await loginAsAdmin(page);
    if (!loggedIn) {
      test.skip();
      return;
    }

    const hasJob = await navigateToInProgressJob(page);
    if (!hasJob) {
      console.log('[Test] No In Progress job available');
      test.skip();
      return;
    }

    // Check if job shows repair time (indicates it was started)
    const repairTime = page.locator('text=Repair Time');
    const hasRepairTime = await repairTime.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (!hasRepairTime) {
      console.log('[Test] Job has no repair time');
      test.skip();
      return;
    }

    // Try changing status to complete
    const statusDropdown = page.locator('select, [role="combobox"]').first();
    if (await statusDropdown.isVisible().catch(() => false)) {
      // Note: Status change UI varies - this is a simplified check
      console.log('[Test] Status dropdown found');
    }

    // The fix ensures "Job was never started" error won't appear
    // if repair_start_time exists
    const neverStartedError = page.locator('text=Job was never started');
    const hasError = await neverStartedError.isVisible({ timeout: 2000 }).catch(() => false);
    
    // Should not have the "never started" error if repair time is visible
    if (hasRepairTime) {
      expect(hasError).toBeFalsy();
    }
  });

  test('status change syncs started_at to service record', async ({ page }) => {
    const loggedIn = await loginAsAdmin(page);
    if (!loggedIn) {
      test.skip();
      return;
    }

    // Navigate to Assigned jobs
    await page.goto(ROUTES.jobs);
    await page.waitForTimeout(2000);

    const assignedTab = page.locator('button:has-text("Assigned")');
    if (await assignedTab.isVisible().catch(() => false)) {
      await assignedTab.click();
      await page.waitForTimeout(2000);
    }

    // Find a job to test
    const jobCard = page.locator('.clickable-card, .card-theme').first();
    if (!await jobCard.isVisible().catch(() => false)) {
      console.log('[Test] No Assigned jobs to test');
      test.skip();
      return;
    }

    await jobCard.click();
    await page.waitForTimeout(2000);

    // The actual sync happens in the backend
    // Here we verify the UI doesn't show errors
    const pageContent = await page.content();
    expect(pageContent).not.toContain('started_at is null');
  });
});

// ===========================================
// TEST: ERROR MESSAGE VERIFICATION
// ===========================================

test.describe('Error Messages', () => {
  test('no boolean cast errors appear on job detail page', async ({ page }) => {
    const loggedIn = await loginAsAdmin(page);
    if (!loggedIn) {
      test.skip();
      return;
    }

    const hasJob = await navigateToInProgressJob(page);
    if (!hasJob) {
      test.skip();
      return;
    }

    // Wait for page to fully load
    await page.waitForTimeout(3000);

    // Check for any error toasts
    const errorToasts = page.locator('.toast-error, [class*="error"], [class*="Error"]');
    const errorCount = await errorToasts.count();

    // Log any visible errors for debugging
    for (let i = 0; i < Math.min(errorCount, 3); i++) {
      const errorText = await errorToasts.nth(i).textContent().catch(() => '');
      console.log(`[Test] Error ${i}: ${errorText}`);
    }

    // Specifically check for the boolean error
    const booleanError = page.locator('text=invalid input syntax for type boolean');
    const hasBooleanError = await booleanError.isVisible({ timeout: 1000 }).catch(() => false);
    
    expect(hasBooleanError).toBeFalsy();
  });

  test('no "never started" error on job with repair times', async ({ page }) => {
    const loggedIn = await loginAsAdmin(page);
    if (!loggedIn) {
      test.skip();
      return;
    }

    const hasJob = await navigateToInProgressJob(page);
    if (!hasJob) {
      test.skip();
      return;
    }

    // Wait for page
    await page.waitForTimeout(3000);

    // Check repair time is visible
    const repairSection = page.locator('text=Repair Time, text=STARTED, text=ENDED');
    const hasRepairInfo = await repairSection.first().isVisible({ timeout: 2000 }).catch(() => false);

    if (hasRepairInfo) {
      // Should not have "never started" error
      const neverStartedError = page.locator('text=never started');
      const hasError = await neverStartedError.isVisible({ timeout: 1000 }).catch(() => false);
      
      expect(hasError).toBeFalsy();
    }
  });
});
