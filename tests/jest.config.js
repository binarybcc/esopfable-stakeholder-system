/** @type {import('jest').Config} */
module.exports = {
  // Test environment for Node.js backend tests
  testEnvironment: 'node',
  
  // Root directories for tests
  roots: [
    '<rootDir>/tests',
    '<rootDir>/backend/tests'
  ],
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.{js,ts}',
    '**/?(*.)+(spec|test).{js,ts}'
  ],
  
  // TypeScript transformation
  transform: {
    '^.+\\.ts$': 'ts-jest',
    '^.+\\.js$': 'babel-jest'
  },
  
  // File extensions to consider
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Module name mapping for path aliases
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@backend/(.*)$': '<rootDir>/backend/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/jest.setup.js',
    '<rootDir>/tests/setup/database.setup.js'
  ],
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/tests/coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  
  // Coverage thresholds - enforcing high coverage for critical security functions
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Higher thresholds for critical security modules
    './backend/src/services/AccessControlService.ts': {
      branches: 90,
      functions: 95,
      lines: 90,
      statements: 90
    },
    './backend/src/services/EncryptionService.ts': {
      branches: 95,
      functions: 100,
      lines: 95,
      statements: 95
    },
    './src/auth/**/*.{js,ts}': {
      branches: 85,
      functions: 90,
      lines: 85,
      statements: 85
    },
    './src/security/**/*.{js,ts}': {
      branches: 85,
      functions: 90,
      lines: 85,
      statements: 85
    }
  },
  
  // Files to collect coverage from
  collectCoverageFrom: [
    'backend/src/**/*.{js,ts}',
    'src/**/*.{js,ts}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/dist/**',
    '!**/*.config.{js,ts}',
    '!**/migrations/**',
    '!**/seeds/**'
  ],
  
  // Test timeout for slow operations
  testTimeout: 30000,
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  
  // Verbose output for debugging
  verbose: true,
  
  // Fail tests on console errors/warnings
  silent: false,
  
  // Global test variables
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/backend/tsconfig.json'
    }
  },
  
  // Test projects for different environments
  projects: [
    // Backend API tests
    {
      displayName: 'Backend API',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/backend/**/*.test.{js,ts}'],
      setupFilesAfterEnv: [
        '<rootDir>/tests/setup/backend.setup.js'
      ]
    },
    
    // Frontend component tests
    {
      displayName: 'Frontend Components',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/tests/frontend/**/*.test.{js,ts,tsx}'],
      setupFilesAfterEnv: [
        '<rootDir>/tests/setup/frontend.setup.js'
      ],
      moduleNameMapping: {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
      }
    },
    
    // Integration tests
    {
      displayName: 'Integration Tests',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/integration/**/*.test.{js,ts}'],
      setupFilesAfterEnv: [
        '<rootDir>/tests/setup/integration.setup.js'
      ],
      testTimeout: 60000
    },
    
    // Security tests
    {
      displayName: 'Security Tests',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/security/**/*.test.{js,ts}'],
      setupFilesAfterEnv: [
        '<rootDir>/tests/setup/security.setup.js'
      ],
      testTimeout: 45000
    },
    
    // Performance tests
    {
      displayName: 'Performance Tests',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/performance/**/*.test.{js,ts}'],
      setupFilesAfterEnv: [
        '<rootDir>/tests/setup/performance.setup.js'
      ],
      testTimeout: 120000
    }
  ]
};