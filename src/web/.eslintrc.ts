// @typescript-eslint/eslint-plugin version: ^5.59.0
// @typescript-eslint/parser version: ^5.59.0
// eslint-plugin-react version: ^7.32.2
// eslint-plugin-react-hooks version: ^4.6.0
// eslint-config-prettier version: ^8.8.0

module.exports = {
  // Use TypeScript parser for enhanced type checking
  parser: '@typescript-eslint/parser',

  // Parser options for modern JavaScript and TypeScript features
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
    // Reference to TypeScript configuration
    project: './tsconfig.json',
  },

  // Essential plugins for React and TypeScript
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
  ],

  // Extended configurations for recommended rules
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier', // Must be last to properly override other configs
  ],

  // React-specific settings
  settings: {
    react: {
      version: 'detect', // Automatically detect React version
    },
  },

  // Custom rule configurations
  rules: {
    // TypeScript-specific rules
    '@typescript-eslint/explicit-function-return-type': 'off', // Allow type inference for function returns
    '@typescript-eslint/no-explicit-any': 'error', // Prevent usage of 'any' type
    '@typescript-eslint/no-unused-vars': ['error', {
      'argsIgnorePattern': '^_', // Allow unused variables that start with underscore
    }],

    // React-specific rules
    'react/react-in-jsx-scope': 'off', // Not needed in React 17+ with new JSX transform
    'react-hooks/rules-of-hooks': 'error', // Enforce hooks rules
    'react-hooks/exhaustive-deps': 'warn', // Warn about missing dependencies in hooks

    // General JavaScript/TypeScript rules
    'no-console': ['warn', {
      allow: ['warn', 'error'], // Only allow console.warn and console.error
    }],
    'eqeqeq': ['error', 'always'], // Require strict equality comparisons
  },

  // Environment configuration
  env: {
    browser: true, // Enable browser globals
    es2022: true, // Enable ES2022 globals and features
    node: true, // Enable Node.js globals
  },
};