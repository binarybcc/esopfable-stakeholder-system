import request from 'supertest';
import express from 'express';
import { createTestUser, createTestDocument, createTestStakeholder } from '../../setup/backend.setup';

describe('Authorization Security Tests', () => {
  let app: express.Application;
  let testDb: any;

  // Test users with different roles
  let legalUser: any;
  let esopUser: any;
  let governmentUser: any;
  let witnessUser: any;
  let mediaUser: any;

  // Test tokens
  let legalToken: string;
  let esopToken: string;
  let governmentToken: string;
  let witnessToken: string;
  let mediaToken: string;

  beforeAll(async () => {
    testDb = global.testDatabase;

    // Create test users with different roles
    legalUser = await createTestUser(testDb, { 
      email: 'legal@test.com', 
      role_type: 'legal_team' 
    });
    esopUser = await createTestUser(testDb, { 
      email: 'esop@test.com', 
      role_type: 'esop_participant' 
    });
    governmentUser = await createTestUser(testDb, { 
      email: 'gov@test.com', 
      role_type: 'government_entity' 
    });
    witnessUser = await createTestUser(testDb, { 
      email: 'witness@test.com', 
      role_type: 'witness' 
    });
    mediaUser = await createTestUser(testDb, { 
      email: 'media@test.com', 
      role_type: 'media_contact' 
    });

    // Generate tokens for each user
    legalToken = global.backendTestHelpers.generateTestJWT(legalUser);
    esopToken = global.backendTestHelpers.generateTestJWT(esopUser);
    governmentToken = global.backendTestHelpers.generateTestJWT(governmentUser);
    witnessToken = global.backendTestHelpers.generateTestJWT(witnessUser);
    mediaToken = global.backendTestHelpers.generateTestJWT(mediaUser);

    // Setup express app with authorization middleware
    app = express();
    app.use(express.json());

    // Mock authentication middleware
    const authenticateToken = (req: any, res: any, next: any) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (token === legalToken) req.user = legalUser;
      else if (token === esopToken) req.user = esopUser;
      else if (token === governmentToken) req.user = governmentUser;
      else if (token === witnessToken) req.user = witnessUser;
      else if (token === mediaToken) req.user = mediaUser;
      else {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid token' }
        });
      }
      
      next();
    };

    // Role-based authorization middleware
    const requireRole = (allowedRoles: string[]) => {
      return (req: any, res: any, next: any) => {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
          });
        }

        if (!allowedRoles.includes(req.user.role_type)) {
          return res.status(403).json({
            success: false,
            error: { 
              code: 'FORBIDDEN', 
              message: `Access denied. Required roles: ${allowedRoles.join(', ')}` 
            }
          });
        }

        next();
      };
    };

    // Document classification authorization
    const checkDocumentAccess = async (req: any, res: any, next: any) => {
      try {
        const document = await testDb('documents')
          .where('id', req.params.id)
          .first();

        if (!document) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Document not found' }
          });
        }

        // Check if user owns the document
        if (document.uploaded_by === req.user.id) {
          req.document = document;
          return next();
        }

        // Check classification-based access
        const userRole = req.user.role_type;
        const classification = document.classification;

        const accessMatrix = {
          'public': ['legal_team', 'government_entity', 'esop_participant', 'witness', 'media_contact'],
          'internal': ['legal_team', 'government_entity', 'esop_participant'],
          'confidential': ['legal_team', 'government_entity'],
          'secret': ['legal_team']
        };

        if (!accessMatrix[classification]?.includes(userRole)) {
          return res.status(403).json({
            success: false,
            error: { 
              code: 'ACCESS_DENIED', 
              message: `Insufficient clearance for ${classification} documents` 
            }
          });
        }

        // Check explicit permissions
        const permission = await testDb('user_permissions')
          .where('user_id', req.user.id)
          .where('resource_id', document.id)
          .where('permission_type', 'read_document')
          .where('expires_at', '>', new Date())
          .orWhereNull('expires_at')
          .first();

        if (!permission && !accessMatrix[classification]?.includes(userRole)) {
          return res.status(403).json({
            success: false,
            error: { code: 'ACCESS_DENIED', message: 'No permission to access document' }
          });
        }

        req.document = document;
        next();
      } catch (error) {
        res.status(500).json({
          success: false,
          error: { code: 'SERVER_ERROR', message: 'Access check failed' }
        });
      }
    };

    // Routes for testing different authorization scenarios
    
    // Legal team only routes
    app.get('/api/admin/users', 
      authenticateToken, 
      requireRole(['legal_team']), 
      (req, res) => {
        res.json({
          success: true,
          data: { message: 'User management access granted' }
        });
      }
    );

    app.post('/api/admin/system-settings', 
      authenticateToken, 
      requireRole(['legal_team']), 
      (req, res) => {
        res.json({
          success: true,
          data: { message: 'System settings updated' }
        });
      }
    );

    // Legal and government only routes
    app.get('/api/confidential/reports', 
      authenticateToken, 
      requireRole(['legal_team', 'government_entity']), 
      (req, res) => {
        res.json({
          success: true,
          data: { message: 'Confidential reports access granted' }
        });
      }
    );

    // Document access with classification checks
    app.get('/api/documents/:id', 
      authenticateToken, 
      checkDocumentAccess, 
      (req, res) => {
        res.json({
          success: true,
          data: req.document
        });
      }
    );

    app.put('/api/documents/:id', 
      authenticateToken, 
      checkDocumentAccess, 
      async (req, res) => {
        // Only owner can modify
        if (req.document.uploaded_by !== req.user.id) {
          return res.status(403).json({
            success: false,
            error: { code: 'ACCESS_DENIED', message: 'Only owner can modify document' }
          });
        }

        res.json({
          success: true,
          data: { message: 'Document updated successfully' }
        });
      }
    );

    // Stakeholder access based on security level
    app.get('/api/stakeholders/:id', 
      authenticateToken, 
      async (req, res) => {
        try {
          const stakeholder = await testDb('stakeholders')
            .where('id', req.params.id)
            .first();

          if (!stakeholder) {
            return res.status(404).json({
              success: false,
              error: { code: 'NOT_FOUND', message: 'Stakeholder not found' }
            });
          }

          // Check security level access
          const userRole = req.user.role_type;
          const securityLevel = stakeholder.security_level;

          const securityMatrix = {
            'standard': ['legal_team', 'government_entity', 'esop_participant'],
            'restricted': ['legal_team', 'government_entity'],
            'high': ['legal_team']
          };

          if (!securityMatrix[securityLevel]?.includes(userRole)) {
            return res.status(403).json({
              success: false,
              error: { 
                code: 'SECURITY_CLEARANCE_REQUIRED', 
                message: `Insufficient security clearance for ${securityLevel} level stakeholder` 
              }
            });
          }

          res.json({
            success: true,
            data: stakeholder
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Access check failed' }
          });
        }
      }
    );

    // Evidence chain access (restricted)
    app.get('/api/evidence/:id', 
      authenticateToken, 
      requireRole(['legal_team', 'government_entity']), 
      (req, res) => {
        res.json({
          success: true,
          data: { message: 'Evidence access granted' }
        });
      }
    );

    // PR messaging system (legal team only for sensitive operations)
    app.post('/api/pr/emergency-broadcast', 
      authenticateToken, 
      requireRole(['legal_team']), 
      (req, res) => {
        res.json({
          success: true,
          data: { message: 'Emergency broadcast authorized' }
        });
      }
    );

    // Media contact limited access
    app.get('/api/public/press-releases', 
      authenticateToken, 
      requireRole(['legal_team', 'media_contact']), 
      (req, res) => {
        res.json({
          success: true,
          data: { message: 'Press releases access granted' }
        });
      }
    );
  });

  describe('Role-Based Access Control', () => {
    it('should allow legal team access to admin functions', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${legalToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should deny non-legal team access to admin functions', async () => {
      const nonLegalUsers = [esopToken, governmentToken, witnessToken, mediaToken];

      for (const token of nonLegalUsers) {
        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      }
    });

    it('should allow legal and government access to confidential reports', async () => {
      const authorizedTokens = [legalToken, governmentToken];

      for (const token of authorizedTokens) {
        const response = await request(app)
          .get('/api/confidential/reports')
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('should deny unauthorized roles access to confidential reports', async () => {
      const unauthorizedTokens = [esopToken, witnessToken, mediaToken];

      for (const token of unauthorizedTokens) {
        const response = await request(app)
          .get('/api/confidential/reports')
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      }
    });

    it('should restrict evidence chain access to legal and government only', async () => {
      const authorizedTokens = [legalToken, governmentToken];

      for (const token of authorizedTokens) {
        const response = await request(app)
          .get('/api/evidence/evidence-123')
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('should deny evidence access to unauthorized roles', async () => {
      const unauthorizedTokens = [esopToken, witnessToken, mediaToken];

      for (const token of unauthorizedTokens) {
        const response = await request(app)
          .get('/api/evidence/evidence-123')
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      }
    });

    it('should allow media contact access to press releases', async () => {
      const authorizedTokens = [legalToken, mediaToken];

      for (const token of authorizedTokens) {
        const response = await request(app)
          .get('/api/public/press-releases')
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });
  });

  describe('Document Classification Access Control', () => {
    let publicDoc: any;
    let internalDoc: any;
    let confidentialDoc: any;
    let secretDoc: any;

    beforeEach(async () => {
      publicDoc = await createTestDocument(testDb, legalUser.id, {
        title: 'Public Document',
        classification: 'public'
      });
      internalDoc = await createTestDocument(testDb, legalUser.id, {
        title: 'Internal Document',
        classification: 'internal'
      });
      confidentialDoc = await createTestDocument(testDb, legalUser.id, {
        title: 'Confidential Document',
        classification: 'confidential'
      });
      secretDoc = await createTestDocument(testDb, legalUser.id, {
        title: 'Secret Document',
        classification: 'secret'
      });
    });

    it('should allow all roles access to public documents', async () => {
      const allTokens = [legalToken, esopToken, governmentToken, witnessToken, mediaToken];

      for (const token of allTokens) {
        const response = await request(app)
          .get(`/api/documents/${publicDoc.id}`)
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.data.classification).toBe('public');
      }
    });

    it('should restrict internal documents to appropriate roles', async () => {
      const authorizedTokens = [legalToken, esopToken, governmentToken];
      const unauthorizedTokens = [witnessToken, mediaToken];

      for (const token of authorizedTokens) {
        const response = await request(app)
          .get(`/api/documents/${internalDoc.id}`)
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.data.classification).toBe('internal');
      }

      for (const token of unauthorizedTokens) {
        const response = await request(app)
          .get(`/api/documents/${internalDoc.id}`)
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('ACCESS_DENIED');
      }
    });

    it('should restrict confidential documents to legal and government only', async () => {
      const authorizedTokens = [legalToken, governmentToken];
      const unauthorizedTokens = [esopToken, witnessToken, mediaToken];

      for (const token of authorizedTokens) {
        const response = await request(app)
          .get(`/api/documents/${confidentialDoc.id}`)
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.data.classification).toBe('confidential');
      }

      for (const token of unauthorizedTokens) {
        const response = await request(app)
          .get(`/api/documents/${confidentialDoc.id}`)
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('ACCESS_DENIED');
      }
    });

    it('should restrict secret documents to legal team only', async () => {
      const response = await request(app)
        .get(`/api/documents/${secretDoc.id}`)
        .set('Authorization', `Bearer ${legalToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.classification).toBe('secret');

      const unauthorizedTokens = [esopToken, governmentToken, witnessToken, mediaToken];

      for (const token of unauthorizedTokens) {
        const unauthorizedResponse = await request(app)
          .get(`/api/documents/${secretDoc.id}`)
          .set('Authorization', `Bearer ${token}`);

        expect(unauthorizedResponse.status).toBe(403);
        expect(unauthorizedResponse.body.error.code).toBe('ACCESS_DENIED');
      }
    });

    it('should allow document owners to access regardless of classification', async () => {
      // Create document with ESOP user
      const userDoc = await createTestDocument(testDb, esopUser.id, {
        title: 'User Secret Document',
        classification: 'secret'
      });

      const response = await request(app)
        .get(`/api/documents/${userDoc.id}`)
        .set('Authorization', `Bearer ${esopToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.uploaded_by).toBe(esopUser.id);
    });

    it('should only allow owners to modify documents', async () => {
      // Owner should be able to modify
      const ownerResponse = await request(app)
        .put(`/api/documents/${secretDoc.id}`)
        .set('Authorization', `Bearer ${legalToken}`)
        .send({ title: 'Updated Secret Document' });

      expect(ownerResponse.status).toBe(200);

      // Other users, even with read access, cannot modify
      const nonOwnerResponse = await request(app)
        .put(`/api/documents/${secretDoc.id}`)
        .set('Authorization', `Bearer ${governmentToken}`)
        .send({ title: 'Hacked Document' });

      expect(nonOwnerResponse.status).toBe(403);
      expect(nonOwnerResponse.body.error.code).toBe('ACCESS_DENIED');
    });
  });

  describe('Stakeholder Security Level Access', () => {
    let standardStakeholder: any;
    let restrictedStakeholder: any;
    let highSecurityStakeholder: any;

    beforeEach(async () => {
      standardStakeholder = await createTestStakeholder(testDb, {
        name: 'Standard Security Person',
        security_level: 'standard'
      });
      restrictedStakeholder = await createTestStakeholder(testDb, {
        name: 'Restricted Access Person',
        security_level: 'restricted'
      });
      highSecurityStakeholder = await createTestStakeholder(testDb, {
        name: 'High Security Person',
        security_level: 'high'
      });
    });

    it('should allow appropriate access to standard security stakeholders', async () => {
      const authorizedTokens = [legalToken, governmentToken, esopToken];

      for (const token of authorizedTokens) {
        const response = await request(app)
          .get(`/api/stakeholders/${standardStakeholder.id}`)
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.data.security_level).toBe('standard');
      }
    });

    it('should restrict access to restricted security stakeholders', async () => {
      const authorizedTokens = [legalToken, governmentToken];
      const unauthorizedTokens = [esopToken, witnessToken, mediaToken];

      for (const token of authorizedTokens) {
        const response = await request(app)
          .get(`/api/stakeholders/${restrictedStakeholder.id}`)
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
      }

      for (const token of unauthorizedTokens) {
        const response = await request(app)
          .get(`/api/stakeholders/${restrictedStakeholder.id}`)
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('SECURITY_CLEARANCE_REQUIRED');
      }
    });

    it('should restrict high security stakeholders to legal team only', async () => {
      const response = await request(app)
        .get(`/api/stakeholders/${highSecurityStakeholder.id}`)
        .set('Authorization', `Bearer ${legalToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.security_level).toBe('high');

      const unauthorizedTokens = [esopToken, governmentToken, witnessToken, mediaToken];

      for (const token of unauthorizedTokens) {
        const unauthorizedResponse = await request(app)
          .get(`/api/stakeholders/${highSecurityStakeholder.id}`)
          .set('Authorization', `Bearer ${token}`);

        expect(unauthorizedResponse.status).toBe(403);
        expect(unauthorizedResponse.body.error.code).toBe('SECURITY_CLEARANCE_REQUIRED');
      }
    });
  });

  describe('Emergency and Critical Functions', () => {
    it('should restrict emergency broadcast to legal team only', async () => {
      const response = await request(app)
        .post('/api/pr/emergency-broadcast')
        .set('Authorization', `Bearer ${legalToken}`)
        .send({
          message: 'Emergency situation detected',
          severity: 'critical'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should deny emergency broadcast access to non-legal roles', async () => {
      const unauthorizedTokens = [esopToken, governmentToken, witnessToken, mediaToken];

      for (const token of unauthorizedTokens) {
        const response = await request(app)
          .post('/api/pr/emergency-broadcast')
          .set('Authorization', `Bearer ${token}`)
          .send({
            message: 'Unauthorized emergency message',
            severity: 'critical'
          });

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      }
    });

    it('should restrict system settings to legal team only', async () => {
      const response = await request(app)
        .post('/api/admin/system-settings')
        .set('Authorization', `Bearer ${legalToken}`)
        .send({
          setting: 'max_file_size',
          value: '100MB'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Authorization Edge Cases', () => {
    it('should handle requests without authentication', async () => {
      const response = await request(app)
        .get('/api/admin/users');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should handle requests with invalid tokens', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should handle non-existent resources gracefully', async () => {
      const response = await request(app)
        .get('/api/documents/non-existent-doc-123')
        .set('Authorization', `Bearer ${legalToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should provide clear error messages for authorization failures', async () => {
      const response = await request(app)
        .get('/api/confidential/reports')
        .set('Authorization', `Bearer ${esopToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
      expect(response.body.error.message).toContain('legal_team, government_entity');
    });
  });

  afterEach(async () => {
    // Clean up test documents and stakeholders
    await testDb('documents').where('uploaded_by', legalUser.id).del();
    await testDb('documents').where('uploaded_by', esopUser.id).del();
    await testDb('stakeholders').where('name', 'like', '%Person').del();
    await testDb('user_permissions').whereIn('user_id', [
      legalUser.id, esopUser.id, governmentUser.id, witnessUser.id, mediaUser.id
    ]).del();
  });

  afterAll(async () => {
    // Clean up test users
    await testDb('users').whereIn('id', [
      legalUser.id, esopUser.id, governmentUser.id, witnessUser.id, mediaUser.id
    ]).del();
  });
});