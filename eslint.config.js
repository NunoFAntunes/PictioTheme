// Lint rules that enforce the 🔒 rules in docs/technical/backend-guidelines.md and
// frontend-guidelines.md. Import boundaries live in .dependency-cruiser.cjs instead.
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const TEST_FILES = ['**/*.test.ts', '**/*.test.tsx', '**/test-support/**'];
// Tools that require a default export from their config/entry files.
const DEFAULT_EXPORT_ALLOWED = [
  '**/*.config.{js,mjs,ts}',
  '**/test-support/global-setup.ts',
  'apps/web/src/pages/**',
];

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/.astro/**', '**/node_modules/**', '**/coverage/**', 'docs/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'error', // B23: use the injected logger
      '@typescript-eslint/no-explicit-any': 'error', // B26
      '@typescript-eslint/no-non-null-assertion': 'error', // B26
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Fastify plugins and handlers are async by convention even without an await (rule F3).
      '@typescript-eslint/require-await': 'off',
      'no-restricted-exports': ['error', { restrictDefaultExports: { direct: true } }], // B27
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
  },
  {
    files: DEFAULT_EXPORT_ALLOWED,
    rules: { 'no-restricted-exports': 'off' },
  },
  {
    files: TEST_FILES,
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },

  // ── Server: only config.ts reads the environment (B22) ──
  {
    files: ['apps/server/src/**/*.ts'],
    ignores: ['apps/server/src/config.ts', ...TEST_FILES],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'process', property: 'env', message: 'Read config from config.ts (rule B22).' },
      ],
    },
  },

  // ── game-core: deterministic, no I/O (B6). Time and randomness are passed in. ──
  {
    files: ['packages/game-core/src/**/*.ts'],
    ignores: TEST_FILES,
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the injected Rng (rule B6).' },
        { object: 'Date', property: 'now', message: 'Use ctx.now (rule B6).' },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "NewExpression[callee.name='Date']", message: 'Use ctx.now (rule B6).' },
      ],
      'no-restricted-globals': [
        'error',
        ...['fetch', 'setTimeout', 'setInterval', 'process', 'console'].map((name) => ({
          name,
          message: 'game-core has no I/O; return effects instead (rule B6).',
        })),
      ],
    },
  },

  // ── Web ──
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['apps/web/src/**/*.tsx'],
    ...reactHooks.configs.flat['recommended-latest'],
  },
);
