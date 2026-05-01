import { defineConfig } from 'vitest/config';

// Vitest config — keep separate from Playwright (which lives in
// playwright.config.ts and runs e2e). Vitest covers pure-function units.
//
// Path: tests/unit/**/*.spec.ts
// Run:  npm run test:unit
//
// We deliberately keep coverage out of the default test run; pull it in via
// `npm run test:unit -- --coverage` only when needed (slow, optional).
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.spec.ts'],
    globals: false,
    environment: 'node',
    clearMocks: true,
  },
});
