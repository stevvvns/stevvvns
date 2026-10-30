import js from '@eslint/js';
import globals from 'globals';
import stylistic from '@stylistic/eslint-plugin';
import lit from 'eslint-plugin-lit';

export function houseStyle({ nodeGlobs = [] } = {}) {
  const config = [
    {
      ignores: ['**/node_modules/**', '**/dist/**']
    },
    js.configs.recommended,
    {
      files: ['**/*.{js,mjs,cjs}'],
      plugins: {
        '@stylistic': stylistic,
        lit
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
        '@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0, maxBOF: 0 }],

        // Lit template rules. We use lit-html's `html` (re-exported via
        // @stevvvns/incomponent), so the plugin's tag-name detection applies
        // directly. LitElement/decorator-specific rules (lifecycle-super,
        // prefer-query-decorators, etc.) are intentionally omitted.
        'lit/attribute-names': 'error',
        'lit/attribute-value-entities': 'error',
        'lit/binding-positions': 'error',
        'lit/no-duplicate-template-bindings': 'error',
        'lit/no-invalid-escape-sequences': 'error',
        'lit/no-invalid-html': 'error',
        'lit/no-legacy-template-syntax': 'error',
        'lit/no-template-arrow': 'off', // inline handler closures are idiomatic here
        'lit/no-template-bind': 'error',
        'lit/no-template-map': 'error',
        'lit/no-useless-template-literals': 'error',
        'lit/no-value-attribute': 'error',
        'lit/prefer-nothing': 'error',
        'lit/quoted-expressions': 'error',
        'lit/value-after-constraints': 'error'
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
