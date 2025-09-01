import express from 'express';
import { AuthenticatedRequest, APIResponse, Stakeholder, QueryOptions } from '../types';
import database from '../config/database';
import { requireAuth, requireRole, requireSecurityLevel } from '../middleware/auth';
import { validateRequest, stakeholderSchemas, commonSchemas } from '../middleware/validation';
import { encryptData, decryptData } from '../utils/encryption';
import logger, { logSecurity } from '../utils/logger';

const router = express.Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * @swagger
 * components:
 *   schemas:
 *     Stakeholder:
 *       type: object
 *       required:
 *         - category
 *         - name
 *         - contactInfo
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         category:
 *           type: string
 *           enum: [legal_team, government_entities, esop_participants, key_witnesses, media_contacts, opposition]
 *         subcategory:
 *           type: string
 *         name:
 *           type: string
 *         organization:
 *           type: string
 *         title:
 *           type: string
 *         contactInfo:
 *           type: object
 *           description: Encrypted contact information
 *         metadata:
 *           type: object
 *           description: Category-specific metadata
 *         securityLevel:
 *           type: string
 *           enum: [standard, restricted, high]
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/stakeholders:
 *   get:
 *     summary: Get all stakeholders with filtering and pagination
 *     tags: [Stakeholders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [legal_team, government_entities, esop_participants, key_witnesses, media_contacts, opposition]
 *       - in: query
 *         name: securityLevel
 *         schema:
 *           type: string
 *           enum: [standard, restricted, high]
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
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of stakeholders
 */
router.get('/', 
  validateRequest({ query: commonSchemas.pagination }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const {
        category,
        securityLevel,
        page = 1,
        limit = 20,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      let query = database('stakeholders').select('*');

      // Apply filters
      if (category) {
        query = query.where('category', category as string);
      }

      if (securityLevel) {
        query = query.where('securityLevel', securityLevel as string);
      }

      // Apply search
      if (search) {
        query = query.where(function() {
          this.where('name', 'ilike', `%${search}%`)
              .orWhere('organization', 'ilike', `%${search}%`)
              .orWhere('title', 'ilike', `%${search}%`);
        });
      }

      // Security filtering based on user role
      if (!['legal_team', 'government_entity'].includes(req.user.roleType)) {
        // Non-admin users can't see high-security stakeholders
        query = query.whereNot('securityLevel', 'high');
        
        if (req.user.roleType === 'media_contact' || req.user.roleType === 'opposition') {
          // Media and opposition can only see standard security level
          query = query.where('securityLevel', 'standard');
        }
      }

      // Get total count
      const totalQuery = query.clone().clearSelect().clearOrder().count('* as count');
      const [{ count }] = await totalQuery;
      const total = parseInt(count as string);

      // Apply pagination and sorting
      const offset = (Number(page) - 1) * Number(limit);
      query = query
        .orderBy(sortBy as string, sortOrder as 'asc' | 'desc')
        .limit(Number(limit))
        .offset(offset);

      const stakeholders = await query;

      // Decrypt contact information for authorized users
      const decryptedStakeholders = await Promise.all(
        stakeholders.map(async (stakeholder: any) => {
          try {
            // Only decrypt for authorized users
            if (['legal_team', 'government_entity'].includes(req.user.roleType) || 
                stakeholder.securityLevel === 'standard') {
              
              if (stakeholder.contactInfo?.encryptedData) {
                stakeholder.contactInfo = JSON.parse(
                  decryptData(
                    stakeholder.contactInfo.encryptedData,
                    stakeholder.contactInfo
                  )
                );
              }
            } else {
              // Redact sensitive contact info
              stakeholder.contactInfo = { redacted: true };
            }

            return stakeholder;
          } catch (error) {
            logger.error('Error decrypting stakeholder contact info:', error);
            stakeholder.contactInfo = { error: 'decryption_failed' };
            return stakeholder;
          }
        })
      );

      const response: APIResponse = {
        success: true,
        data: decryptedStakeholders,
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
      logger.error('Error fetching stakeholders:', error);
      
      const response: APIResponse = {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch stakeholders',
        },
        timestamp: new Date(),
      };
      
      res.status(500).json(response);
    }
  }
);

/**
 * @swagger
 * /api/stakeholders/{id}:
 *   get:
 *     summary: Get a specific stakeholder
 *     tags: [Stakeholders]
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
 *         description: Stakeholder details
 *       404:
 *         description: Stakeholder not found
 */
router.get('/:id',
  validateRequest({ params: { id: commonSchemas.uuid } }),
  requireSecurityLevel('standard'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const stakeholder = await database('stakeholders')
        .select('*')
        .where({ id: req.params.id })
        .first();

      if (!stakeholder) {
        const response: APIResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Stakeholder not found',
          },
          timestamp: new Date(),
        };
        return res.status(404).json(response);
      }

      // Log access for audit
      logSecurity('stakeholder_accessed', {
        stakeholderId: stakeholder.id,
        stakeholderName: stakeholder.name,
        securityLevel: stakeholder.securityLevel,
        userId: req.user.id,
        userRole: req.user.roleType,
        ip: req.ip,
      });

      // Decrypt contact information for authorized users
      try {
        if (['legal_team', 'government_entity'].includes(req.user.roleType) || 
            stakeholder.securityLevel === 'standard') {
          
          if (stakeholder.contactInfo?.encryptedData) {
            stakeholder.contactInfo = JSON.parse(
              decryptData(
                stakeholder.contactInfo.encryptedData,
                stakeholder.contactInfo
              )
            );
          }
        } else {
          stakeholder.contactInfo = { redacted: true };
        }
      } catch (error) {
        logger.error('Error decrypting stakeholder contact info:', error);
        stakeholder.contactInfo = { error: 'decryption_failed' };
      }

      const response: APIResponse = {
        success: true,
        data: stakeholder,
        timestamp: new Date(),
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching stakeholder:', error);
      
      const response: APIResponse = {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch stakeholder',
        },
        timestamp: new Date(),
      };
      
      res.status(500).json(response);
    }
  }
);

/**
 * @swagger
 * /api/stakeholders:
 *   post:
 *     summary: Create a new stakeholder
 *     tags: [Stakeholders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - category
 *               - name
 *               - contactInfo
 *             properties:
 *               category:
 *                 type: string
 *                 enum: [legal_team, government_entities, esop_participants, key_witnesses, media_contacts, opposition]
 *               subcategory:
 *                 type: string
 *               name:
 *                 type: string
 *               organization:
 *                 type: string
 *               title:
 *                 type: string
 *               contactInfo:
 *                 type: object
 *               metadata:
 *                 type: object
 *               securityLevel:
 *                 type: string
 *                 enum: [standard, restricted, high]
 *                 default: standard
 *     responses:
 *       201:
 *         description: Stakeholder created successfully
 */
router.post('/',
  requireRole(['legal_team', 'government_entity']),
  validateRequest({ body: stakeholderSchemas.create }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const {
        category,
        subcategory,
        name,
        organization,
        title,
        contactInfo,
        metadata,
        securityLevel = 'standard'
      } = req.body;

      // Encrypt contact information
      const encryptedContactInfo = encryptData(JSON.stringify(contactInfo));

      // Create stakeholder
      const [stakeholderId] = await database('stakeholders').insert({
        category,
        subcategory,
        name,
        organization,
        title,
        contactInfo: encryptedContactInfo,
        metadata: metadata || {},
        securityLevel,
      }).returning('id');

      logSecurity('stakeholder_created', {
        stakeholderId,
        category,
        securityLevel,
        createdBy: req.user.id,
        ip: req.ip,
      });

      const response: APIResponse = {
        success: true,
        data: {
          id: stakeholderId,
          message: 'Stakeholder created successfully',
        },
        timestamp: new Date(),
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error('Error creating stakeholder:', error);
      
      const response: APIResponse = {
        success: false,
        error: {
          code: 'CREATE_ERROR',
          message: 'Failed to create stakeholder',
        },
        timestamp: new Date(),
      };
      
      res.status(500).json(response);
    }
  }
);

/**
 * @swagger
 * /api/stakeholders/{id}:
 *   put:
 *     summary: Update a stakeholder
 *     tags: [Stakeholders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               category:
 *                 type: string
 *               name:
 *                 type: string
 *               organization:
 *                 type: string
 *               contactInfo:
 *                 type: object
 *               securityLevel:
 *                 type: string
 *     responses:
 *       200:
 *         description: Stakeholder updated successfully
 */
router.put('/:id',
  validateRequest({ 
    params: { id: commonSchemas.uuid },
    body: stakeholderSchemas.update 
  }),
  requireRole(['legal_team', 'government_entity']),
  requireSecurityLevel('standard'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const updateData = { ...req.body };

      // Get existing stakeholder for audit logging
      const existingStakeholder = await database('stakeholders')
        .select('*')
        .where({ id: req.params.id })
        .first();

      if (!existingStakeholder) {
        const response: APIResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Stakeholder not found',
          },
          timestamp: new Date(),
        };
        return res.status(404).json(response);
      }

      // Encrypt contact information if provided
      if (updateData.contactInfo) {
        updateData.contactInfo = encryptData(JSON.stringify(updateData.contactInfo));
      }

      updateData.updatedAt = new Date();

      // Update stakeholder
      await database('stakeholders')
        .where({ id: req.params.id })
        .update(updateData);

      logSecurity('stakeholder_updated', {
        stakeholderId: req.params.id,
        updatedBy: req.user.id,
        changes: Object.keys(updateData),
        securityLevel: existingStakeholder.securityLevel,
        ip: req.ip,
      });

      const response: APIResponse = {
        success: true,
        data: {
          message: 'Stakeholder updated successfully',
        },
        timestamp: new Date(),
      };

      res.json(response);
    } catch (error) {
      logger.error('Error updating stakeholder:', error);
      
      const response: APIResponse = {
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          message: 'Failed to update stakeholder',
        },
        timestamp: new Date(),
      };
      
      res.status(500).json(response);
    }
  }
);

/**
 * @swagger
 * /api/stakeholders/{id}:
 *   delete:
 *     summary: Delete a stakeholder
 *     tags: [Stakeholders]
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
 *         description: Stakeholder deleted successfully
 */
router.delete('/:id',
  validateRequest({ params: { id: commonSchemas.uuid } }),
  requireRole(['legal_team', 'government_entity']),
  requireSecurityLevel('standard'),
  async (req: AuthenticatedRequest, res) => {
    try {
      // Get stakeholder for audit logging
      const stakeholder = await database('stakeholders')
        .select('name', 'category', 'securityLevel')
        .where({ id: req.params.id })
        .first();

      if (!stakeholder) {
        const response: APIResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Stakeholder not found',
          },
          timestamp: new Date(),
        };
        return res.status(404).json(response);
      }

      // Delete stakeholder
      await database('stakeholders')
        .where({ id: req.params.id })
        .del();

      logSecurity('stakeholder_deleted', {
        stakeholderId: req.params.id,
        stakeholderName: stakeholder.name,
        category: stakeholder.category,
        securityLevel: stakeholder.securityLevel,
        deletedBy: req.user.id,
        ip: req.ip,
      });

      const response: APIResponse = {
        success: true,
        data: {
          message: 'Stakeholder deleted successfully',
        },
        timestamp: new Date(),
      };

      res.json(response);
    } catch (error) {
      logger.error('Error deleting stakeholder:', error);
      
      const response: APIResponse = {
        success: false,
        error: {
          code: 'DELETE_ERROR',
          message: 'Failed to delete stakeholder',
        },
        timestamp: new Date(),
      };
      
      res.status(500).json(response);
    }
  }
);

export default router;