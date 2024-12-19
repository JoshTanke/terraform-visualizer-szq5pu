// @jest/types version: ^29.0.0
import type { Config } from '@jest/types';

/*
 * Comprehensive Jest Configuration for Backend Services
 * Configured for TypeScript integration, high test coverage requirements,
 * and efficient test execution with proper module resolution
 */
const config: Config.InitialOptions = {
  // Use ts-jest for TypeScript integration
  preset: 'ts-jest',

  // Set Node.js as the test environment
  testEnvironment: 'node',

  // Define root directories for tests and source files
  roots: [
    '<rootDir>/src',
    '<rootDir>/tests'
  ],

  // Test file patterns to match
  testMatch: [
    '**/*.test.ts',
    '**/*.spec.ts'
  ],

  // Module name mapping for path aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // Supported file extensions
  moduleFileExtensions: [
    'ts',
    'js',
    'json'
  ],

  // Coverage collection configuration
  collectCoverageFrom: [
    'src/**/*.ts',
    // Exclude type definition files and other non-testable files
    '!src/**/*.d.ts',
    '!src/**/*.interface.ts',
    '!src/**/index.ts',
    '!src/**/*.types.ts',
    '!src/**/*.constants.ts',
    '!src/**/*.mock.ts'
  ],

  // Coverage output configuration
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json'
  ],

  // Coverage thresholds enforcement
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Test execution configuration
  verbose: true,
  testTimeout: 10000, // 10 second timeout for tests
  clearMocks: true,   // Automatically clear mock calls before every test
  restoreMocks: true, // Automatically restore mock state before every test

  // Performance optimization
  maxWorkers: '50%', // Use 50% of available CPU cores for test execution

  // Error handling and debugging
  errorOnDeprecated: true,    // Throw errors for deprecated API usage
  detectOpenHandles: true,    // Help identify open handles preventing Jest from exiting
  forceExit: true            // Force Jest to exit after all tests complete
};

// Export the configuration
export default config;