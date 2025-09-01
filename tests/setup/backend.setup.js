const request = require('supertest');
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Mock external services for backend tests
jest.mock('express-rate-limit', () => {
  return jest.fn(() => (req, res, next) => next());
});

jest.mock('helmet', () => {
  return jest.fn(() => (req, res, next) => next());
});

jest.mock('morgan', () => {
  return jest.fn(() => (req, res, next) => next());
});

// File upload mock setup
const createMockFile = (filename = 'test.pdf', mimetype = 'application/pdf', size = 1024) => ({
  fieldname: 'file',
  originalname: filename,
  encoding: '7bit',
  mimetype,
  size,
  destination: '/tmp/test-uploads',
  filename: `test-${Date.now()}-${filename}`,
  path: path.join('/tmp/test-uploads', filename),
  buffer: Buffer.alloc(size, 'test-content')
});

// Authentication helpers
const generateTestJWT = (user = {}) => {
  const jwt = require('jsonwebtoken');
  const payload = {
    sub: user.auth0Id || 'auth0|test-user',
    email: user.email || 'test@example.com',
    role: user.roleType || 'legal_team',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    ...user
  };
  
  return jwt.sign(payload, global.TEST_CONFIG.JWT_SECRET);
};

const createAuthenticatedRequest = (app, user = {}) => {
  const token = generateTestJWT(user);
  return request(app).set('Authorization', `Bearer ${token}`);
};

// Database helpers for backend tests
const createTestUser = async (db, userData = {}) => {
  const user = {
    id: crypto.randomUUID(),
    auth0_id: `auth0|test-${Math.random().toString(36).substr(2, 9)}`,
    email: `test${Math.random().toString(36).substr(2, 5)}@example.com`,
    role_type: 'legal_team',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...userData
  };

  await db('users').insert(user);
  return user;
};

const createTestDocument = async (db, userId, docData = {}) => {
  const document = {
    id: crypto.randomUUID(),
    title: 'Test Document',
    description: 'Test document description',
    file_path: '/tmp/test-uploads/test-document.pdf',
    file_hash: `sha256:${crypto.randomBytes(32).toString('hex')}`,
    file_size: 1024,
    mime_type: 'application/pdf',
    classification: 'internal',
    uploaded_by: userId,
    version_number: 1,
    created_at: new Date(),
    updated_at: new Date(),
    ...docData
  };

  await db('documents').insert(document);
  return document;
};

const createTestStakeholder = async (db, stakeholderData = {}) => {
  const stakeholder = {
    id: crypto.randomUUID(),
    category: 'esop_participant',
    name: 'Test Stakeholder',
    organization: 'Test Organization',
    title: 'Test Title',
    contact_info: JSON.stringify({ email: 'stakeholder@example.com' }),
    metadata: JSON.stringify({}),
    security_level: 'standard',
    created_at: new Date(),
    updated_at: new Date(),
    ...stakeholderData
  };

  await db('stakeholders').insert(stakeholder);
  return stakeholder;
};

// API response helpers
const expectSuccessResponse = (response, expectedStatus = 200) => {
  expect(response.status).toBe(expectedStatus);
  expect(response.body).toHaveProperty('success', true);
  expect(response.body).toHaveProperty('data');
  expect(response.body).toHaveProperty('timestamp');
};

const expectErrorResponse = (response, expectedStatus, expectedCode = null) => {
  expect(response.status).toBe(expectedStatus);
  expect(response.body).toHaveProperty('success', false);
  expect(response.body).toHaveProperty('error');
  
  if (expectedCode) {
    expect(response.body.error).toHaveProperty('code', expectedCode);
  }
  
  expect(response.body.error).toHaveProperty('message');
};

const expectValidationError = (response, field = null) => {
  expectErrorResponse(response, 400, 'VALIDATION_ERROR');
  
  if (field) {
    expect(response.body.error.details).toContainEqual(
      expect.objectContaining({ field })
    );
  }
};

// Security test helpers
const testUnauthorizedAccess = async (app, method = 'get', endpoint = '/') => {
  const response = await request(app)[method](endpoint);
  expect([401, 403]).toContain(response.status);
};

const testInsufficientPermissions = async (app, user, method = 'get', endpoint = '/') => {
  const response = await createAuthenticatedRequest(app, user)[method](endpoint);
  expect([403, 404]).toContain(response.status);
};

const testRateLimiting = async (app, endpoint = '/', count = 100) => {
  const requests = Array(count).fill(null).map(() => 
    request(app).get(endpoint)
  );
  
  const responses = await Promise.all(requests);
  const rateLimitedResponses = responses.filter(r => r.status === 429);
  
  // Should have some rate limited responses if rate limiting is working
  expect(rateLimitedResponses.length).toBeGreaterThan(0);
};

// File system helpers
const createTestUploadDirectory = async () => {
  const uploadDir = '/tmp/test-uploads';
  try {
    await fs.mkdir(uploadDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
  return uploadDir;
};

const cleanupTestFiles = async () => {
  const uploadDir = '/tmp/test-uploads';
  try {
    const files = await fs.readdir(uploadDir);
    await Promise.all(files.map(file => 
      fs.unlink(path.join(uploadDir, file))
    ));
  } catch (error) {
    // Ignore cleanup errors
  }
};

// Encryption test helpers
const testEncryptionService = (encryptionService) => {
  describe('Encryption Service', () => {
    it('should encrypt and decrypt data correctly', async () => {
      const originalData = 'sensitive test data';
      const encrypted = await encryptionService.encrypt(originalData);
      const decrypted = await encryptionService.decrypt(encrypted);
      
      expect(encrypted).not.toBe(originalData);
      expect(decrypted).toBe(originalData);
    });
    
    it('should generate different ciphertext for same plaintext', async () => {
      const data = 'test data';
      const encrypted1 = await encryptionService.encrypt(data);
      const encrypted2 = await encryptionService.encrypt(data);
      
      expect(encrypted1).not.toBe(encrypted2);
    });
    
    it('should fail to decrypt with wrong key', async () => {
      const data = 'test data';
      const encrypted = await encryptionService.encrypt(data);
      
      // Attempt decryption with modified ciphertext
      const tamperedEncrypted = encrypted.slice(0, -1) + '0';
      
      await expect(encryptionService.decrypt(tamperedEncrypted))
        .rejects.toThrow();
    });
  });
};

// Performance test helpers
const measureExecutionTime = async (fn) => {
  const start = process.hrtime.bigint();
  const result = await fn();
  const end = process.hrtime.bigint();
  const duration = Number(end - start) / 1000000; // Convert to milliseconds
  
  return { result, duration };
};

const expectPerformance = (duration, maxMs) => {
  expect(duration).toBeLessThan(maxMs);
};

// Setup and teardown
beforeEach(async () => {
  await createTestUploadDirectory();
});

afterEach(async () => {
  await cleanupTestFiles();
  
  // Clear Redis cache
  if (global.testRedis) {
    await global.testRedis.flushDb();
  }
});

// Export all helpers
global.backendTestHelpers = {
  createMockFile,
  generateTestJWT,
  createAuthenticatedRequest,
  createTestUser,
  createTestDocument,
  createTestStakeholder,
  expectSuccessResponse,
  expectErrorResponse,
  expectValidationError,
  testUnauthorizedAccess,
  testInsufficientPermissions,
  testRateLimiting,
  createTestUploadDirectory,
  cleanupTestFiles,
  testEncryptionService,
  measureExecutionTime,
  expectPerformance
};

module.exports = global.backendTestHelpers;