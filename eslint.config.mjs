// ESLint 10 removed eslintrc, so this is the former .eslintrc as a flat config.
import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    ignores: [
      'dist/**',
      'build/**',
      'examples/**',
      'babel.config.js',
      'rollup.config.mjs',
      'jest-setup.js',
    ],
  },
  js.configs.recommended,
  ...tsPlugin.configs['flat/recommended'],
  {
    files: ['src/**/*.ts', 'src/**/*.js'],
    rules: {
      'no-multi-spaces': 'error',
      'no-nested-ternary': 'error',
      'no-trailing-spaces': 'error',
      'no-irregular-whitespace': 'error',
      'no-param-reassign': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        2,
        { vars: 'all', args: 'none', caughtErrors: 'none' },
      ],
      'comma-dangle': ['error', 'always-multiline'],
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
];
