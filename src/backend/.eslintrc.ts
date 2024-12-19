// @typescript-eslint/parser version: ^5.0.0
// @typescript-eslint/eslint-plugin version: ^5.0.0
// eslint-config-prettier version: ^8.0.0
// eslint-plugin-prettier version: ^4.0.0

import type { Linter } from 'eslint';

const eslintConfig: Linter.Config = {
  // Use TypeScript parser for enhanced type checking
  parser: '@typescript-eslint/parser',

  // Parser options for TypeScript integration
  parserOptions: {
    project: './tsconfig.json',
    ecmaVersion: 2022,
    sourceType: 'module',
  },

  // Essential plugins for TypeScript and Prettier
  plugins: [
    '@typescript-eslint',
    'prettier'
  ],

  // Extended configurations for recommended rules
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier'
  ],

  // Custom rule configurations
  rules: {
    // Prettier integration
    'prettier/prettier': 'error',

    // TypeScript-specific rules
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',

    // General code quality rules
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-duplicate-imports': 'error',
    'no-unused-expressions': 'error',
    'prefer-const': 'error',
    'eqeqeq': ['error', 'always'],
  },

  // Environment configuration
  env: {
    node: true,
    es2022: true,
  },

  // Files to ignore
  ignorePatterns: [
    'dist',
    'coverage',
    'node_modules',
    '**/*.test.ts',
    '**/*.spec.ts'
  ],

  // Specify as root configuration
  root: true,
};

export default eslintConfig;