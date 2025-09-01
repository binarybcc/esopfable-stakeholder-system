import request from 'supertest';
import express from 'express';
import { createTestUser, createTestDocument, expectSuccessResponse, expectErrorResponse } from '../../../setup/backend.setup';

describe('Documents API Integration Tests', () => {
  let app: express.Application;
  let testUser: any;
  let authToken: string;
  let testDb: any;

  beforeAll(async () => {
    // Setup express app with document routes
    app = express();
    app.use(express.json());
    
    // Mock document routes for testing
    app.get('/api/documents', async (req, res) => {
      try {
        const documents = await testDb('documents')
          .select('*')
          .where('uploaded_by', req.user?.id)
          .orderBy('created_at', 'desc');
          
        res.json({
          success: true,
          data: documents,
          pagination: {
            page: 1,
            limit: 20,
            total: documents.length,
            totalPages: 1
          },
          timestamp: new Date()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: { code: 'DATABASE_ERROR', message: error.message },
          timestamp: new Date()
        });
      }
    });

    app.post('/api/documents', async (req, res) => {
      try {
        const document = await createTestDocument(testDb, req.user?.id, req.body);
        res.status(201).json({
          success: true,
          data: document,
          timestamp: new Date()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: { code: 'CREATION_ERROR', message: error.message },
          timestamp: new Date()
        });
      }
    });

    app.get('/api/documents/:id', async (req, res) => {
      try {
        const document = await testDb('documents')
          .where('id', req.params.id)
          .first();
          
        if (!document) {
          return res.status(404).json({
            success: false,
            error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' },
            timestamp: new Date()
          });
        }

        // Check access permissions
        if (document.uploaded_by !== req.user?.id) {
          const hasPermission = await testDb('user_permissions')
            .where('user_id', req.user?.id)
            .where('resource_id', document.id)
            .where('permission_type', 'read_document')
            .first();
            
          if (!hasPermission) {
            return res.status(403).json({
              success: false,
              error: { code: 'ACCESS_DENIED', message: 'Insufficient permissions' },
              timestamp: new Date()
            });
          }
        }

        res.json({
          success: true,
          data: document,
          timestamp: new Date()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: { code: 'DATABASE_ERROR', message: error.message },
          timestamp: new Date()
        });
      }
    });

    app.put('/api/documents/:id', async (req, res) => {
      try {
        const document = await testDb('documents')
          .where('id', req.params.id)
          .first();
          
        if (!document) {
          return res.status(404).json({
            success: false,
            error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' },
            timestamp: new Date()
          });
        }

        // Check write permissions
        if (document.uploaded_by !== req.user?.id) {
          return res.status(403).json({
            success: false,
            error: { code: 'ACCESS_DENIED', message: 'Cannot modify document' },
            timestamp: new Date()
          });
        }

        const updatedDocument = await testDb('documents')
          .where('id', req.params.id)
          .update({
            ...req.body,
            updated_at: new Date()
          })
          .returning('*');

        res.json({
          success: true,
          data: updatedDocument[0],
          timestamp: new Date()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: { code: 'UPDATE_ERROR', message: error.message },
          timestamp: new Date()
        });
      }
    });

    app.delete('/api/documents/:id', async (req, res) => {
      try {
        const document = await testDb('documents')
          .where('id', req.params.id)
          .first();
          
        if (!document) {
          return res.status(404).json({
            success: false,
            error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' },
            timestamp: new Date()
          });
        }

        // Only owner can delete
        if (document.uploaded_by !== req.user?.id) {
          return res.status(403).json({
            success: false,
            error: { code: 'ACCESS_DENIED', message: 'Cannot delete document' },
            timestamp: new Date()
          });
        }

        await testDb('documents')
          .where('id', req.params.id)
          .update({ status: 'deleted', updated_at: new Date() });

        res.json({
          success: true,
          data: { message: 'Document deleted successfully' },
          timestamp: new Date()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: { code: 'DELETE_ERROR', message: error.message },
          timestamp: new Date()
        });
      }
    });

    // Mock authentication middleware
    app.use((req, res, next) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token === authToken) {
        req.user = testUser;
      }
      next();
    });

    testDb = global.testDatabase;
    testUser = await createTestUser(testDb);
    authToken = global.backendTestHelpers.generateTestJWT(testUser);
  });

  describe('GET /api/documents', () => {
    beforeEach(async () => {
      // Clean up documents table
      await testDb('documents').where('uploaded_by', testUser.id).del();
    });

    it('should return empty list when no documents exist', async () => {
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response, 200);
      expect(response.body.data).toEqual([]);
      expect(response.body.pagination.total).toBe(0);
    });

    it('should return user documents with correct pagination', async () => {
      // Create test documents
      const doc1 = await createTestDocument(testDb, testUser.id, { title: 'Document 1' });
      const doc2 = await createTestDocument(testDb, testUser.id, { title: 'Document 2' });

      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response, 200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.total).toBe(2);
      
      const titles = response.body.data.map((doc: any) => doc.title);
      expect(titles).toContain('Document 1');
      expect(titles).toContain('Document 2');
    });

    it('should only return documents owned by authenticated user', async () => {
      // Create document for test user
      await createTestDocument(testDb, testUser.id, { title: 'User Document' });
      
      // Create document for different user
      const otherUser = await createTestUser(testDb);
      await createTestDocument(testDb, otherUser.id, { title: 'Other User Document' });

      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response, 200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe('User Document');
    });

    it('should handle query parameters for filtering', async () => {
      await createTestDocument(testDb, testUser.id, { 
        title: 'Legal Brief', 
        classification: 'confidential',
        category: 'legal'
      });
      await createTestDocument(testDb, testUser.id, { 
        title: 'Public Memo', 
        classification: 'public',
        category: 'memo'
      });

      const response = await request(app)
        .get('/api/documents?classification=confidential')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response, 200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].classification).toBe('confidential');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/documents');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/documents', () => {
    const validDocumentData = {
      title: 'New Test Document',
      description: 'A test document for API testing',
      classification: 'internal',
      category: 'test',
      tags: ['test', 'api'],
      mimeType: 'application/pdf',
      fileSize: 2048
    };

    it('should create document with valid data', async () => {
      const response = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validDocumentData);

      expectSuccessResponse(response, 201);
      expect(response.body.data).toMatchObject({
        title: validDocumentData.title,
        description: validDocumentData.description,
        classification: validDocumentData.classification,
        uploaded_by: testUser.id
      });
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.created_at).toBeDefined();
    });

    it('should validate required fields', async () => {
      const invalidData = { ...validDocumentData };
      delete invalidData.title;

      const response = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData);

      expectErrorResponse(response, 400, 'VALIDATION_ERROR');
    });

    it('should validate classification levels', async () => {
      const invalidData = {
        ...validDocumentData,
        classification: 'invalid_classification'
      };

      const response = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData);

      expectErrorResponse(response, 400, 'VALIDATION_ERROR');
    });

    it('should set default values correctly', async () => {
      const minimalData = {
        title: 'Minimal Document',
        mimeType: 'text/plain',
        fileSize: 100
      };

      const response = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${authToken}`)
        .send(minimalData);

      expectSuccessResponse(response, 201);
      expect(response.body.data.classification).toBe('internal'); // default
      expect(response.body.data.status).toBe('uploading'); // default
      expect(response.body.data.version_number).toBe(1);
    });

    it('should generate unique document ID', async () => {
      const response1 = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...validDocumentData, title: 'Document 1' });

      const response2 = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...validDocumentData, title: 'Document 2' });

      expectSuccessResponse(response1, 201);
      expectSuccessResponse(response2, 201);
      expect(response1.body.data.id).not.toBe(response2.body.data.id);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/documents')
        .send(validDocumentData);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/documents/:id', () => {
    let testDocument: any;

    beforeEach(async () => {
      testDocument = await createTestDocument(testDb, testUser.id);
    });

    it('should return document by ID for owner', async () => {
      const response = await request(app)
        .get(`/api/documents/${testDocument.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response, 200);
      expect(response.body.data).toMatchObject({
        id: testDocument.id,
        title: testDocument.title,
        uploaded_by: testUser.id
      });
    });

    it('should return 404 for non-existent document', async () => {
      const fakeId = 'non-existent-doc-123';
      const response = await request(app)
        .get(`/api/documents/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response, 404, 'DOCUMENT_NOT_FOUND');
    });

    it('should deny access to other users documents without permission', async () => {
      const otherUser = await createTestUser(testDb);
      const otherUserToken = global.backendTestHelpers.generateTestJWT(otherUser);

      const response = await request(app)
        .get(`/api/documents/${testDocument.id}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expectErrorResponse(response, 403, 'ACCESS_DENIED');
    });

    it('should allow access with explicit read permission', async () => {
      const otherUser = await createTestUser(testDb);
      const otherUserToken = global.backendTestHelpers.generateTestJWT(otherUser);

      // Grant read permission
      await testDb('user_permissions').insert({
        id: 'perm-123',
        user_id: otherUser.id,
        permission_type: 'read_document',
        resource_id: testDocument.id,
        granted_by: testUser.id,
        granted_at: new Date()
      });

      const response = await request(app)
        .get(`/api/documents/${testDocument.id}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expectSuccessResponse(response, 200);
      expect(response.body.data.id).toBe(testDocument.id);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/documents/${testDocument.id}`);

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/documents/:id', () => {
    let testDocument: any;

    beforeEach(async () => {
      testDocument = await createTestDocument(testDb, testUser.id);
    });

    it('should update document successfully for owner', async () => {
      const updateData = {
        title: 'Updated Document Title',
        description: 'Updated description',
        tags: ['updated', 'test']
      };

      const response = await request(app)
        .put(`/api/documents/${testDocument.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expectSuccessResponse(response, 200);
      expect(response.body.data).toMatchObject(updateData);
      expect(response.body.data.updated_at).toBeDefined();
    });

    it('should return 404 for non-existent document', async () => {
      const response = await request(app)
        .put('/api/documents/non-existent-123')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Updated Title' });

      expectErrorResponse(response, 404, 'DOCUMENT_NOT_FOUND');
    });

    it('should deny updates from non-owners', async () => {
      const otherUser = await createTestUser(testDb);
      const otherUserToken = global.backendTestHelpers.generateTestJWT(otherUser);

      const response = await request(app)
        .put(`/api/documents/${testDocument.id}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ title: 'Hacked Title' });

      expectErrorResponse(response, 403, 'ACCESS_DENIED');
    });

    it('should validate update data', async () => {
      const invalidData = {
        classification: 'invalid_level',
        fileSize: -1
      };

      const response = await request(app)
        .put(`/api/documents/${testDocument.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData);

      expectErrorResponse(response, 400, 'VALIDATION_ERROR');
    });

    it('should preserve unchanged fields', async () => {
      const originalTitle = testDocument.title;
      const updateData = { description: 'Only description changed' };

      const response = await request(app)
        .put(`/api/documents/${testDocument.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expectSuccessResponse(response, 200);
      expect(response.body.data.title).toBe(originalTitle);
      expect(response.body.data.description).toBe(updateData.description);
    });
  });

  describe('DELETE /api/documents/:id', () => {
    let testDocument: any;

    beforeEach(async () => {
      testDocument = await createTestDocument(testDb, testUser.id);
    });

    it('should delete document successfully for owner', async () => {
      const response = await request(app)
        .delete(`/api/documents/${testDocument.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response, 200);
      expect(response.body.data.message).toContain('deleted successfully');

      // Verify document is marked as deleted
      const deletedDoc = await testDb('documents')
        .where('id', testDocument.id)
        .first();
      expect(deletedDoc.status).toBe('deleted');
    });

    it('should return 404 for non-existent document', async () => {
      const response = await request(app)
        .delete('/api/documents/non-existent-123')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response, 404, 'DOCUMENT_NOT_FOUND');
    });

    it('should deny deletion by non-owners', async () => {
      const otherUser = await createTestUser(testDb);
      const otherUserToken = global.backendTestHelpers.generateTestJWT(otherUser);

      const response = await request(app)
        .delete(`/api/documents/${testDocument.id}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expectErrorResponse(response, 403, 'ACCESS_DENIED');
    });

    it('should prevent deletion of already deleted documents', async () => {
      // First deletion
      await request(app)
        .delete(`/api/documents/${testDocument.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Second deletion attempt
      const response = await request(app)
        .delete(`/api/documents/${testDocument.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response, 404, 'DOCUMENT_NOT_FOUND');
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Mock database error
      const originalSelect = testDb.select;
      testDb.select = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response, 500, 'DATABASE_ERROR');
      expect(response.body.error.message).toContain('Database connection failed');

      // Restore original method
      testDb.select = originalSelect;
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });

    it('should handle large request payloads appropriately', async () => {
      const largeData = {
        title: 'A'.repeat(10000), // Very long title
        description: 'B'.repeat(100000), // Very long description
        classification: 'internal'
      };

      const response = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${authToken}`)
        .send(largeData);

      // Should either succeed or fail with appropriate validation error
      expect([200, 201, 400, 413]).toContain(response.status);
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple concurrent requests', async () => {
      const concurrentRequests = 50;
      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        request(app)
          .post('/api/documents')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: `Concurrent Document ${i}`,
            classification: 'internal',
            mimeType: 'text/plain',
            fileSize: 100
          })
      );

      const responses = await Promise.all(promises);
      
      // All requests should succeed
      responses.forEach((response, i) => {
        expectSuccessResponse(response, 201);
        expect(response.body.data.title).toBe(`Concurrent Document ${i}`);
      });

      // Verify all documents were created
      const documentsInDb = await testDb('documents')
        .where('uploaded_by', testUser.id)
        .where('title', 'like', 'Concurrent Document %');
      
      expect(documentsInDb).toHaveLength(concurrentRequests);
    });

    it('should respond within acceptable time limits', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${authToken}`);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expectSuccessResponse(response, 200);
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });
  });

  afterEach(async () => {
    // Clean up test data
    await testDb('user_permissions').where('user_id', testUser.id).del();
    await testDb('documents').where('uploaded_by', testUser.id).del();
  });

  afterAll(async () => {
    await testDb('users').where('id', testUser.id).del();
  });
});