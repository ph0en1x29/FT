/**
 * CORE UTILITIES
 *
 * Essential utilities for any project.
 * Always include these regardless of project type.
 */

import { Page, expect } from '@playwright/test';

// ===========================================
// ERROR CAPTURE
// Use on every test to catch console errors
// ===========================================

export class ErrorCapture {
  private errors: string[] = [];
  private warnings: string[] = [];
  private networkErrors: { url: string; status: number }[] = [];

  constructor(private page: Page) {
    this.setup();
  }

  private setup() {
    // Console errors
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore common non-critical errors
        if (!text.includes('favicon') && !text.includes('404.png')) {
          this.errors.push(text);
        }
      }
      if (msg.type() === 'warning') {
        this.warnings.push(msg.text());
      }
    });

    // Page errors (uncaught exceptions)
    this.page.on('pageerror', err => {
      this.errors.push(`Uncaught: ${err.message}`);
    });

    // Network errors
    this.page.on('response', response => {
      if (response.status() >= 400) {
        this.networkErrors.push({
          url: response.url(),
          status: response.status(),
        });
      }
    });
  }

  getErrors(): string[] {
    return this.errors;
  }

  getWarnings(): string[] {
    return this.warnings;
  }

  getNetworkErrors(): { url: string; status: number }[] {
    return this.networkErrors;
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  clear(): void {
    this.errors = [];
    this.warnings = [];
    this.networkErrors = [];
  }

  assertNoErrors(): void {
    expect(this.errors, `Console errors found: ${this.errors.join(', ')}`).toHaveLength(0);
  }
}

// ===========================================
// SMOKE TEST
// Quick verification that site works
// ===========================================

export async function smokeTest(page: Page, urls: string[]): Promise<SmokeResult[]> {
  const results: SmokeResult[] = [];
  const errorCapture = new ErrorCapture(page);

  for (const url of urls) {
    errorCapture.clear();

    try {
      const response = await page.goto(url, { timeout: 30000 });
      const status = response?.status() || 0;
      const title = await page.title();

      results.push({
        url,
        status,
        ok: status >= 200 && status < 400,
        title,
        errors: errorCapture.getErrors(),
        loadTime: 0, // Could add performance timing
      });
    } catch (error) {
      results.push({
        url,
        status: 0,
        ok: false,
        title: null,
        errors: [(error as Error).message],
        loadTime: 0,
      });
    }
  }

  return results;
}

interface SmokeResult {
  url: string;
  status: number;
  ok: boolean;
  title: string | null;
  errors: string[];
  loadTime: number;
}

// ===========================================
// WAIT HELPERS
// Common wait operations
// ===========================================

export const wait = {
  forNetworkIdle: (page: Page, timeout = 5000) =>
    page.waitForLoadState('networkidle', { timeout }),

  forElement: (page: Page, selector: string, timeout = 5000) =>
    page.waitForSelector(selector, { timeout }),

  forNavigation: (page: Page, urlPattern: RegExp, timeout = 10000) =>
    page.waitForURL(urlPattern, { timeout }),

  forText: (page: Page, text: string, timeout = 5000) =>
    page.locator(`text=${text}`).waitFor({ timeout }),

  ms: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
};

// ===========================================
// SCREENSHOT HELPER
// Take screenshots for manual review
// ===========================================

export async function takeScreenshot(
  page: Page,
  name: string,
  options: { fullPage?: boolean; dir?: string } = {}
): Promise<string> {
  const { fullPage = true, dir = 'screenshots' } = options;
  const fs = await import('fs');

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${dir}/${name}-${timestamp}.png`;

  await page.screenshot({ path: filename, fullPage });

  return filename;
}
