/**
 * PERFORMANCE UTILITIES
 *
 * Core Web Vitals and performance budget testing.
 * Always run basic performance checks.
 */

import { Page } from '@playwright/test';

// ===========================================
// PERFORMANCE BUDGETS
// ===========================================

export const PERFORMANCE_BUDGETS = {
  // Core Web Vitals (Google's thresholds)
  LCP: 2500,    // Largest Contentful Paint (ms) - should be < 2.5s
  FID: 100,     // First Input Delay (ms) - should be < 100ms
  CLS: 0.1,     // Cumulative Layout Shift - should be < 0.1

  // Additional metrics
  FCP: 1800,    // First Contentful Paint (ms)
  TTFB: 800,    // Time to First Byte (ms)

  // Resource budgets
  pageSize: 3000000,     // 3MB max page size
  jsSize: 500000,        // 500KB max JS
  imageSize: 1000000,    // 1MB max images
  requestCount: 50,      // Max requests
};

// ===========================================
// CORE WEB VITALS
// ===========================================

export async function measureCoreWebVitals(page: Page): Promise<WebVitals> {
  // Inject performance observer
  const metrics = await page.evaluate(() => {
    return new Promise<any>((resolve) => {
      const results: any = {
        LCP: null,
        FID: null,
        CLS: 0,
        FCP: null,
        TTFB: null,
      };

      // Get navigation timing
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (nav) {
        results.TTFB = nav.responseStart - nav.requestStart;
      }

      // Get paint timing
      const paints = performance.getEntriesByType('paint');
      const fcp = paints.find(p => p.name === 'first-contentful-paint');
      if (fcp) {
        results.FCP = fcp.startTime;
      }

      // LCP
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        results.LCP = lastEntry.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });

      // CLS
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (!entry.hadRecentInput) {
            results.CLS += entry.value;
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });

      // Give time for metrics to be collected
      setTimeout(() => resolve(results), 3000);
    });
  });

  return metrics;
}

interface WebVitals {
  LCP: number | null;
  FID: number | null;
  CLS: number;
  FCP: number | null;
  TTFB: number | null;
}

// ===========================================
// PAGE LOAD METRICS
// ===========================================

export async function measurePageLoad(page: Page, url: string): Promise<PageLoadMetrics> {
  const startTime = Date.now();

  // Track requests
  const requests: { url: string; size: number; type: string }[] = [];

  page.on('response', async (response) => {
    try {
      const headers = response.headers();
      const size = parseInt(headers['content-length'] || '0');
      const type = headers['content-type'] || 'unknown';

      requests.push({
        url: response.url(),
        size,
        type: type.split(';')[0],
      });
    } catch {
      // Ignore errors
    }
  });

  await page.goto(url, { waitUntil: 'networkidle' });

  const loadTime = Date.now() - startTime;

  // Calculate sizes by type
  const jsSize = requests
    .filter(r => r.type.includes('javascript'))
    .reduce((sum, r) => sum + r.size, 0);

  const cssSize = requests
    .filter(r => r.type.includes('css'))
    .reduce((sum, r) => sum + r.size, 0);

  const imageSize = requests
    .filter(r => r.type.includes('image'))
    .reduce((sum, r) => sum + r.size, 0);

  const totalSize = requests.reduce((sum, r) => sum + r.size, 0);

  return {
    loadTime,
    requestCount: requests.length,
    totalSize,
    jsSize,
    cssSize,
    imageSize,
  };
}

interface PageLoadMetrics {
  loadTime: number;
  requestCount: number;
  totalSize: number;
  jsSize: number;
  cssSize: number;
  imageSize: number;
}

// ===========================================
// PERFORMANCE ASSERTIONS
// ===========================================

export function assertPerformanceBudgets(
  metrics: PageLoadMetrics,
  budgets = PERFORMANCE_BUDGETS
): { passed: boolean; violations: string[] } {
  const violations: string[] = [];

  if (metrics.totalSize > budgets.pageSize) {
    violations.push(`Page size ${(metrics.totalSize / 1000000).toFixed(2)}MB exceeds ${budgets.pageSize / 1000000}MB budget`);
  }

  if (metrics.jsSize > budgets.jsSize) {
    violations.push(`JS size ${(metrics.jsSize / 1000).toFixed(0)}KB exceeds ${budgets.jsSize / 1000}KB budget`);
  }

  if (metrics.imageSize > budgets.imageSize) {
    violations.push(`Image size ${(metrics.imageSize / 1000000).toFixed(2)}MB exceeds ${budgets.imageSize / 1000000}MB budget`);
  }

  if (metrics.requestCount > budgets.requestCount) {
    violations.push(`Request count ${metrics.requestCount} exceeds ${budgets.requestCount} budget`);
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}

export function assertWebVitals(
  vitals: WebVitals,
  budgets = PERFORMANCE_BUDGETS
): { passed: boolean; violations: string[] } {
  const violations: string[] = [];

  if (vitals.LCP && vitals.LCP > budgets.LCP) {
    violations.push(`LCP ${vitals.LCP}ms exceeds ${budgets.LCP}ms threshold`);
  }

  if (vitals.CLS > budgets.CLS) {
    violations.push(`CLS ${vitals.CLS.toFixed(3)} exceeds ${budgets.CLS} threshold`);
  }

  if (vitals.FCP && vitals.FCP > budgets.FCP) {
    violations.push(`FCP ${vitals.FCP}ms exceeds ${budgets.FCP}ms threshold`);
  }

  if (vitals.TTFB && vitals.TTFB > budgets.TTFB) {
    violations.push(`TTFB ${vitals.TTFB}ms exceeds ${budgets.TTFB}ms threshold`);
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}

// ===========================================
// QUICK PERFORMANCE AUDIT
// ===========================================

export async function quickPerformanceAudit(
  page: Page,
  url: string
): Promise<PerformanceAuditResult> {
  const pageMetrics = await measurePageLoad(page, url);
  const webVitals = await measureCoreWebVitals(page);

  const pageCheck = assertPerformanceBudgets(pageMetrics);
  const vitalsCheck = assertWebVitals(webVitals);

  return {
    url,
    metrics: {
      ...pageMetrics,
      ...webVitals,
    },
    passed: pageCheck.passed && vitalsCheck.passed,
    violations: [...pageCheck.violations, ...vitalsCheck.violations],
  };
}

interface PerformanceAuditResult {
  url: string;
  metrics: PageLoadMetrics & WebVitals;
  passed: boolean;
  violations: string[];
}
