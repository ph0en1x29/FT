/**
 * SECURITY UTILITIES
 *
 * Basic security checks. Always run these.
 * For comprehensive security, use dedicated tools like OWASP ZAP.
 */

import { APIRequestContext,Page } from '@playwright/test';

// ===========================================
// XSS TESTING
// ===========================================

const XSS_PAYLOADS = [
  '<script>alert("xss")</script>',
  '"><script>alert("xss")</script>',
  "'-alert('xss')-'",
  '<img src=x onerror=alert("xss")>',
  '<svg onload=alert("xss")>',
];

export async function testXSS(
  page: Page,
  inputSelector: string,
  submitSelector: string
): Promise<{ vulnerable: boolean; payload: string | null }> {
  for (const payload of XSS_PAYLOADS) {
    try {
      await page.fill(inputSelector, payload);
      await page.click(submitSelector);
      await page.waitForTimeout(500);

      // Check if script executed (dialog appeared)
      const dialogAppeared = await page.evaluate(() => {
        return (window as any).__xssTriggered === true;
      }).catch(() => false);

      // Check if payload is reflected unescaped
      const content = await page.content();
      const reflected = content.includes(payload) &&
                       !content.includes(escapeHtml(payload));

      if (dialogAppeared || reflected) {
        return { vulnerable: true, payload };
      }
    } catch {
      // Continue to next payload
    }
  }

  return { vulnerable: false, payload: null };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ===========================================
// AUTH BYPASS TESTING
// ===========================================

export async function testAuthBypass(
  page: Page,
  protectedUrls: string[]
): Promise<{ url: string; bypassed: boolean }[]> {
  const results = [];

  // Make sure we're logged out
  await page.context().clearCookies();

  for (const url of protectedUrls) {
    await page.goto(url);
    await page.waitForTimeout(500);

    const currentUrl = page.url();
    const bypassed = !currentUrl.includes('login') &&
                    !currentUrl.includes('signin') &&
                    !currentUrl.includes('unauthorized');

    results.push({ url, bypassed });
  }

  return results;
}

// ===========================================
// SECURITY HEADERS CHECK
// ===========================================

const REQUIRED_HEADERS = {
  'strict-transport-security': 'Should be set for HTTPS',
  'x-content-type-options': 'Should be "nosniff"',
  'x-frame-options': 'Should be "DENY" or "SAMEORIGIN"',
  'x-xss-protection': 'Should be "1; mode=block"',
  'content-security-policy': 'Should be defined',
};

export async function checkSecurityHeaders(
  request: APIRequestContext,
  url: string
): Promise<{ header: string; present: boolean; value: string | null }[]> {
  const response = await request.get(url);
  const headers = response.headers();
  const results = [];

  for (const [header, description] of Object.entries(REQUIRED_HEADERS)) {
    const value = headers[header] || null;
    results.push({
      header,
      present: !!value,
      value,
    });
  }

  return results;
}

// ===========================================
// SENSITIVE DATA EXPOSURE
// ===========================================

const SENSITIVE_PATTERNS = [
  /password\s*[:=]\s*["'][^"']+["']/gi,
  /api[_-]?key\s*[:=]\s*["'][^"']+["']/gi,
  /secret\s*[:=]\s*["'][^"']+["']/gi,
  /token\s*[:=]\s*["'][^"']+["']/gi,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Emails
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
  /\b\d{16}\b/g, // Credit card
];

export async function checkSensitiveDataExposure(
  page: Page
): Promise<{ found: boolean; matches: string[] }> {
  const content = await page.content();
  const matches: string[] = [];

  for (const pattern of SENSITIVE_PATTERNS) {
    const found = content.match(pattern);
    if (found) {
      matches.push(...found.slice(0, 3)); // Limit matches
    }
  }

  return {
    found: matches.length > 0,
    matches,
  };
}

// ===========================================
// SQL INJECTION (Basic)
// ===========================================

const SQL_PAYLOADS = [
  "' OR '1'='1",
  "1; DROP TABLE users--",
  "' UNION SELECT * FROM users--",
];

export async function testSQLInjection(
  page: Page,
  inputSelector: string,
  submitSelector: string
): Promise<{ vulnerable: boolean; indicator: string | null }> {
  const errorIndicators = [
    'sql syntax',
    'mysql',
    'postgresql',
    'sqlite',
    'oracle',
    'database error',
    'query failed',
  ];

  for (const payload of SQL_PAYLOADS) {
    await page.fill(inputSelector, payload);
    await page.click(submitSelector);
    await page.waitForTimeout(500);

    const content = await page.content().then(c => c.toLowerCase());

    for (const indicator of errorIndicators) {
      if (content.includes(indicator)) {
        return { vulnerable: true, indicator };
      }
    }
  }

  return { vulnerable: false, indicator: null };
}

// ===========================================
// QUICK SECURITY AUDIT
// ===========================================

export async function quickSecurityAudit(
  page: Page,
  request: APIRequestContext,
  config: {
    baseUrl: string;
    protectedUrls: string[];
    formInputs?: { selector: string; submitSelector: string }[];
  }
): Promise<SecurityAuditResult> {
  const results: SecurityAuditResult = {
    headers: [],
    authBypass: [],
    xss: [],
    sensitiveData: { found: false, matches: [] },
    passed: true,
  };

  // Check headers
  results.headers = await checkSecurityHeaders(request, config.baseUrl);

  // Check auth bypass
  results.authBypass = await testAuthBypass(page, config.protectedUrls);

  // Check sensitive data
  await page.goto(config.baseUrl);
  results.sensitiveData = await checkSensitiveDataExposure(page);

  // Check XSS on forms
  if (config.formInputs) {
    for (const form of config.formInputs) {
      const xssResult = await testXSS(page, form.selector, form.submitSelector);
      results.xss.push({ ...form, ...xssResult });
    }
  }

  // Determine pass/fail
  results.passed = !results.authBypass.some(r => r.bypassed) &&
                   !results.xss.some(r => r.vulnerable) &&
                   !results.sensitiveData.found;

  return results;
}

interface SecurityAuditResult {
  headers: { header: string; present: boolean; value: string | null }[];
  authBypass: { url: string; bypassed: boolean }[];
  xss: { selector: string; vulnerable: boolean; payload: string | null }[];
  sensitiveData: { found: boolean; matches: string[] };
  passed: boolean;
}
