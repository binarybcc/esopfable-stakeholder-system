import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createTestUser } from '../../setup/backend.setup';

describe('Authentication Security Tests', () => {
  let app: express.Application;
  let testDb: any;

  beforeAll(async () => {
    testDb = global.testDatabase;
    
    // Setup express app with authentication middleware
    app = express();
    app.use(express.json());

    // Mock authentication middleware
    const authenticateToken = async (req: any, res: any, next: any) => {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'NO_TOKEN',
            message: 'Access token required'
          },
          timestamp: new Date()
        });
      }

      try {
        const decoded = jwt.verify(token, global.TEST_CONFIG.JWT_SECRET) as any;
        
        // Verify user exists and is active
        const user = await testDb('users')
          .where('auth0_id', decoded.sub)
          .where('is_active', true)
          .first();

        if (!user) {
          return res.status(401).json({
            success: false,
            error: {
              code: 'INVALID_USER',
              message: 'User not found or inactive'
            },
            timestamp: new Date()
          });
        }

        req.user = user;
        next();
      } catch (error) {
        if (error.name === 'TokenExpiredError') {
          return res.status(401).json({
            success: false,
            error: {
              code: 'TOKEN_EXPIRED',
              message: 'Access token has expired'
            },
            timestamp: new Date()
          });
        }

        return res.status(403).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid access token'
          },
          timestamp: new Date()
        });
      }
    };

    // Protected route for testing
    app.get('/api/protected', authenticateToken, (req, res) => {
      res.json({
        success: true,
        data: {
          message: 'Access granted',
          user: req.user.email
        },
        timestamp: new Date()
      });
    });

    // Login endpoint mock
    app.post('/api/auth/login', async (req, res) => {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_CREDENTIALS',
            message: 'Email and password are required'
          },
          timestamp: new Date()
        });
      }

      try {
        const user = await testDb('users')
          .where('email', email)
          .where('is_active', true)
          .first();

        if (!user) {
          return res.status(401).json({
            success: false,
            error: {
              code: 'INVALID_CREDENTIALS',
              message: 'Invalid email or password'
            },
            timestamp: new Date()
          });
        }

        // In a real implementation, you would verify the password hash
        // For testing, we'll just check if password is 'correct'
        const isValidPassword = password === 'correct';

        if (!isValidPassword) {
          return res.status(401).json({
            success: false,
            error: {
              code: 'INVALID_CREDENTIALS',
              message: 'Invalid email or password'
            },
            timestamp: new Date()
          });
        }

        // Generate JWT token
        const token = jwt.sign(
          {
            sub: user.auth0_id,
            email: user.email,
            role: user.role_type,
            iat: Math.floor(Date.now() / 1000)
          },
          global.TEST_CONFIG.JWT_SECRET,
          { expiresIn: '1h' }
        );

        // Update last login timestamp
        await testDb('users')
          .where('id', user.id)
          .update({ last_login: new Date() });

        res.json({
          success: true,
          data: {
            token,
            user: {
              id: user.id,
              email: user.email,
              role: user.role_type
            }
          },
          timestamp: new Date()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'LOGIN_ERROR',
            message: 'Login failed'
          },
          timestamp: new Date()
        });
      }
    });

    // Logout endpoint
    app.post('/api/auth/logout', authenticateToken, async (req, res) => {
      // In a real implementation, you might blacklist the token
      res.json({
        success: true,
        data: { message: 'Logged out successfully' },
        timestamp: new Date()
      });
    });

    // Password change endpoint
    app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PASSWORDS',
            message: 'Current password and new password are required'
          },
          timestamp: new Date()
        });
      }

      // Password strength validation
      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'WEAK_PASSWORD',
            message: 'Password must be at least 8 characters long'
          },
          timestamp: new Date()
        });
      }

      // In real implementation, verify current password and hash new password
      res.json({
        success: true,
        data: { message: 'Password changed successfully' },
        timestamp: new Date()
      });
    });
  });

  describe('JWT Token Validation', () => {
    let testUser: any;
    let validToken: string;

    beforeEach(async () => {
      testUser = await createTestUser(testDb);
      validToken = jwt.sign(
        {
          sub: testUser.auth0_id,
          email: testUser.email,
          role: testUser.role_type
        },
        global.TEST_CONFIG.JWT_SECRET,
        { expiresIn: '1h' }
      );
    });

    it('should accept valid JWT token', async () => {
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBe(testUser.email);
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/protected');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });

    it('should reject malformed token', async () => {
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject expired token', async () => {
      const expiredToken = jwt.sign(
        {
          sub: testUser.auth0_id,
          email: testUser.email,
          role: testUser.role_type,
          exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
        },
        global.TEST_CONFIG.JWT_SECRET
      );

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('TOKEN_EXPIRED');
    });

    it('should reject token with wrong signature', async () => {
      const wrongSignatureToken = jwt.sign(
        {
          sub: testUser.auth0_id,
          email: testUser.email,
          role: testUser.role_type
        },
        'wrong-secret-key'
      );

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${wrongSignatureToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject token for inactive user', async () => {
      // Deactivate user
      await testDb('users')
        .where('id', testUser.id)
        .update({ is_active: false });

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_USER');
    });

    it('should reject token for non-existent user', async () => {
      const nonExistentUserToken = jwt.sign(
        {
          sub: 'auth0|non-existent-user',
          email: 'nonexistent@example.com'
        },
        global.TEST_CONFIG.JWT_SECRET
      );

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${nonExistentUserToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_USER');
    });
  });

  describe('Login Security', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await createTestUser(testDb, {
        email: 'test@security.com',
        // In real implementation, this would be a hashed password
        password: 'hashedpassword123'
      });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'correct'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.email).toBe(testUser.email);
    });

    it('should reject login with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'correct'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login with missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email
          // password missing
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_CREDENTIALS');
    });

    it('should not reveal whether email or password is wrong', async () => {
      const invalidEmailResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'correct'
        });

      const invalidPasswordResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        });

      expect(invalidEmailResponse.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(invalidPasswordResponse.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(invalidEmailResponse.body.error.message).toBe(invalidPasswordResponse.body.error.message);
    });

    it('should update last login timestamp on successful login', async () => {
      const beforeLogin = new Date();
      
      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'correct'
        });

      const updatedUser = await testDb('users')
        .where('id', testUser.id)
        .first();

      expect(new Date(updatedUser.last_login)).toBeInstanceOf(Date);
      expect(new Date(updatedUser.last_login).getTime()).toBeGreaterThanOrEqual(beforeLogin.getTime());
    });

    it('should prevent login for inactive users', async () => {
      await testDb('users')
        .where('id', testUser.id)
        .update({ is_active: false });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'correct'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('Password Security', () => {
    let testUser: any;
    let validToken: string;

    beforeEach(async () => {
      testUser = await createTestUser(testDb);
      validToken = jwt.sign(
        { sub: testUser.auth0_id, email: testUser.email },
        global.TEST_CONFIG.JWT_SECRET,
        { expiresIn: '1h' }
      );
    });

    it('should change password successfully', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          currentPassword: 'oldpassword123',
          newPassword: 'newstrongpassword123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should require both current and new password', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          currentPassword: 'oldpassword123'
          // newPassword missing
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_PASSWORDS');
    });

    it('should enforce minimum password length', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          currentPassword: 'oldpassword123',
          newPassword: '123' // Too short
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('WEAK_PASSWORD');
    });

    it('should require authentication for password change', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .send({
          currentPassword: 'oldpassword123',
          newPassword: 'newstrongpassword123'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });
  });

  describe('Session Management', () => {
    let testUser: any;
    let validToken: string;

    beforeEach(async () => {
      testUser = await createTestUser(testDb);
      validToken = jwt.sign(
        { sub: testUser.auth0_id, email: testUser.email },
        global.TEST_CONFIG.JWT_SECRET,
        { expiresIn: '1h' }
      );
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should require authentication for logout', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });
  });

  describe('Brute Force Protection', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await createTestUser(testDb, {
        email: 'bruteforce@test.com'
      });
    });

    it('should handle multiple failed login attempts', async () => {
      const failedAttempts = 10;
      const promises = Array.from({ length: failedAttempts }, () =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'wrongpassword'
          })
      );

      const responses = await Promise.all(promises);

      // All attempts should fail with same error
      responses.forEach(response => {
        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
      });

      // In a real implementation, you would implement account lockout
      // or rate limiting after multiple failed attempts
    });

    it('should not leak timing information', async () => {
      const validEmailTimes: number[] = [];
      const invalidEmailTimes: number[] = [];

      // Test with valid email, invalid password
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'wrongpassword'
          });
        const endTime = Date.now();
        validEmailTimes.push(endTime - startTime);
      }

      // Test with invalid email
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'wrongpassword'
          });
        const endTime = Date.now();
        invalidEmailTimes.push(endTime - startTime);
      }

      // Calculate averages
      const validEmailAvg = validEmailTimes.reduce((a, b) => a + b, 0) / validEmailTimes.length;
      const invalidEmailAvg = invalidEmailTimes.reduce((a, b) => a + b, 0) / invalidEmailTimes.length;

      // Response times should be similar (within reasonable variance)
      // This is a basic test - in practice, you'd want more sophisticated timing analysis
      const timingDifference = Math.abs(validEmailAvg - invalidEmailAvg);
      expect(timingDifference).toBeLessThan(100); // Within 100ms difference
    });
  });

  describe('Token Security', () => {
    it('should use secure token generation', () => {
      const token1 = jwt.sign({ test: 'data1' }, global.TEST_CONFIG.JWT_SECRET);
      const token2 = jwt.sign({ test: 'data2' }, global.TEST_CONFIG.JWT_SECRET);

      expect(token1).not.toBe(token2);
      expect(token1.split('.').length).toBe(3); // header.payload.signature
    });

    it('should include necessary claims in token', async () => {
      const testUser = await createTestUser(testDb);
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'correct'
        });

      const token = response.body.data.token;
      const decoded = jwt.decode(token) as any;

      expect(decoded.sub).toBeDefined(); // Subject (user ID)
      expect(decoded.email).toBeDefined(); // User email
      expect(decoded.role).toBeDefined(); // User role
      expect(decoded.iat).toBeDefined(); // Issued at
      expect(decoded.exp).toBeDefined(); // Expiration
    });

    it('should have reasonable token expiration', async () => {
      const testUser = await createTestUser(testDb);
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'correct'
        });

      const token = response.body.data.token;
      const decoded = jwt.decode(token) as any;

      const now = Math.floor(Date.now() / 1000);
      const tokenAge = decoded.exp - decoded.iat;
      const maxAge = 24 * 60 * 60; // 24 hours

      expect(tokenAge).toBeLessThanOrEqual(maxAge);
      expect(decoded.exp).toBeGreaterThan(now);
    });
  });

  afterEach(async () => {
    // Clean up test users
    await testDb('users').where('email', 'like', '%test.com').del();
    await testDb('users').where('email', 'like', '%security.com').del();
  });
});