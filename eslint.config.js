import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**', '*.config.js', '*.config.ts', 'playwright.config.ts', 'supabase/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  }
);
