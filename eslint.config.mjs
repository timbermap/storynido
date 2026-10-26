import path from 'node:path';

import js from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const nextApps = ['apps/web', 'apps/admin'];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/next-env.d.ts',
      '**/.turbo/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      'no-console': 'error',
    },
  },
  ...[...nextVitals, ...nextTs].map((config) => ({
    ...config,
    files: nextApps.map((app) => `${app}/**/*.{ts,tsx,js,jsx,mjs}`),
  })),
  {
    files: nextApps.map((app) => `${app}/**/*.{ts,tsx}`),
    settings: { next: { rootDir: nextApps.map((app) => path.join(import.meta.dirname, app)) } },
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    // Scripts de terminal: imprimir es su salida.
    files: ['firebase/src/**/*.ts', 'packages/*/scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
);
