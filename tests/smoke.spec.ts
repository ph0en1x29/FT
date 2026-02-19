import { test, expect } from '@playwright/test';

test('homepage loads', async ({ page }) => {
  await page.goto('https://ft-kappa.vercel.app');
  await expect(page).toHaveTitle(/FieldPro/i);
});
