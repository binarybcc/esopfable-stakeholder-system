import { AccessControlService } from '../../../../src/document-management/services/AccessControlService';
import { User, Document, UserPermission } from '../../../../backend/src/types';

describe('AccessControlService', () => {
  let accessControlService: AccessControlService;
  let mockDatabase: any;
  let mockRedis: any;

  const testUser: User = {
    id: 'test-user-1',
    auth0Id: 'auth0|test-user-1',
    email: 'test@example.com',
    roleType: 'legal_team',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const testDocument: Document = {
    id: 'test-doc-1',
    title: 'Test Document',
    description: 'Test document for access control',
    filePath: '/tmp/test-doc.pdf',
    fileHash: 'sha256:abcd1234',
    fileSize: 1024,
    mimeType: 'application/pdf',
    classification: 'confidential',
    uploadedBy: 'test-user-1',
    versionNumber: 1,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    mockDatabase = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      join: jest.fn().mockReturnThis(),
      first: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      transaction: jest.fn((callback) => callback(mockDatabase))
    };

    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      sadd: jest.fn(),
      srem: jest.fn(),
      smembers: jest.fn()
    };

    accessControlService = new AccessControlService(mockDatabase, mockRedis);
  });

  describe('hasPermission', () => {
    beforeEach(() => {
      mockDatabase.first.mockResolvedValue({
        permission_type: 'read_document',
        resource_id: testDocument.id,
        granted_at: new Date(),
        expires_at: null
      });
    });

    it('should return true when user has direct permission', async () => {
      const hasPermission = await accessControlService.hasPermission(
        testUser.id,
        'read_document',
        testDocument.id
      );

      expect(hasPermission).toBe(true);
      expect(mockDatabase.where).toHaveBeenCalledWith('user_id', testUser.id);
      expect(mockDatabase.where).toHaveBeenCalledWith('permission_type', 'read_document');
      expect(mockDatabase.where).toHaveBeenCalledWith('resource_id', testDocument.id);
    });

    it('should return false when user has no permission', async () => {
      mockDatabase.first.mockResolvedValue(null);

      const hasPermission = await accessControlService.hasPermission(
        testUser.id,
        'write_document',
        testDocument.id
      );

      expect(hasPermission).toBe(false);
    });

    it('should return false when permission is expired', async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1); // Yesterday

      mockDatabase.first.mockResolvedValue({
        permission_type: 'read_document',
        resource_id: testDocument.id,
        granted_at: new Date(),
        expires_at: expiredDate
      });

      const hasPermission = await accessControlService.hasPermission(
        testUser.id,
        'read_document',
        testDocument.id
      );

      expect(hasPermission).toBe(false);
    });

    it('should check role-based permissions when no direct permission exists', async () => {
      mockDatabase.first
        .mockResolvedValueOnce(null) // No direct permission
        .mockResolvedValueOnce({     // Role-based permission
          permission_type: 'read_document',
          role_type: 'legal_team'
        });

      const hasPermission = await accessControlService.hasPermission(
        testUser.id,
        'read_document',
        testDocument.id
      );

      expect(hasPermission).toBe(true);
    });

    it('should use cached permissions when available', async () => {
      const cachedPermissions = JSON.stringify([{
        permission_type: 'read_document',
        resource_id: testDocument.id
      }]);
      
      mockRedis.get.mockResolvedValue(cachedPermissions);

      const hasPermission = await accessControlService.hasPermission(
        testUser.id,
        'read_document',
        testDocument.id
      );

      expect(hasPermission).toBe(true);
      expect(mockDatabase.first).not.toHaveBeenCalled();
    });
  });

  describe('grantPermission', () => {
    const granterUserId = 'granter-user-1';
    const permission: UserPermission = {
      id: 'perm-1',
      userId: testUser.id,
      permissionType: 'read_document',
      resourceId: testDocument.id,
      grantedAt: new Date(),
      grantedBy: granterUserId
    };

    it('should grant permission successfully', async () => {
      mockDatabase.insert.mockResolvedValue([permission]);

      const result = await accessControlService.grantPermission(
        testUser.id,
        'read_document',
        testDocument.id,
        granterUserId
      );

      expect(result).toBeTruthy();
      expect(mockDatabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: testUser.id,
          permission_type: 'read_document',
          resource_id: testDocument.id,
          granted_by: granterUserId
        })
      );
    });

    it('should invalidate cached permissions after granting', async () => {
      mockDatabase.insert.mockResolvedValue([permission]);

      await accessControlService.grantPermission(
        testUser.id,
        'read_document',
        testDocument.id,
        granterUserId
      );

      expect(mockRedis.del).toHaveBeenCalledWith(`permissions:${testUser.id}`);
    });

    it('should set expiration date when provided', async () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days from now

      mockDatabase.insert.mockResolvedValue([permission]);

      await accessControlService.grantPermission(
        testUser.id,
        'read_document',
        testDocument.id,
        granterUserId,
        expiresAt
      );

      expect(mockDatabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          expires_at: expiresAt
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      mockDatabase.insert.mockRejectedValue(new Error('Database error'));

      await expect(accessControlService.grantPermission(
        testUser.id,
        'read_document',
        testDocument.id,
        granterUserId
      )).rejects.toThrow('Failed to grant permission');
    });

    it('should validate permission type', async () => {
      await expect(accessControlService.grantPermission(
        testUser.id,
        'invalid_permission',
        testDocument.id,
        granterUserId
      )).rejects.toThrow('Invalid permission type');
    });
  });

  describe('revokePermission', () => {
    it('should revoke permission successfully', async () => {
      mockDatabase.delete.mockResolvedValue(1);

      const result = await accessControlService.revokePermission(
        testUser.id,
        'read_document',
        testDocument.id
      );

      expect(result).toBe(true);
      expect(mockDatabase.where).toHaveBeenCalledWith('user_id', testUser.id);
      expect(mockDatabase.where).toHaveBeenCalledWith('permission_type', 'read_document');
      expect(mockDatabase.where).toHaveBeenCalledWith('resource_id', testDocument.id);
    });

    it('should return false when no permission to revoke', async () => {
      mockDatabase.delete.mockResolvedValue(0);

      const result = await accessControlService.revokePermission(
        testUser.id,
        'read_document',
        testDocument.id
      );

      expect(result).toBe(false);
    });

    it('should invalidate cached permissions after revoking', async () => {
      mockDatabase.delete.mockResolvedValue(1);

      await accessControlService.revokePermission(
        testUser.id,
        'read_document',
        testDocument.id
      );

      expect(mockRedis.del).toHaveBeenCalledWith(`permissions:${testUser.id}`);
    });
  });

  describe('checkDocumentAccess', () => {
    it('should allow access to own documents', async () => {
      const ownDocument = { ...testDocument, uploadedBy: testUser.id };

      const hasAccess = await accessControlService.checkDocumentAccess(
        testUser,
        ownDocument,
        'read'
      );

      expect(hasAccess).toBe(true);
    });

    it('should check classification-based access', async () => {
      const publicDocument = { ...testDocument, classification: 'public' };
      
      const hasAccess = await accessControlService.checkDocumentAccess(
        testUser,
        publicDocument,
        'read'
      );

      expect(hasAccess).toBe(true);
    });

    it('should deny access to higher classification without permission', async () => {
      const secretDocument = { ...testDocument, classification: 'secret' };
      mockDatabase.first.mockResolvedValue(null); // No permission

      const hasAccess = await accessControlService.checkDocumentAccess(
        { ...testUser, roleType: 'esop_participant' },
        secretDocument,
        'read'
      );

      expect(hasAccess).toBe(false);
    });

    it('should check role-based access for legal team', async () => {
      const hasAccess = await accessControlService.checkDocumentAccess(
        { ...testUser, roleType: 'legal_team' },
        testDocument,
        'read'
      );

      // Legal team should have broad access
      expect(hasAccess).toBe(true);
    });

    it('should enforce write restrictions', async () => {
      mockDatabase.first.mockResolvedValue(null); // No explicit write permission

      const hasAccess = await accessControlService.checkDocumentAccess(
        { ...testUser, roleType: 'witness' },
        testDocument,
        'write'
      );

      expect(hasAccess).toBe(false);
    });

    it('should handle delete permissions strictly', async () => {
      mockDatabase.first.mockResolvedValue(null);

      const hasAccess = await accessControlService.checkDocumentAccess(
        testUser,
        testDocument,
        'delete'
      );

      // Only owner or users with explicit delete permission should delete
      expect(hasAccess).toBe(testDocument.uploadedBy === testUser.id);
    });
  });

  describe('getUserPermissions', () => {
    const mockPermissions = [
      {
        id: 'perm-1',
        permission_type: 'read_document',
        resource_id: 'doc-1',
        granted_at: new Date(),
        expires_at: null
      },
      {
        id: 'perm-2',
        permission_type: 'write_document',
        resource_id: 'doc-2',
        granted_at: new Date(),
        expires_at: new Date(Date.now() + 86400000) // Tomorrow
      }
    ];

    it('should return user permissions', async () => {
      mockDatabase.select.mockResolvedValue(mockPermissions);

      const permissions = await accessControlService.getUserPermissions(testUser.id);

      expect(permissions).toHaveLength(2);
      expect(permissions[0]).toMatchObject({
        permissionType: 'read_document',
        resourceId: 'doc-1'
      });
    });

    it('should filter out expired permissions', async () => {
      const expiredPermission = {
        id: 'perm-3',
        permission_type: 'read_document',
        resource_id: 'doc-3',
        granted_at: new Date(),
        expires_at: new Date(Date.now() - 86400000) // Yesterday
      };

      mockDatabase.select.mockResolvedValue([...mockPermissions, expiredPermission]);

      const permissions = await accessControlService.getUserPermissions(testUser.id);

      expect(permissions).toHaveLength(2); // Should exclude expired permission
      expect(permissions.find(p => p.resourceId === 'doc-3')).toBeUndefined();
    });

    it('should cache permissions after retrieval', async () => {
      mockDatabase.select.mockResolvedValue(mockPermissions);

      await accessControlService.getUserPermissions(testUser.id);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `permissions:${testUser.id}`,
        3600, // 1 hour cache
        expect.any(String)
      );
    });
  });

  describe('validateResourceAccess', () => {
    it('should validate document resource access', async () => {
      mockDatabase.first.mockResolvedValue(testDocument);

      const isValid = await accessControlService.validateResourceAccess(
        'document',
        testDocument.id,
        testUser.id
      );

      expect(isValid).toBe(true);
      expect(mockDatabase.where).toHaveBeenCalledWith('id', testDocument.id);
    });

    it('should reject access to non-existent resources', async () => {
      mockDatabase.first.mockResolvedValue(null);

      const isValid = await accessControlService.validateResourceAccess(
        'document',
        'non-existent-id',
        testUser.id
      );

      expect(isValid).toBe(false);
    });

    it('should validate stakeholder resource access', async () => {
      const testStakeholder = {
        id: 'stakeholder-1',
        user_id: testUser.id,
        name: 'Test Stakeholder',
        security_level: 'standard'
      };

      mockDatabase.first.mockResolvedValue(testStakeholder);

      const isValid = await accessControlService.validateResourceAccess(
        'stakeholder',
        testStakeholder.id,
        testUser.id
      );

      expect(isValid).toBe(true);
    });

    it('should enforce security level restrictions', async () => {
      const highSecurityStakeholder = {
        id: 'stakeholder-2',
        user_id: 'other-user',
        name: 'High Security Stakeholder',
        security_level: 'high'
      };

      mockDatabase.first.mockResolvedValue(highSecurityStakeholder);

      const isValid = await accessControlService.validateResourceAccess(
        'stakeholder',
        highSecurityStakeholder.id,
        testUser.id
      );

      // Should check if user has permission to access high security stakeholders
      expect(mockDatabase.where).toHaveBeenCalledWith('user_id', testUser.id);
    });
  });

  describe('logAccessAttempt', () => {
    it('should log successful access attempts', async () => {
      mockDatabase.insert.mockResolvedValue([{ id: 'log-1' }]);

      await accessControlService.logAccessAttempt(
        testUser.id,
        'document',
        testDocument.id,
        'read',
        true,
        '192.168.1.1'
      );

      expect(mockDatabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: testUser.id,
          resource_type: 'document',
          resource_id: testDocument.id,
          action: 'read',
          success: true,
          ip_address: '192.168.1.1'
        })
      );
    });

    it('should log failed access attempts with additional details', async () => {
      mockDatabase.insert.mockResolvedValue([{ id: 'log-2' }]);

      await accessControlService.logAccessAttempt(
        testUser.id,
        'document',
        testDocument.id,
        'write',
        false,
        '192.168.1.1',
        'Insufficient permissions'
      );

      expect(mockDatabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          failure_reason: 'Insufficient permissions'
        })
      );
    });

    it('should handle logging errors gracefully', async () => {
      mockDatabase.insert.mockRejectedValue(new Error('Logging failed'));

      // Should not throw error
      await expect(accessControlService.logAccessAttempt(
        testUser.id,
        'document',
        testDocument.id,
        'read',
        true,
        '192.168.1.1'
      )).resolves.not.toThrow();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle Redis connection failures gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));
      mockDatabase.first.mockResolvedValue({
        permission_type: 'read_document',
        resource_id: testDocument.id
      });

      // Should fallback to database when Redis fails
      const hasPermission = await accessControlService.hasPermission(
        testUser.id,
        'read_document',
        testDocument.id
      );

      expect(hasPermission).toBe(true);
      expect(mockDatabase.first).toHaveBeenCalled();
    });

    it('should validate input parameters', async () => {
      await expect(accessControlService.hasPermission(
        null,
        'read_document',
        testDocument.id
      )).rejects.toThrow('User ID is required');

      await expect(accessControlService.hasPermission(
        testUser.id,
        '',
        testDocument.id
      )).rejects.toThrow('Permission type is required');

      await expect(accessControlService.hasPermission(
        testUser.id,
        'read_document',
        ''
      )).rejects.toThrow('Resource ID is required');
    });

    it('should handle database transaction failures', async () => {
      mockDatabase.transaction.mockImplementation(() => {
        throw new Error('Transaction failed');
      });

      await expect(accessControlService.grantPermission(
        testUser.id,
        'read_document',
        testDocument.id,
        'granter-1'
      )).rejects.toThrow('Failed to grant permission');
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple permission checks efficiently', async () => {
      mockDatabase.first.mockResolvedValue({
        permission_type: 'read_document',
        resource_id: testDocument.id
      });

      const startTime = Date.now();
      
      // Check 100 permissions in parallel
      const promises = Array.from({ length: 100 }, (_, i) =>
        accessControlService.hasPermission(
          testUser.id,
          'read_document',
          `document-${i}`
        )
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(results).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should benefit from caching on repeated permission checks', async () => {
      // First call - should hit database
      mockDatabase.first.mockResolvedValue({
        permission_type: 'read_document',
        resource_id: testDocument.id
      });

      await accessControlService.hasPermission(
        testUser.id,
        'read_document',
        testDocument.id
      );

      // Setup cache hit
      mockRedis.get.mockResolvedValue(JSON.stringify([{
        permission_type: 'read_document',
        resource_id: testDocument.id
      }]));

      // Second call - should hit cache
      const startTime = Date.now();
      await accessControlService.hasPermission(
        testUser.id,
        'read_document',
        testDocument.id
      );
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(10); // Should be very fast with cache
    });
  });
});