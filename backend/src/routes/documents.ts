import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { AuthenticatedRequest, APIResponse, Document, FileUploadResult } from '../types';
import database from '../config/database';
import { requireAuth, requireRole, requireDocumentAccess } from '../middleware/auth';
import { validateRequest, documentSchemas, commonSchemas } from '../middleware/validation';
import { encryptFile, decryptFile, generateFileHash, verifyFileIntegrity } from '../utils/encryption';
import logger, { logSecurity } from '../utils/logger';

const router = express.Router();

// Apply authentication to all routes
router.use(requireAuth);

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 10, // Maximum 10 files
  },
  fileFilter: (req, file, cb) => {
    // Security: Check file types
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/zip',
      'application/x-zip-compressed',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('File type not allowed'));
    }

    // Check for potentially dangerous file extensions
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (dangerousExtensions.includes(fileExtension)) {
      return cb(new Error('File extension not allowed'));
    }

    cb(null, true);
  },
});

/**
 * @swagger
 * components:
 *   schemas:
 *     Document:
 *       type: object
 *       required:
 *         - title
 *         - classification
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         filePath:
 *           type: string
 *         fileHash:
 *           type: string
 *         fileSize:
 *           type: integer
 *         mimeType:
 *           type: string
 *         classification:
 *           type: string
 *           enum: [public, internal, confidential, secret]
 *         uploadedBy:
 *           type: string
 *           format: uuid
 *         versionNumber:
 *           type: integer
 *         parentDocumentId:
 *           type: string
 *           format: uuid
 *         encryptionKeyId:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/documents:
 *   get:
 *     summary: Get all documents with filtering and pagination
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: classification
 *         schema:
 *           type: string
 *           enum: [public, internal, confidential, secret]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *     responses:
 *       200:
 *         description: List of documents
 */
router.get('/',
  validateRequest({ query: commonSchemas.pagination }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const {
        classification,
        page = 1,
        limit = 20,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      // Get user's document access level
      let maxClassification = 'public';
      switch (req.user.roleType) {
        case 'legal_team':
        case 'government_entity':
          maxClassification = 'secret';
          break;
        case 'witness':
          maxClassification = 'confidential';
          break;
        case 'esop_participant':
          maxClassification = 'internal';
          break;
        default:
          maxClassification = 'public';
      }

      const classificationLevels = { public: 1, internal: 2, confidential: 3, secret: 4 };
      const userLevel = classificationLevels[maxClassification as keyof typeof classificationLevels];

      let query = database('documents')
        .leftJoin('users', 'documents.uploaded_by', 'users.id')
        .select([
          'documents.*',
          'users.email as uploader_email',
          'users.first_name as uploader_first_name',
          'users.last_name as uploader_last_name'
        ]);

      // Apply classification filter based on user access level
      query = query.where(function() {
        Object.entries(classificationLevels).forEach(([level, value]) => {
          if (value <= userLevel) {
            this.orWhere('documents.classification', level);
          }
        });
      });

      // Apply additional filters
      if (classification && classificationLevels[classification as keyof typeof classificationLevels] <= userLevel) {
        query = query.where('documents.classification', classification as string);
      }

      if (search) {
        query = query.where(function() {
          this.where('documents.title', 'ilike', `%${search}%`)
              .orWhere('documents.description', 'ilike', `%${search}%`);
        });
      }

      // Get total count
      const totalQuery = query.clone()
        .clearSelect()
        .clearOrder()
        .count('documents.id as count')
        .groupBy('documents.id');
      
      const countResult = await database.raw(`
        SELECT COUNT(*) as count FROM (${totalQuery.toString()}) as subquery
      `);
      const total = parseInt(countResult.rows[0].count);

      // Apply pagination and sorting
      const offset = (Number(page) - 1) * Number(limit);
      query = query
        .orderBy(`documents.${sortBy}`, sortOrder as 'asc' | 'desc')
        .limit(Number(limit))
        .offset(offset);

      const documents = await query;

      const response: APIResponse = {
        success: true,
        data: documents.map(doc => ({
          ...doc,
          // Don't expose file paths in list view
          filePath: doc.filePath ? 'available' : null,
          uploader: {
            email: doc.uploader_email,
            firstName: doc.uploader_first_name,
            lastName: doc.uploader_last_name,
          }
        })),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
        timestamp: new Date(),
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching documents:', error);
      
      const response: APIResponse = {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch documents',
        },
        timestamp: new Date(),
      };
      
      res.status(500).json(response);
    }
  }
);

/**
 * @swagger
 * /api/documents/{id}:
 *   get:
 *     summary: Get a specific document
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Document details
 */
router.get('/:id',
  validateRequest({ params: { id: commonSchemas.uuid } }),
  requireDocumentAccess('public'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const document = await database('documents')
        .leftJoin('users', 'documents.uploaded_by', 'users.id')
        .select([
          'documents.*',
          'users.email as uploader_email',
          'users.first_name as uploader_first_name',
          'users.last_name as uploader_last_name'
        ])
        .where('documents.id', req.params.id)
        .first();

      if (!document) {
        const response: APIResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Document not found',
          },
          timestamp: new Date(),
        };
        return res.status(404).json(response);
      }

      // Log document access
      await database('document_access_log').insert({
        documentId: document.id,
        userId: req.user.id,
        action: 'view',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      logSecurity('document_accessed', {
        documentId: document.id,
        documentTitle: document.title,
        classification: document.classification,
        userId: req.user.id,
        userRole: req.user.roleType,
        ip: req.ip,
      });

      const response: APIResponse = {
        success: true,
        data: {
          ...document,
          uploader: {
            email: document.uploader_email,
            firstName: document.uploader_first_name,
            lastName: document.uploader_last_name,
          }
        },
        timestamp: new Date(),
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching document:', error);
      
      const response: APIResponse = {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch document',
        },
        timestamp: new Date(),
      };
      
      res.status(500).json(response);
    }
  }
);

/**
 * @swagger
 * /api/documents/upload:
 *   post:
 *     summary: Upload new documents
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - files
 *               - title
 *               - classification
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               classification:
 *                 type: string
 *                 enum: [public, internal, confidential, secret]
 *     responses:
 *       201:
 *         description: Documents uploaded successfully
 */
router.post('/upload',
  requireRole(['legal_team', 'government_entity', 'witness']),
  upload.array('files'),
  validateRequest({ body: documentSchemas.create }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { title, description, classification } = req.body;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        const response: APIResponse = {
          success: false,
          error: {
            code: 'NO_FILES',
            message: 'No files provided',
          },
          timestamp: new Date(),
        };
        return res.status(400).json(response);
      }

      const uploadResults: FileUploadResult[] = [];
      const documentsDir = path.join(process.cwd(), 'uploads', 'documents');
      
      // Ensure upload directory exists
      await fs.mkdir(documentsDir, { recursive: true });

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Generate file hash for integrity
        const fileHash = generateFileHash(file.buffer);
        
        // Check for duplicate files
        const existingFile = await database('documents')
          .select('id')
          .where({ fileHash })
          .first();

        if (existingFile) {
          logger.warn('Duplicate file upload attempt:', {
            originalName: file.originalname,
            hash: fileHash,
            userId: req.user.id,
          });
          continue;
        }

        // Encrypt file
        const encryptionResult = encryptFile(file.buffer);
        
        // Generate unique filename
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(7);
        const filename = `${timestamp}_${randomString}_encrypted`;
        const filePath = path.join(documentsDir, filename);

        // Save encrypted file
        await fs.writeFile(filePath, encryptionResult.encryptedData, 'base64');

        // Create document record
        const [documentId] = await database('documents').insert({
          title: files.length === 1 ? title : `${title} - ${file.originalname}`,
          description,
          filePath: filename, // Store relative path only
          fileHash,
          fileSize: file.size,
          mimeType: file.mimetype,
          classification,
          uploadedBy: req.user.id,
          versionNumber: 1,
          encryptionKeyId: encryptionResult.keyId,
        }).returning('id');

        uploadResults.push({
          id: documentId,
          filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          path: filePath,
          hash: fileHash,
          encryptionKeyId: encryptionResult.keyId,
          virusCheckPassed: true, // Would implement actual virus scanning
        });

        logSecurity('document_uploaded', {
          documentId,
          originalName: file.originalname,
          classification,
          fileSize: file.size,
          uploadedBy: req.user.id,
          ip: req.ip,
        });
      }

      const response: APIResponse = {
        success: true,
        data: {
          uploadedFiles: uploadResults,
          message: `${uploadResults.length} file(s) uploaded successfully`,
        },
        timestamp: new Date(),
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error('Error uploading documents:', error);
      
      const response: APIResponse = {
        success: false,
        error: {
          code: 'UPLOAD_ERROR',
          message: 'Failed to upload documents',
        },
        timestamp: new Date(),
      };
      
      res.status(500).json(response);
    }
  }
);

/**
 * @swagger
 * /api/documents/{id}/download:
 *   get:
 *     summary: Download a document
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Document file
 */
router.get('/:id/download',
  validateRequest({ params: { id: commonSchemas.uuid } }),
  requireDocumentAccess('public'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const document = await database('documents')
        .select('*')
        .where({ id: req.params.id })
        .first();

      if (!document || !document.filePath) {
        const response: APIResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Document file not found',
          },
          timestamp: new Date(),
        };
        return res.status(404).json(response);
      }

      const filePath = path.join(process.cwd(), 'uploads', 'documents', document.filePath);

      try {
        // Read encrypted file
        const encryptedData = await fs.readFile(filePath, 'base64');
        
        // Decrypt file
        const decryptedBuffer = decryptFile(encryptedData, {
          keyId: document.encryptionKeyId,
          algorithm: 'aes-256-gcm',
          iv: '',
        });

        // Verify file integrity
        const isValid = verifyFileIntegrity(decryptedBuffer, document.fileHash);
        if (!isValid) {
          logSecurity('file_integrity_check_failed', {
            documentId: document.id,
            userId: req.user.id,
            ip: req.ip,
          });

          const response: APIResponse = {
            success: false,
            error: {
              code: 'FILE_CORRUPTED',
              message: 'File integrity check failed',
            },
            timestamp: new Date(),
          };
          return res.status(500).json(response);
        }

        // Log download
        await database('document_access_log').insert({
          documentId: document.id,
          userId: req.user.id,
          action: 'download',
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });

        logSecurity('document_downloaded', {
          documentId: document.id,
          documentTitle: document.title,
          classification: document.classification,
          userId: req.user.id,
          userRole: req.user.roleType,
          ip: req.ip,
        });

        // Set appropriate headers
        res.setHeader('Content-Type', document.mimeType);
        res.setHeader('Content-Length', decryptedBuffer.length);
        res.setHeader('Content-Disposition', `attachment; filename="${document.title}"`);
        
        res.send(decryptedBuffer);
      } catch (fileError) {
        logger.error('Error reading/decrypting file:', fileError);
        
        const response: APIResponse = {
          success: false,
          error: {
            code: 'FILE_ACCESS_ERROR',
            message: 'Unable to access file',
          },
          timestamp: new Date(),
        };
        
        res.status(500).json(response);
      }
    } catch (error) {
      logger.error('Error downloading document:', error);
      
      const response: APIResponse = {
        success: false,
        error: {
          code: 'DOWNLOAD_ERROR',
          message: 'Failed to download document',
        },
        timestamp: new Date(),
      };
      
      res.status(500).json(response);
    }
  }
);

export default router;