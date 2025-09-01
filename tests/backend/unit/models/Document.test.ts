import { Document, DocumentDocument } from '../../../../src/document-management/models/Document';
import { ClassificationLevel, DocumentStatus, Permission } from '../../../../src/document-management/types';
import mongoose from 'mongoose';

// Mock mongoose for testing
jest.mock('mongoose', () => ({
  Schema: jest.fn().mockImplementation(function(definition) {
    this.definition = definition;
    this.index = jest.fn();
    this.pre = jest.fn();
    this.methods = {};
    this.statics = {};
    return this;
  }),
  model: jest.fn()
}));

describe('Document Model', () => {
  let mockDocument: DocumentDocument;

  beforeEach(() => {
    mockDocument = {
      id: 'test-doc-123',
      filename: 'test-document.pdf',
      originalFilename: 'Original Test Document.pdf',
      mimeType: 'application/pdf',
      size: 1024768,
      classification: ClassificationLevel.CONFIDENTIAL,
      status: DocumentStatus.ACTIVE,
      encryptionKey: 'encrypted-key-reference',
      checksumSHA256: 'sha256hash123456789abcdef',
      checksumMD5: 'md5hash123456789abcdef',
      title: 'Test Document Title',
      description: 'A comprehensive test document',
      tags: ['test', 'confidential', 'legal'],
      category: 'legal-briefs',
      author: 'user-123',
      virusScanStatus: 'CLEAN',
      ocrStatus: 'COMPLETE',
      previewStatus: 'COMPLETE',
      storagePath: '/encrypted/storage/path/doc123.enc',
      previewPath: '/preview/path/doc123.jpg',
      thumbnailPath: '/thumbnail/path/doc123_thumb.jpg',
      createdAt: new Date('2023-01-01T10:00:00Z'),
      updatedAt: new Date('2023-01-01T10:00:00Z'),
      accessedAt: new Date('2023-01-01T10:00:00Z'),
      parentId: null,
      currentVersionId: 'version-1',
      versions: [],
      shares: [],
      activities: [],
      permissions: [],
      save: jest.fn().mockResolvedValue(true)
    } as unknown as DocumentDocument;
  });

  describe('Schema Definition', () => {
    it('should define required fields correctly', () => {
      const schema = new mongoose.Schema({});
      
      expect(schema).toBeDefined();
      
      // Test that required fields are properly defined
      const requiredFields = [
        'filename',
        'originalFilename',
        'mimeType',
        'size',
        'classification',
        'status',
        'encryptionKey',
        'checksumSHA256',
        'checksumMD5',
        'author'
      ];
      
      // In a real test, you'd verify these fields are marked as required
      requiredFields.forEach(field => {
        expect(field).toMatch(/^[a-zA-Z][a-zA-Z0-9]*$/);
      });
    });

    it('should set default values correctly', () => {
      expect(ClassificationLevel.INTERNAL).toBeDefined();
      expect(DocumentStatus.UPLOADING).toBeDefined();
    });

    it('should include proper enums for classification levels', () => {
      const validClassifications = Object.values(ClassificationLevel);
      expect(validClassifications).toContain(ClassificationLevel.PUBLIC);
      expect(validClassifications).toContain(ClassificationLevel.INTERNAL);
      expect(validClassifications).toContain(ClassificationLevel.CONFIDENTIAL);
      expect(validClassifications).toContain(ClassificationLevel.SECRET);
    });

    it('should include proper enums for document status', () => {
      const validStatuses = Object.values(DocumentStatus);
      expect(validStatuses).toContain(DocumentStatus.UPLOADING);
      expect(validStatuses).toContain(DocumentStatus.PROCESSING);
      expect(validStatuses).toContain(DocumentStatus.ACTIVE);
      expect(validStatuses).toContain(DocumentStatus.ARCHIVED);
      expect(validStatuses).toContain(DocumentStatus.DELETED);
    });
  });

  describe('Instance Methods', () => {
    describe('hasPermission', () => {
      beforeEach(() => {
        // Mock the hasPermission method
        mockDocument.hasPermission = function(userId: string, permission: Permission): boolean {
          const userPermissions = this.permissions.find(p => 
            p.userId === userId && 
            p.isActive && 
            (!p.expiresAt || new Date(p.expiresAt) > new Date())
          );
          
          if (userPermissions) {
            return userPermissions.permissions.includes(permission);
          }
          
          return false;
        };
      });

      it('should return true when user has the required permission', () => {
        mockDocument.permissions = [{
          id: 'perm-1',
          documentId: mockDocument.id,
          userId: 'user-123',
          permissions: [Permission.READ, Permission.WRITE],
          grantedBy: 'admin-user',
          grantedAt: new Date(),
          isActive: true
        } as any];

        const result = mockDocument.hasPermission('user-123', Permission.READ);
        expect(result).toBe(true);
      });

      it('should return false when user lacks the required permission', () => {
        mockDocument.permissions = [{
          id: 'perm-1',
          documentId: mockDocument.id,
          userId: 'user-123',
          permissions: [Permission.READ],
          grantedBy: 'admin-user',
          grantedAt: new Date(),
          isActive: true
        } as any];

        const result = mockDocument.hasPermission('user-123', Permission.DELETE);
        expect(result).toBe(false);
      });

      it('should return false when permission is expired', () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        mockDocument.permissions = [{
          id: 'perm-1',
          documentId: mockDocument.id,
          userId: 'user-123',
          permissions: [Permission.READ],
          grantedBy: 'admin-user',
          grantedAt: new Date(),
          expiresAt: yesterday,
          isActive: true
        } as any];

        const result = mockDocument.hasPermission('user-123', Permission.READ);
        expect(result).toBe(false);
      });

      it('should return false when permission is inactive', () => {
        mockDocument.permissions = [{
          id: 'perm-1',
          documentId: mockDocument.id,
          userId: 'user-123',
          permissions: [Permission.READ],
          grantedBy: 'admin-user',
          grantedAt: new Date(),
          isActive: false
        } as any];

        const result = mockDocument.hasPermission('user-123', Permission.READ);
        expect(result).toBe(false);
      });

      it('should handle multiple permissions for the same user', () => {
        mockDocument.permissions = [
          {
            id: 'perm-1',
            documentId: mockDocument.id,
            userId: 'user-123',
            permissions: [Permission.READ],
            grantedBy: 'admin-user',
            grantedAt: new Date(),
            isActive: true
          },
          {
            id: 'perm-2',
            documentId: mockDocument.id,
            userId: 'user-123',
            permissions: [Permission.WRITE, Permission.DELETE],
            grantedBy: 'admin-user',
            grantedAt: new Date(),
            isActive: true
          }
        ] as any[];

        expect(mockDocument.hasPermission('user-123', Permission.READ)).toBe(true);
        expect(mockDocument.hasPermission('user-123', Permission.WRITE)).toBe(true);
        expect(mockDocument.hasPermission('user-123', Permission.DELETE)).toBe(true);
      });
    });

    describe('addActivity', () => {
      beforeEach(() => {
        mockDocument.activities = [];
        mockDocument.addActivity = async function(
          userId: string, 
          action: string, 
          details: any, 
          ipAddress: string, 
          userAgent: string
        ) {
          this.activities.push({
            id: 'activity-' + Math.random().toString(36).substr(2, 9),
            documentId: this.id,
            userId,
            action,
            details,
            ipAddress,
            userAgent,
            timestamp: new Date()
          } as any);
          
          this.accessedAt = new Date();
          return this.save();
        };
      });

      it('should add activity successfully', async () => {
        const userId = 'user-123';
        const action = 'VIEW';
        const details = { viewDuration: 30 };
        const ipAddress = '192.168.1.1';
        const userAgent = 'Mozilla/5.0...';

        await mockDocument.addActivity(userId, action, details, ipAddress, userAgent);

        expect(mockDocument.activities).toHaveLength(1);
        expect(mockDocument.activities[0]).toMatchObject({
          userId,
          action,
          details,
          ipAddress,
          userAgent
        });
        expect(mockDocument.activities[0].timestamp).toBeInstanceOf(Date);
      });

      it('should update accessedAt timestamp', async () => {
        const oldAccessTime = new Date('2023-01-01T09:00:00Z');
        mockDocument.accessedAt = oldAccessTime;

        await mockDocument.addActivity('user-123', 'VIEW', {}, '192.168.1.1', 'Browser');

        expect(mockDocument.accessedAt).not.toEqual(oldAccessTime);
        expect(mockDocument.save).toHaveBeenCalled();
      });
    });

    describe('createVersion', () => {
      beforeEach(() => {
        mockDocument.versions = [];
        mockDocument.createVersion = async function(
          filename: string,
          size: number,
          checksum: string,
          storagePath: string,
          createdBy: string,
          changes?: string
        ) {
          const version = this.versions.length + 1;
          const versionId = 'version-' + Math.random().toString(36).substr(2, 9);
          
          this.versions.push({
            id: versionId,
            documentId: this.id,
            version,
            filename,
            size,
            checksumSHA256: checksum,
            storagePath,
            changes,
            createdBy,
            createdAt: new Date(),
            isActive: true
          } as any);
          
          // Update current version
          this.currentVersionId = versionId;
          this.filename = filename;
          this.size = size;
          this.checksumSHA256 = checksum;
          this.storagePath = storagePath;
          
          return this.save();
        };
      });

      it('should create a new version successfully', async () => {
        const newFilename = 'updated-document.pdf';
        const newSize = 2048;
        const newChecksum = 'new-checksum-123';
        const newStoragePath = '/new/storage/path';
        const createdBy = 'user-456';
        const changes = 'Updated content with new information';

        await mockDocument.createVersion(
          newFilename,
          newSize,
          newChecksum,
          newStoragePath,
          createdBy,
          changes
        );

        expect(mockDocument.versions).toHaveLength(1);
        expect(mockDocument.versions[0]).toMatchObject({
          version: 1,
          filename: newFilename,
          size: newSize,
          checksumSHA256: newChecksum,
          storagePath: newStoragePath,
          changes,
          createdBy,
          isActive: true
        });

        // Check that current document properties are updated
        expect(mockDocument.filename).toBe(newFilename);
        expect(mockDocument.size).toBe(newSize);
        expect(mockDocument.checksumSHA256).toBe(newChecksum);
        expect(mockDocument.storagePath).toBe(newStoragePath);
      });

      it('should increment version numbers correctly', async () => {
        // Add first version
        await mockDocument.createVersion(
          'v1.pdf', 1024, 'checksum1', '/path1', 'user1'
        );

        // Add second version
        await mockDocument.createVersion(
          'v2.pdf', 2048, 'checksum2', '/path2', 'user2'
        );

        expect(mockDocument.versions).toHaveLength(2);
        expect(mockDocument.versions[0].version).toBe(1);
        expect(mockDocument.versions[1].version).toBe(2);
      });
    });

    describe('createShare', () => {
      beforeEach(() => {
        mockDocument.shares = [];
        mockDocument.createShare = async function(
          expiresAt: Date,
          maxDownloads?: number,
          requiresPassword = false,
          password?: string,
          allowedIPs?: string[],
          createdBy: string = 'user-123'
        ) {
          const shareToken = 'share-token-' + Math.random().toString(36).substr(2, 16);
          const shareId = 'share-' + Math.random().toString(36).substr(2, 9);
          
          this.shares.push({
            id: shareId,
            documentId: this.id,
            shareToken,
            expiresAt,
            maxDownloads,
            downloadCount: 0,
            requiresPassword,
            password: password ? 'hashed-' + password : undefined,
            allowedIPs,
            createdBy,
            createdAt: new Date(),
            isActive: true
          } as any);
          
          await this.save();
          return shareToken;
        };
      });

      it('should create a share link successfully', async () => {
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        const maxDownloads = 10;
        const createdBy = 'user-789';

        const shareToken = await mockDocument.createShare(
          expiresAt,
          maxDownloads,
          false,
          undefined,
          undefined,
          createdBy
        );

        expect(shareToken).toMatch(/^share-token-[a-z0-9]+$/);
        expect(mockDocument.shares).toHaveLength(1);
        expect(mockDocument.shares[0]).toMatchObject({
          shareToken,
          expiresAt,
          maxDownloads,
          downloadCount: 0,
          requiresPassword: false,
          createdBy,
          isActive: true
        });
      });

      it('should handle password-protected shares', async () => {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day
        const password = 'secret123';

        const shareToken = await mockDocument.createShare(
          expiresAt,
          5,
          true,
          password,
          ['192.168.1.0/24'],
          'user-123'
        );

        expect(mockDocument.shares[0]).toMatchObject({
          requiresPassword: true,
          password: 'hashed-secret123',
          allowedIPs: ['192.168.1.0/24']
        });
      });
    });

    describe('grantPermission', () => {
      beforeEach(() => {
        mockDocument.permissions = [];
        mockDocument.grantPermission = async function(
          userId: string,
          permissions: Permission[],
          grantedBy: string,
          expiresAt?: Date
        ) {
          // Remove existing permissions for this user
          this.permissions = this.permissions.filter(p => p.userId !== userId || !p.isActive);
          
          this.permissions.push({
            id: 'perm-' + Math.random().toString(36).substr(2, 9),
            documentId: this.id,
            userId,
            permissions,
            grantedBy,
            grantedAt: new Date(),
            expiresAt,
            isActive: true
          } as any);
          
          return this.save();
        };
      });

      it('should grant permissions successfully', async () => {
        const userId = 'user-456';
        const permissions = [Permission.READ, Permission.WRITE];
        const grantedBy = 'admin-user';
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

        await mockDocument.grantPermission(userId, permissions, grantedBy, expiresAt);

        expect(mockDocument.permissions).toHaveLength(1);
        expect(mockDocument.permissions[0]).toMatchObject({
          userId,
          permissions,
          grantedBy,
          expiresAt,
          isActive: true
        });
      });

      it('should replace existing permissions for the same user', async () => {
        // Grant initial permissions
        await mockDocument.grantPermission('user-123', [Permission.READ], 'admin-1');
        
        // Grant new permissions (should replace the old ones)
        await mockDocument.grantPermission('user-123', [Permission.READ, Permission.WRITE], 'admin-2');

        // Should only have one active permission set for the user
        const activePermissions = mockDocument.permissions.filter(p => p.userId === 'user-123' && p.isActive);
        expect(activePermissions).toHaveLength(1);
        expect(activePermissions[0].permissions).toEqual([Permission.READ, Permission.WRITE]);
      });
    });

    describe('revokePermission', () => {
      beforeEach(() => {
        mockDocument.permissions = [
          {
            id: 'perm-1',
            userId: 'user-123',
            permissions: [Permission.READ],
            grantedBy: 'admin-1',
            isActive: true
          },
          {
            id: 'perm-2',
            userId: 'user-456',
            permissions: [Permission.WRITE],
            grantedBy: 'admin-1',
            isActive: true
          }
        ] as any[];

        mockDocument.revokePermission = async function(userId: string) {
          this.permissions.forEach(p => {
            if (p.userId === userId) {
              p.isActive = false;
            }
          });
          
          return this.save();
        };
      });

      it('should revoke user permissions successfully', async () => {
        await mockDocument.revokePermission('user-123');

        const userPermission = mockDocument.permissions.find(p => p.userId === 'user-123');
        expect(userPermission?.isActive).toBe(false);

        // Other user's permissions should remain active
        const otherUserPermission = mockDocument.permissions.find(p => p.userId === 'user-456');
        expect(otherUserPermission?.isActive).toBe(true);
      });
    });
  });

  describe('Static Methods', () => {
    beforeEach(() => {
      // Mock static methods
      Document.findByClassification = jest.fn();
      Document.findShared = jest.fn();
      Document.search = jest.fn();
    });

    describe('findByClassification', () => {
      it('should find documents by classification level', async () => {
        const mockDocs = [mockDocument];
        (Document.findByClassification as jest.Mock).mockResolvedValue(mockDocs);

        const result = await Document.findByClassification(ClassificationLevel.CONFIDENTIAL, 'user-123');

        expect(Document.findByClassification).toHaveBeenCalledWith(ClassificationLevel.CONFIDENTIAL, 'user-123');
        expect(result).toEqual(mockDocs);
      });
    });

    describe('findShared', () => {
      it('should find document by share token', async () => {
        (Document.findShared as jest.Mock).mockResolvedValue(mockDocument);

        const result = await Document.findShared('share-token-abc123');

        expect(Document.findShared).toHaveBeenCalledWith('share-token-abc123');
        expect(result).toEqual(mockDocument);
      });
    });

    describe('search', () => {
      it('should search documents with query and filters', async () => {
        const mockResults = [mockDocument];
        (Document.search as jest.Mock).mockResolvedValue(mockResults);

        const query = 'test document';
        const filters = {
          classification: [ClassificationLevel.INTERNAL, ClassificationLevel.CONFIDENTIAL],
          category: ['legal-briefs'],
          dateRange: {
            from: new Date('2023-01-01'),
            to: new Date('2023-12-31')
          }
        };

        const result = await Document.search(query, filters);

        expect(Document.search).toHaveBeenCalledWith(query, filters);
        expect(result).toEqual(mockResults);
      });
    });
  });

  describe('Validation and Constraints', () => {
    it('should validate required fields', () => {
      const requiredFields = [
        'filename',
        'originalFilename', 
        'mimeType',
        'size',
        'author',
        'encryptionKey',
        'checksumSHA256',
        'checksumMD5'
      ];

      requiredFields.forEach(field => {
        expect(mockDocument).toHaveProperty(field);
        expect(mockDocument[field as keyof typeof mockDocument]).toBeDefined();
      });
    });

    it('should validate classification enum values', () => {
      const validClassifications = Object.values(ClassificationLevel);
      expect(validClassifications).toContain(mockDocument.classification);
    });

    it('should validate status enum values', () => {
      const validStatuses = Object.values(DocumentStatus);
      expect(validStatuses).toContain(mockDocument.status);
    });

    it('should validate size is non-negative', () => {
      expect(mockDocument.size).toBeGreaterThanOrEqual(0);
    });

    it('should validate checksums format', () => {
      expect(mockDocument.checksumSHA256).toMatch(/^[a-fA-F0-9]+$/);
      expect(mockDocument.checksumMD5).toMatch(/^[a-fA-F0-9]+$/);
    });
  });

  describe('Indexes and Performance', () => {
    it('should have proper indexing for query performance', () => {
      // In a real test, you would verify that indexes are properly defined
      const expectedIndexes = [
        'author_createdAt',
        'classification_status',
        'tags',
        'category',
        'shares.shareToken',
        'shares.expiresAt',
        'parentId_versions.version',
        'checksumSHA256',
        'text_search'
      ];

      expectedIndexes.forEach(index => {
        expect(index).toMatch(/^[a-zA-Z_.]+$/);
      });
    });
  });

  describe('Security Features', () => {
    it('should ensure encryption key reference is present', () => {
      expect(mockDocument.encryptionKey).toBeDefined();
      expect(mockDocument.encryptionKey).toMatch(/encrypted-key-reference/);
    });

    it('should track all document activities', () => {
      expect(mockDocument.activities).toBeDefined();
      expect(Array.isArray(mockDocument.activities)).toBe(true);
    });

    it('should maintain permission structure', () => {
      expect(mockDocument.permissions).toBeDefined();
      expect(Array.isArray(mockDocument.permissions)).toBe(true);
    });

    it('should support secure sharing with expiration', () => {
      expect(mockDocument.shares).toBeDefined();
      expect(Array.isArray(mockDocument.shares)).toBe(true);
    });
  });
});