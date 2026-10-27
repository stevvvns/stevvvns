import js from '@eslint/js';
import globals from 'globals';
import stylistic from '@stylistic/eslint-plugin';

export function houseStyle({ nodeGlobs = [] } = {}) {
  const config = [
    {
      ignores: ['**/node_modules/**', '**/dist/**']
    },
    js.configs.recommended,
    {
      files: ['**/*.{js,mjs,cjs}'],
      plugins: {
        '@stylistic': stylistic
      },
      languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        globals: globals.browser
      },
      rules: {
        'no-unused-vars': [
          'error',
          {
            varsIgnorePattern: '^_',
            argsIgnorePattern: '^_'
          }
        ],
        // Core: always require braces.
        curly: ['error', 'all'],
        // Async promise executors are used deliberately (awaiting inside the executor).
        'no-async-promise-executor': 'off',

        // Formatting (replaces prettier: single quotes, semicolons, no trailing
        // commas, 2-space indent, 1tbs braces).
        '@stylistic/indent': ['error', 2, { SwitchCase: 1 }],
        '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
        '@stylistic/semi': ['error', 'always'],
        '@stylistic/comma-dangle': ['error', 'never'],
        // Braces always on their own lines, never `if (x) { return; }`.
        '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: false }],
        '@stylistic/object-curly-spacing': ['error', 'always'],
        '@stylistic/array-bracket-spacing': ['error', 'never'],
        '@stylistic/space-in-parens': ['error', 'never'],
        '@stylistic/keyword-spacing': ['error', { before: true, after: true }],
        '@stylistic/space-before-blocks': ['error', 'always'],
        '@stylistic/space-before-function-paren': [
          'error',
          { anonymous: 'always', named: 'never', asyncArrow: 'always' }
        ],
        '@stylistic/space-infix-ops': 'error',
        '@stylistic/comma-spacing': ['error', { before: false, after: true }],
        '@stylistic/key-spacing': ['error', { beforeColon: false, afterColon: true }],
        '@stylistic/arrow-parens': ['error', 'always'],
        '@stylistic/arrow-spacing': ['error', { before: true, after: true }],
        '@stylistic/eol-last': ['error', 'always'],
        '@stylistic/no-trailing-spaces': 'error',
        '@stylistic/no-multiple-empty-lines': [
          'error',
          { max: 1, maxEOF: 0, maxBOF: 0 }
        ]
      }
    }
  ];

  if (nodeGlobs.length > 0) {
    config.push({
      files: nodeGlobs,
      languageOptions: {
        globals: globals.node
      }
    });
  }

  return config;
}
