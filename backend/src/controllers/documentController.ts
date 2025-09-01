import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import database from '../config/database';
import logger from '../utils/logger';
import { encryptFile, decryptFile } from '../utils/encryption';
import { scanFileForViruses } from '../utils/virusScanner';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'temp');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = uuidv4();
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 5 // Maximum 5 files per request
  },
  fileFilter: (req, file, cb) => {
    // Allow specific file types for security
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
      'text/csv'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  }
});

export class DocumentController {
  /**
   * Get all documents with filtering and pagination
   */
  async getAllDocuments(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        type,
        status,
        confidentiality_level,
        page = 1,
        limit = 20,
        search,
        sort_by = 'created_at',
        sort_order = 'desc'
      } = req.query;

      let query = database('documents')
        .leftJoin('users as creators', 'documents.created_by', 'creators.id')
        .select(
          'documents.*',
          'creators.name as created_by_name'
        )
        .whereNull('documents.deleted_at');

      // Apply filters based on user role and access level
      const userRole = req.user?.role;
      const userId = req.user?.id;

      if (userRole !== 'admin' && userRole !== 'case_manager') {
        // Restrict access to documents user has permission to see
        query = query.whereExists(function() {
          this.select('*')
              .from('document_permissions')
              .whereRaw('document_permissions.document_id = documents.id')
              .where('document_permissions.user_id', userId);
        });
      }

      // Apply additional filters
      if (type) {
        query = query.where('documents.type', type as string);
      }
      
      if (status) {
        query = query.where('documents.status', status as string);
      }

      if (confidentiality_level) {
        query = query.where('documents.confidentiality_level', confidentiality_level as string);
      }

      if (search) {
        query = query.where(function() {
          this.where('documents.title', 'ilike', `%${search}%`)
              .orWhere('documents.description', 'ilike', `%${search}%`)
              .orWhere('documents.tags', '@>', JSON.stringify([search as string]));
        });
      }

      // Count total for pagination
      const totalQuery = query.clone();
      const [{ count }] = await totalQuery.count('documents.id as count');
      const total = parseInt(count as string);

      // Apply pagination and sorting
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      query = query
        .orderBy(`documents.${sort_by}`, sort_order as string)
        .limit(parseInt(limit as string))
        .offset(offset);

      const documents = await query;

      res.json({
        success: true,
        data: {
          documents,
          pagination: {
            page: parseInt(page as string),
            limit: parseInt(limit as string),
            total,
            pages: Math.ceil(total / parseInt(limit as string))
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching documents:', error);
      next(error);
    }
  }

  /**
   * Upload new document(s)
   */
  async uploadDocument(req: Request, res: Response, next: NextFunction) {
    const uploadMiddleware = upload.array('documents', 5);
    
    uploadMiddleware(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'UPLOAD_ERROR',
            message: err.message
          }
        });
      }

      try {
        const files = req.files as Express.Multer.File[];
        const userId = req.user?.id;
        const {
          title,
          description,
          type,
          confidentiality_level = 'restricted',
          tags = [],
          metadata = {}
        } = req.body;

        if (!files || files.length === 0) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'NO_FILES',
              message: 'No files uploaded'
            }
          });
        }

        const trx = await database.transaction();
        const uploadedDocuments = [];

        try {
          for (const file of files) {
            // Scan for viruses
            const virusScanResult = await scanFileForViruses(file.path);
            if (!virusScanResult.clean) {
              await fs.unlink(file.path);
              throw new Error(`Virus detected in file: ${file.originalname}`);
            }

            // Encrypt file
            const encryptedPath = await encryptFile(file.path);
            
            // Move to permanent storage
            const permanentDir = path.join(process.cwd(), 'storage', 'documents');
            await fs.mkdir(permanentDir, { recursive: true });
            
            const permanentPath = path.join(permanentDir, `${uuidv4()}.enc`);
            await fs.rename(encryptedPath, permanentPath);

            // Save document metadata to database
            const [document] = await trx('documents').insert({
              title: title || file.originalname,
              description,
              type,
              original_filename: file.originalname,
              file_path: permanentPath,
              file_size: file.size,
              mime_type: file.mimetype,
              confidentiality_level,
              tags: JSON.stringify(Array.isArray(tags) ? tags : [tags].filter(Boolean)),
              metadata: JSON.stringify(metadata),
              checksum: await this.calculateChecksum(file.path),
              status: 'active',
              created_by: userId,
              updated_by: userId,
              created_at: new Date(),
              updated_at: new Date()
            }).returning('*');

            // Create initial permissions for uploader
            await trx('document_permissions').insert({
              document_id: document.id,
              user_id: userId,
              permission_type: 'owner',
              granted_by: userId,
              granted_at: new Date()
            });

            // Log document creation
            await trx('document_access_log').insert({
              document_id: document.id,
              user_id: userId,
              access_type: 'upload',
              accessed_at: new Date(),
              ip_address: req.ip
            });

            // Clean up temp file
            await fs.unlink(file.path);

            uploadedDocuments.push(document);
          }

          await trx.commit();

          // Emit real-time notification
          req.app.get('socketio').emit('documents:uploaded', {
            documents: uploadedDocuments,
            uploaded_by: userId
          });

          res.status(201).json({
            success: true,
            data: { documents: uploadedDocuments },
            message: `${uploadedDocuments.length} document(s) uploaded successfully`
          });

        } catch (innerError) {
          await trx.rollback();
          
          // Clean up any temp files
          for (const file of files) {
            try {
              await fs.unlink(file.path);
            } catch (cleanupError) {
              logger.error('Error cleaning up temp file:', cleanupError);
            }
          }
          
          throw innerError;
        }

      } catch (error) {
        logger.error('Error uploading documents:', error);
        next(error);
      }
    });
  }

  /**
   * Get document by ID
   */
  async getDocumentById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      // Check document exists and user has permission
      const document = await database('documents')
        .leftJoin('users as creators', 'documents.created_by', 'creators.id')
        .select(
          'documents.*',
          'creators.name as created_by_name'
        )
        .where('documents.id', id)
        .whereNull('documents.deleted_at')
        .first();

      if (!document) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'DOCUMENT_NOT_FOUND',
            message: 'Document not found'
          }
        });
      }

      // Check permissions
      const hasPermission = await this.checkDocumentPermission(userId, id, 'read');
      if (!hasPermission && userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Insufficient permissions to access this document'
          }
        });
      }

      // Log document access
      await database('document_access_log').insert({
        document_id: id,
        user_id: userId,
        access_type: 'view',
        accessed_at: new Date(),
        ip_address: req.ip
      });

      // Get document versions
      const versions = await database('document_versions')
        .where('document_id', id)
        .orderBy('version_number', 'desc');

      res.json({
        success: true,
        data: {
          document,
          versions
        }
      });

    } catch (error) {
      logger.error('Error fetching document:', error);
      next(error);
    }
  }

  /**
   * Download document file
   */
  async downloadDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      // Check document exists and user has permission
      const document = await database('documents')
        .where('id', id)
        .whereNull('deleted_at')
        .first();

      if (!document) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'DOCUMENT_NOT_FOUND',
            message: 'Document not found'
          }
        });
      }

      // Check download permissions
      const hasPermission = await this.checkDocumentPermission(userId, id, 'download');
      if (!hasPermission && userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Insufficient permissions to download this document'
          }
        });
      }

      // Decrypt and serve file
      const tempPath = path.join(process.cwd(), 'uploads', 'temp', `${uuidv4()}-${document.original_filename}`);
      await decryptFile(document.file_path, tempPath);

      // Log download
      await database('document_access_log').insert({
        document_id: id,
        user_id: userId,
        access_type: 'download',
        accessed_at: new Date(),
        ip_address: req.ip
      });

      // Send file and clean up
      res.download(tempPath, document.original_filename, async (err) => {
        try {
          await fs.unlink(tempPath);
        } catch (cleanupError) {
          logger.error('Error cleaning up temp file:', cleanupError);
        }
        
        if (err) {
          logger.error('Error sending file:', err);
        }
      });

    } catch (error) {
      logger.error('Error downloading document:', error);
      next(error);
    }
  }

  /**
   * Update document metadata
   */
  async updateDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: errors.array()
          }
        });
      }

      const { id } = req.params;
      const userId = req.user?.id;
      const updateData = req.body;

      // Check permissions
      const hasPermission = await this.checkDocumentPermission(userId, id, 'edit');
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Insufficient permissions to edit this document'
          }
        });
      }

      const trx = await database.transaction();
      
      try {
        const [updatedDocument] = await trx('documents')
          .where('id', id)
          .update({
            ...updateData,
            updated_by: userId,
            updated_at: new Date()
          })
          .returning('*');

        if (!updatedDocument) {
          await trx.rollback();
          return res.status(404).json({
            success: false,
            error: {
              code: 'DOCUMENT_NOT_FOUND',
              message: 'Document not found'
            }
          });
        }

        // Log the update
        await trx('document_access_log').insert({
          document_id: id,
          user_id: userId,
          access_type: 'edit',
          accessed_at: new Date(),
          ip_address: req.ip
        });

        await trx.commit();

        // Emit real-time update
        req.app.get('socketio').emit('document:updated', {
          document: updatedDocument,
          updated_by: userId
        });

        res.json({
          success: true,
          data: { document: updatedDocument },
          message: 'Document updated successfully'
        });

      } catch (innerError) {
        await trx.rollback();
        throw innerError;
      }

    } catch (error) {
      logger.error('Error updating document:', error);
      next(error);
    }
  }

  /**
   * Delete document (soft delete)
   */
  async deleteDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      // Check permissions
      const hasPermission = await this.checkDocumentPermission(userId, id, 'delete');
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Insufficient permissions to delete this document'
          }
        });
      }

      const [deletedDocument] = await database('documents')
        .where('id', id)
        .update({
          deleted_at: new Date(),
          updated_by: userId,
          updated_at: new Date()
        })
        .returning('*');

      if (!deletedDocument) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'DOCUMENT_NOT_FOUND',
            message: 'Document not found'
          }
        });
      }

      // Log deletion
      await database('document_access_log').insert({
        document_id: id,
        user_id: userId,
        access_type: 'delete',
        accessed_at: new Date(),
        ip_address: req.ip
      });

      // Emit real-time update
      req.app.get('socketio').emit('document:deleted', {
        document_id: id,
        deleted_by: userId
      });

      res.json({
        success: true,
        message: 'Document deleted successfully'
      });

    } catch (error) {
      logger.error('Error deleting document:', error);
      next(error);
    }
  }

  // Helper method to check document permissions
  private async checkDocumentPermission(userId: string, documentId: string, permission: string): Promise<boolean> {
    const result = await database('document_permissions')
      .where('document_id', documentId)
      .where('user_id', userId)
      .whereIn('permission_type', ['owner', permission])
      .first();

    return !!result;
  }

  // Helper method to calculate file checksum
  private async calculateChecksum(filePath: string): Promise<string> {
    const crypto = require('crypto');
    const fileBuffer = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }
}