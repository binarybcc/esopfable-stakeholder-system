// Global Jest setup for all test environments
const { execSync } = require('child_process');

// Global test configuration
global.TEST_CONFIG = {
  DB_NAME: 'test_case_management',
  REDIS_DB: 15, // Use separate Redis DB for tests
  LOG_LEVEL: 'error', // Minimize logging in tests
  ENCRYPTION_KEY: 'test-encryption-key-32-chars-long!',
  JWT_SECRET: 'test-jwt-secret-for-authentication',
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB for tests
  ALLOWED_FILE_TYPES: ['pdf', 'doc', 'docx', 'txt', 'jpg', 'png'],
  TEST_TIMEOUT: 30000
};

// Environment variables for tests
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = `postgresql://test_user:test_password@localhost:5432/${global.TEST_CONFIG.DB_NAME}`;
process.env.REDIS_URL = `redis://localhost:6379/${global.TEST_CONFIG.REDIS_DB}`;
process.env.JWT_SECRET = global.TEST_CONFIG.JWT_SECRET;
process.env.ENCRYPTION_KEY = global.TEST_CONFIG.ENCRYPTION_KEY;
process.env.LOG_LEVEL = global.TEST_CONFIG.LOG_LEVEL;

// Global timeout for async operations
jest.setTimeout(global.TEST_CONFIG.TEST_TIMEOUT);

// Mock external services by default
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({
      messageId: 'mock-message-id',
      response: 'Email sent successfully'
    }),
    verify: jest.fn().mockResolvedValue(true)
  }))
}));

jest.mock('node-clamav', () => ({
  init: jest.fn().mockResolvedValue(true),
  isCleanReply: jest.fn().mockReturnValue(true),
  scanFile: jest.fn().mockResolvedValue({
    isInfected: false,
    viruses: []
  })
}));

jest.mock('socket.io', () => ({
  Server: jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    to: jest.fn(() => ({
      emit: jest.fn()
    })),
    use: jest.fn()
  }))
}));

// Global error handling for unhandled rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Cleanup function to be called after all tests
global.afterAllTests = async () => {
  // Close database connections
  if (global.testDatabase) {
    await global.testDatabase.destroy();
  }
  
  // Close Redis connections
  if (global.testRedis) {
    await global.testRedis.quit();
  }
  
  // Cleanup test files
  try {
    execSync('rm -rf /tmp/test-uploads/*', { stdio: 'ignore' });
  } catch (error) {
    // Ignore cleanup errors
  }
};

// Helper function to create test user
global.createTestUser = (overrides = {}) => ({
  id: 'test-user-' + Math.random().toString(36).substr(2, 9),
  auth0Id: 'auth0|test-' + Math.random().toString(36).substr(2, 9),
  email: `test${Math.random().toString(36).substr(2, 5)}@example.com`,
  roleType: 'legal_team',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

// Helper function to create test stakeholder
global.createTestStakeholder = (overrides = {}) => ({
  id: 'stakeholder-' + Math.random().toString(36).substr(2, 9),
  category: 'esop_participant',
  name: 'Test Stakeholder',
  organization: 'Test Organization',
  title: 'Test Title',
  contactInfo: {
    email: 'stakeholder@example.com',
    phone: '+1234567890'
  },
  metadata: {},
  securityLevel: 'standard',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

// Helper function to create test document
global.createTestDocument = (overrides = {}) => ({
  id: 'document-' + Math.random().toString(36).substr(2, 9),
  title: 'Test Document',
  description: 'A test document for testing purposes',
  filePath: '/tmp/test-uploads/test-document.pdf',
  fileHash: 'sha256:' + Math.random().toString(36),
  fileSize: 1024,
  mimeType: 'application/pdf',
  classification: 'internal',
  uploadedBy: 'test-user-123',
  versionNumber: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

// Helper function to create test evidence
global.createTestEvidence = (overrides = {}) => ({
  id: 'evidence-' + Math.random().toString(36).substr(2, 9),
  evidenceType: 'document',
  sourceStakeholderId: 'stakeholder-123',
  chainOfCustody: [],
  integrityHash: 'sha256:' + Math.random().toString(36),
  authenticityVerified: false,
  significanceLevel: 5,
  notes: 'Test evidence item',
  createdAt: new Date(),
  ...overrides
});

// Console warnings filter
const originalWarn = console.warn;
console.warn = (...args) => {
  // Filter out known test warnings
  const message = args.join(' ');
  if (
    message.includes('React.createElement: type is invalid') ||
    message.includes('Warning: componentWillReceiveProps') ||
    message.includes('Warning: componentWillMount')
  ) {
    return;
  }
  originalWarn(...args);
};

console.log('Global Jest setup completed');