/**
 * ACCESSIBILITY UTILITIES
 *
 * WCAG 2.1 AA compliance checks.
 * Always run basic accessibility tests.
 */

import AxeBuilder from '@axe-core/playwright';
import { Page } from '@playwright/test';

// ===========================================
// AXE-CORE AUDIT
// ===========================================

export async function runAxeAudit(page: Page): Promise<AxeAuditResult> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();

  const violations = results.violations.map(v => ({
    id: v.id,
    impact: v.impact as 'critical' | 'serious' | 'moderate' | 'minor',
    description: v.description,
    helpUrl: v.helpUrl,
    nodes: v.nodes.length,
  }));

  const critical = violations.filter(v => v.impact === 'critical');
  const serious = violations.filter(v => v.impact === 'serious');

  return {
    passed: critical.length === 0 && serious.length === 0,
    violations,
    summary: {
      critical: critical.length,
      serious: serious.length,
      moderate: violations.filter(v => v.impact === 'moderate').length,
      minor: violations.filter(v => v.impact === 'minor').length,
    },
  };
}

interface AxeAuditResult {
  passed: boolean;
  violations: {
    id: string;
    impact: 'critical' | 'serious' | 'moderate' | 'minor';
    description: string;
    helpUrl: string;
    nodes: number;
  }[];
  summary: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
}

// ===========================================
// KEYBOARD NAVIGATION
// ===========================================

export async function testKeyboardNavigation(page: Page): Promise<KeyboardTestResult> {
  const issues: string[] = [];

  // Get all interactive elements
  const interactiveElements = await page.evaluate(() => {
    const elements = document.querySelectorAll(
      'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    return elements.length;
  });

  // Tab through all elements
  let tabCount = 0;
  const maxTabs = interactiveElements + 10;
  const visitedElements = new Set<string>();

  while (tabCount < maxTabs) {
    await page.keyboard.press('Tab');
    tabCount++;

    // Check if element is focused
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;

      return {
        tag: el.tagName,
        id: el.id,
        hasVisibleFocus: window.getComputedStyle(el).outlineWidth !== '0px' ||
                        el.matches(':focus-visible'),
      };
    });

    if (!focused) {
      issues.push('Focus lost during tab navigation');
      break;
    }

    // Check for visible focus indicator
    if (!focused.hasVisibleFocus) {
      issues.push(`Element ${focused.tag}${focused.id ? '#' + focused.id : ''} has no visible focus indicator`);
    }

    // Check for keyboard trap
    const elementKey = `${focused.tag}-${focused.id}`;
    if (visitedElements.has(elementKey)) {
      // We've completed a cycle
      break;
    }
    visitedElements.add(elementKey);
  }

  // Check if we tabbed through reasonable number of elements
  if (visitedElements.size < interactiveElements * 0.5) {
    issues.push('Not all interactive elements are keyboard accessible');
  }

  return {
    passed: issues.length === 0,
    elementsFound: interactiveElements,
    elementsReached: visitedElements.size,
    issues,
  };
}

interface KeyboardTestResult {
  passed: boolean;
  elementsFound: number;
  elementsReached: number;
  issues: string[];
}

// ===========================================
// IMAGE ALT TEXT
// ===========================================

export async function checkImageAltText(page: Page): Promise<ImageAltResult> {
  const images = await page.evaluate(() => {
    const imgs = document.querySelectorAll('img');
    return Array.from(imgs).map(img => ({
      src: img.src,
      hasAlt: img.hasAttribute('alt'),
      altText: img.alt || null,
      isDecorative: img.alt === '' && img.hasAttribute('alt'),
    }));
  });

  const missing = images.filter(img => !img.hasAlt);
  const empty = images.filter(img => img.hasAlt && !img.altText && !img.isDecorative);

  return {
    passed: missing.length === 0,
    total: images.length,
    withAlt: images.filter(img => img.hasAlt && img.altText).length,
    decorative: images.filter(img => img.isDecorative).length,
    missing: missing.length,
    emptyNonDecorative: empty.length,
  };
}

interface ImageAltResult {
  passed: boolean;
  total: number;
  withAlt: number;
  decorative: number;
  missing: number;
  emptyNonDecorative: number;
}

// ===========================================
// HEADING STRUCTURE
// ===========================================

export async function checkHeadingStructure(page: Page): Promise<HeadingResult> {
  const headings = await page.evaluate(() => {
    const elements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    return Array.from(elements).map(h => ({
      level: parseInt(h.tagName[1]),
      text: h.textContent?.trim() || '',
    }));
  });

  const issues: string[] = [];

  // Check for H1
  const h1Count = headings.filter(h => h.level === 1).length;
  if (h1Count === 0) {
    issues.push('Page has no H1 heading');
  } else if (h1Count > 1) {
    issues.push(`Page has ${h1Count} H1 headings (should have 1)`);
  }

  // Check heading hierarchy
  let previousLevel = 0;
  for (const heading of headings) {
    if (heading.level > previousLevel + 1) {
      issues.push(`Heading hierarchy skipped from H${previousLevel} to H${heading.level}`);
    }
    previousLevel = heading.level;
  }

  // Check for empty headings
  const emptyHeadings = headings.filter(h => !h.text);
  if (emptyHeadings.length > 0) {
    issues.push(`${emptyHeadings.length} empty heading(s) found`);
  }

  return {
    passed: issues.length === 0,
    headings,
    h1Count,
    issues,
  };
}

interface HeadingResult {
  passed: boolean;
  headings: { level: number; text: string }[];
  h1Count: number;
  issues: string[];
}

// ===========================================
// FORM ACCESSIBILITY
// ===========================================

export async function checkFormAccessibility(page: Page): Promise<FormAccessibilityResult> {
  const forms = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input, select, textarea');
    return Array.from(inputs).map(input => {
      const id = input.id;
      const name = input.getAttribute('name');
      const label = id ? document.querySelector(`label[for="${id}"]`) : null;
      const ariaLabel = input.getAttribute('aria-label');
      const ariaLabelledby = input.getAttribute('aria-labelledby');
      const placeholder = input.getAttribute('placeholder');

      return {
        type: input.tagName.toLowerCase(),
        id,
        name,
        hasLabel: !!label,
        hasAriaLabel: !!ariaLabel || !!ariaLabelledby,
        hasPlaceholderOnly: !label && !ariaLabel && !ariaLabelledby && !!placeholder,
      };
    });
  });

  const issues: string[] = [];
  const unlabeled = forms.filter(f => !f.hasLabel && !f.hasAriaLabel);
  const placeholderOnly = forms.filter(f => f.hasPlaceholderOnly);

  if (unlabeled.length > 0) {
    issues.push(`${unlabeled.length} input(s) have no label or aria-label`);
  }
  if (placeholderOnly.length > 0) {
    issues.push(`${placeholderOnly.length} input(s) use only placeholder as label (not accessible)`);
  }

  return {
    passed: unlabeled.length === 0,
    total: forms.length,
    labeled: forms.filter(f => f.hasLabel).length,
    ariaLabeled: forms.filter(f => f.hasAriaLabel).length,
    unlabeled: unlabeled.length,
    placeholderOnly: placeholderOnly.length,
    issues,
  };
}

interface FormAccessibilityResult {
  passed: boolean;
  total: number;
  labeled: number;
  ariaLabeled: number;
  unlabeled: number;
  placeholderOnly: number;
  issues: string[];
}

// ===========================================
// QUICK ACCESSIBILITY AUDIT
// ===========================================

export async function quickAccessibilityAudit(page: Page): Promise<AccessibilityAuditResult> {
  const [axe, keyboard, images, headings, forms] = await Promise.all([
    runAxeAudit(page),
    testKeyboardNavigation(page),
    checkImageAltText(page),
    checkHeadingStructure(page),
    checkFormAccessibility(page),
  ]);

  const allIssues = [
    ...axe.violations.map(v => `[${v.impact}] ${v.description}`),
    ...keyboard.issues,
    ...images.missing > 0 ? [`${images.missing} images missing alt text`] : [],
    ...headings.issues,
    ...forms.issues,
  ];

  return {
    passed: axe.passed && keyboard.passed && images.passed && headings.passed && forms.passed,
    axe,
    keyboard,
    images,
    headings,
    forms,
    issues: allIssues,
  };
}

interface AccessibilityAuditResult {
  passed: boolean;
  axe: AxeAuditResult;
  keyboard: KeyboardTestResult;
  images: ImageAltResult;
  headings: HeadingResult;
  forms: FormAccessibilityResult;
  issues: string[];
}
