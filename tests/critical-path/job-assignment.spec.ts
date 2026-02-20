import { expect, test, type Page } from '@playwright/test';
import { loginAsSupervisor, loginAsTechnician } from '../fixtures/auth.fixture';

test.describe('Critical Path - Job Assignment', () => {
  async function openFirstJob(page: Page) {
    await page.goto('/#/jobs');
    const firstJobLink = page.locator('a[href*="jobs/"]').first();
    await expect(firstJobLink).toBeVisible({ timeout: 15000 });
    const jobLabel = (await firstJobLink.innerText()).trim();
    await firstJobLink.click();
    await expect.poll(() => page.url()).toMatch(/jobs\/(?!$)[^/?#]+/);
    const jobId = page.url().match(/jobs\/([^/?#]+)/)?.[1];
    return { jobId, jobLabel };
  }

  async function assignTechnician(page: Page) {
    const techSelect = page.locator(
      'select[name*="technician" i], select[id*="technician" i], select[name*="assignee" i], select[id*="assignee" i]',
    ).first();

    if (await techSelect.count()) {
      const options = techSelect.locator('option');
      const optionCount = await options.count();
      let selected = false;
      for (let i = 0; i < optionCount; i++) {
        const option = options.nth(i);
        const text = (await option.innerText()).trim();
        const value = (await option.getAttribute('value')) ?? '';
        if (value && /tech1|technician|tech/i.test(text)) {
          await techSelect.selectOption(value);
          selected = true;
          break;
        }
      }
      if (!selected && optionCount > 1) {
        const fallbackValue = await options.nth(1).getAttribute('value');
        if (fallbackValue) {
          await techSelect.selectOption(fallbackValue);
        }
      }
    } else {
      const combo = page.getByRole('combobox', { name: /technician|assignee|assign/i }).first();
      await combo.click();
      const preferredOption = page.getByRole('option', { name: /tech1|technician|tech/i }).first();
      if (await preferredOption.count()) {
        await preferredOption.click();
      } else {
        await page.getByRole('option').first().click();
      }
    }

    await page.getByRole('button', { name: /assign/i }).first().click();
  }

  test('supervisor assigns technician and technician sees assigned job', async ({ page, browser }) => {
    await loginAsSupervisor(page);

    const { jobId, jobLabel } = await openFirstJob(page);

    await assignTechnician(page);
    await expect(page.getByText(/assigned|tech1|technician/i).first()).toBeVisible({ timeout: 15000 });

    const technicianContext = await browser.newContext({ baseURL: 'http://localhost:3000' });
    const technicianPage = await technicianContext.newPage();

    await loginAsTechnician(technicianPage);
    await technicianPage.goto('/#/jobs');

    if (jobId) {
      await expect(technicianPage.getByText(new RegExp(jobId, 'i')).first()).toBeVisible({ timeout: 15000 });
    } else if (jobLabel) {
      await expect(technicianPage.getByText(jobLabel).first()).toBeVisible({ timeout: 15000 });
    } else {
      await expect(technicianPage.locator('a[href*="jobs/"]').first()).toBeVisible({ timeout: 15000 });
    }

    await technicianContext.close();
  });
});
