import { expect, test, type Page } from '@playwright/test';
import { loginAsAdmin } from '../fixtures/auth.fixture';

test.describe('Critical Path - Job Lifecycle', () => {
  async function chooseFromControl(page: Page, selectLocator: string, comboName: RegExp) {
    const select = page.locator(selectLocator).first();
    if (await select.count()) {
      const options = select.locator('option');
      const optionCount = await options.count();
      for (let i = 0; i < optionCount; i++) {
        const option = options.nth(i);
        const value = (await option.getAttribute('value')) ?? '';
        const text = (await option.innerText()).trim();
        if (value && !/select|choose|--/i.test(text)) {
          await select.selectOption(value);
          return;
        }
      }
    }

    const combo = page.getByRole('combobox', { name: comboName }).first();
    await combo.click();
    const option = page.getByRole('option').first();
    await option.click();
  }

  test('admin creates a job and sees it in the jobs list', async ({ page }) => {
    const description = `E2E lifecycle ${Date.now()}`;

    await loginAsAdmin(page);

    const newJobLink = page.getByRole('link', { name: /new job/i }).first();
    if (await newJobLink.count()) {
      await newJobLink.click();
    } else {
      await page.goto('/#/jobs/new');
    }
    await expect.poll(() => page.url()).toMatch(/jobs\/new/);

    await chooseFromControl(
      page,
      'select[name*="customer" i], select[id*="customer" i]',
      /customer/i,
    );
    await chooseFromControl(
      page,
      'select[name*="equipment" i], select[id*="equipment" i]',
      /equipment/i,
    );

    const prioritySelect = page.locator('select[name*="priority" i], select[id*="priority" i]').first();
    if (await prioritySelect.count()) {
      const options = prioritySelect.locator('option');
      const highPriority = options.filter({ hasText: /high|urgent/i }).first();
      if (await highPriority.count()) {
        const highValue = await highPriority.getAttribute('value');
        if (highValue) {
          await prioritySelect.selectOption(highValue);
        }
      } else {
        const firstValue = await options.nth(1).getAttribute('value');
        if (firstValue) {
          await prioritySelect.selectOption(firstValue);
        }
      }
    } else {
      await chooseFromControl(
        page,
        'select[name*="priority" i], select[id*="priority" i]',
        /priority/i,
      );
    }

    const descriptionField = page.locator(
      'textarea[name*="description" i], textarea[id*="description" i], textarea[name*="note" i], textarea[id*="note" i]',
    ).first();
    await descriptionField.fill(description);

    await page.getByRole('button', { name: /create job|save|submit|create/i }).first().click();
    await expect.poll(() => page.url()).toMatch(/jobs\/(?!new$)[^/?#]+/);

    await page.goto('/#/jobs');
    await expect(page.getByText(description).first()).toBeVisible({ timeout: 15000 });
  });
});
