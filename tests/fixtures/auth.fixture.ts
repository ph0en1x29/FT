import { Page } from '@playwright/test';

type AuthCredentials = {
  email: string;
  password: string;
};

const SELECTORS = {
  email: 'input[type="email"]',
  password: 'input[type="password"]',
};

const CREDENTIALS = {
  admin: {
    email: 'dev@test.com',
    password: 'Dev123!',
  },
  supervisor: {
    email: 'super1234@gmail.com',
    password: 'Super123!',
  },
  technician: {
    email: 'tech1@example.com',
    password: 'Tech123!',
  },
  accountant: {
    email: 'accountant1@example.com',
    password: 'Account123!',
  },
};

async function loginWithCredentials(page: Page, credentials: AuthCredentials): Promise<void> {
  await page.goto('/');
  await page.locator(SELECTORS.email).waitFor({ state: 'visible' });
  await page.fill(SELECTORS.email, credentials.email);
  await page.fill(SELECTORS.password, credentials.password);

  await page.getByRole('button', { name: /sign in/i }).click();
  // Wait for authenticated app to load (nav links appear)
  await page.getByRole('link', { name: /dashboard/i }).waitFor({ state: 'visible', timeout: 15000 });
}

export async function loginAsAdmin(page: Page): Promise<void> {
  await loginWithCredentials(page, CREDENTIALS.admin);
}

export async function loginAsSupervisor(page: Page): Promise<void> {
  await loginWithCredentials(page, CREDENTIALS.supervisor);
}

export async function loginAsTechnician(page: Page): Promise<void> {
  await loginWithCredentials(page, CREDENTIALS.technician);
}

export async function loginAsAccountant(page: Page): Promise<void> {
  await loginWithCredentials(page, CREDENTIALS.accountant);
}
