import express from 'express';
import { AuthenticatedRequest, APIResponse, EvidenceItem, ChainOfCustodyEntry } from '../types';
import database from '../config/database';
import { requireAuth, requireRole, requireDocumentAccess } from '../middleware/auth';
import { validateRequest, commonSchemas } from '../middleware/validation';
import { generateFileHash } from '../utils/encryption';
import logger, { logSecurity } from '../utils/logger';
import Joi from 'joi';

const router = express.Router();

// Apply authentication to all routes
router.use(requireAuth);

// Evidence validation schemas
const evidenceSchemas = {
  create: Joi.object({
    documentId: Joi.string().uuid(),
    evidenceType: Joi.string().required().max(100),
    sourceStakeholderId: Joi.string().uuid(),
    significanceLevel: Joi.number().integer().min(1).max(10),
    notes: Joi.string(),
  }),
  chainOfCustody: Joi.object({
    toUser: Joi.string().uuid().required(),
    reason: Joi.string().required().max(500),
    location: Joi.string().required().max(255),
  }),
  verify: Joi.object({
    authenticityVerified: Joi.boolean().required(),
    notes: Joi.string().max(1000),
  }),
};

/**
 * @swagger
 * components:
 *   schemas:
 *     EvidenceItem:
 *       type: object
 *       required:
 *         - evidenceType
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         documentId:
 *           type: string
 *           format: uuid
 *         evidenceType:
 *           type: string
 *         sourceStakeholderId:
 *           type: string
 *           format: uuid
 *         chainOfCustody:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ChainOfCustodyEntry'
 *         integrityHash:
 *           type: string
 *         authenticityVerified:
 *           type: boolean
 *         verifiedBy:
 *           type: string
 *           format: uuid
 *         verifiedAt:
 *           type: string
 *           format: date-time
 *         significanceLevel:
 *           type: integer
 *           minimum: 1
 *           maximum: 10
 *         notes:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *     ChainOfCustodyEntry:
 *       type: object
 *       properties:
 *         fromUser:
 *           type: string
 *           format: uuid
 *         toUser:
 *           type: string
 *           format: uuid
 *         transferredAt:
 *           type: string
 *           format: date-time
 *         reason:
 *           type: string
 *         location:
 *           type: string
 */

/**
 * @swagger
 * /api/evidence:
 *   get:
 *     summary: Get all evidence items with filtering
 *     tags: [Evidence]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: evidenceType
 *         schema:
 *           type: string
 *       - in: query
 *         name: verified
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: significanceLevel
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 10
 *     responses:
 *       200:
 *         description: List of evidence items
 */
router.get('/',
  validateRequest({ query: commonSchemas.pagination }),
  requireRole(['legal_team', 'government_entity', 'witness']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const {
        evidenceType,
        verified,
        significanceLevel,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      let query = database('evidence_items')
        .leftJoin('documents', 'evidence_items.document_id', 'documents.id')
        .leftJoin('stakeholders', 'evidence_items.source_stakeholder_id', 'stakeholders.id')
        .leftJoin('users as verifiers', 'evidence_items.verified_by', 'verifiers.id')
        .select([
          'evidence_items.*',
          'documents.title as document_title',
          'documents.classification as document_classification',
          'stakeholders.name as source_stakeholder_name',
          'verifiers.email as verifier_email',
          'verifiers.first_name as verifier_first_name',
          'verifiers.last_name as verifier_last_name'
        ]);

      // Apply filters
      if (evidenceType) {
        query = query.where('evidence_items.evidence_type', evidenceType as string);
      }

      if (verified !== undefined) {
        query = query.where('evidence_items.authenticity_verified', verified === 'true');
      }

      if (significanceLevel) {
        query = query.where('evidence_items.significance_level', '>=', Number(significanceLevel));
      }

      // Security filtering - witnesses can only see their own evidence
      if (req.user.roleType === 'witness') {
        // Get stakeholder record for this user
        const stakeholder = await database('stakeholders')
          .select('id')
          .where({ user_id: req.user.id })
          .first();
        
        if (stakeholder) {
          query = query.where('evidence_items.source_stakeholder_id', stakeholder.id);
        } else {
          // If no stakeholder record, user can't see any evidence
          query = query.where('1', '0'); // Always false condition
        }
      }

      // Get total count
      const totalQuery = query.clone()
        .clearSelect()
        .clearOrder()
        .count('evidence_items.id as count');
      
      const [{ count }] = await totalQuery;
      const total = parseInt(count as string);

      // Apply pagination and sorting
      const offset = (Number(page) - 1) * Number(limit);
      query = query
        .orderBy(`evidence_items.${sortBy}`, sortOrder as 'asc' | 'desc')
        .limit(Number(limit))
        .offset(offset);

      const evidence = await query;

      // Parse chain of custody JSON
      const processedEvidence = evidence.map(item => ({
        ...item,
        chainOfCustody: typeof item.chain_of_custody === 'string' ? 
          JSON.parse(item.chain_of_custody) : item.chain_of_custody,
        document: item.document_title ? {
          title: item.document_title,
          classification: item.document_classification
        } : null,
        sourceStakeholder: item.source_stakeholder_name ? {
          name: item.source_stakeholder_name
        } : null,
        verifier: item.verifier_email ? {
          email: item.verifier_email,
          firstName: item.verifier_first_name,
          lastName: item.verifier_last_name
        } : null
      }));

      const response: APIResponse = {
        success: true,
        data: processedEvidence,
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
      logger.error('Error fetching evidence:', error);
      
      const response: APIResponse = {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch evidence items',
        },
        timestamp: new Date(),
      };
      
      res.status(500).json(response);
    }
  }
);

/**
 * @swagger
 * /api/evidence/{id}:
 *   get:
 *     summary: Get a specific evidence item
 *     tags: [Evidence]
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
 *         description: Evidence item details
 */
router.get('/:id',
  validateRequest({ params: { id: commonSchemas.uuid } }),
  requireRole(['legal_team', 'government_entity', 'witness']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const evidence = await database('evidence_items')
        .leftJoin('documents', 'evidence_items.document_id', 'documents.id')
        .leftJoin('stakeholders', 'evidence_items.source_stakeholder_id', 'stakeholders.id')
        .leftJoin('users as verifiers', 'evidence_items.verified_by', 'verifiers.id')
        .select([
          'evidence_items.*',
          'documents.title as document_title',
          'documents.classification as document_classification',
          'stakeholders.name as source_stakeholder_name',
          'verifiers.email as verifier_email',
          'verifiers.first_name as verifier_first_name',
          'verifiers.last_name as verifier_last_name'
        ])
        .where('evidence_items.id', req.params.id)
        .first();

      if (!evidence) {
        const response: APIResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Evidence item not found',
          },
          timestamp: new Date(),
        };
        return res.status(404).json(response);
      }

      // Security check for witnesses
      if (req.user.roleType === 'witness') {
        const stakeholder = await database('stakeholders')
          .select('id')
          .where({ user_id: req.user.id })
          .first();
        
        if (!stakeholder || evidence.source_stakeholder_id !== stakeholder.id) {
          const response: APIResponse = {
            success: false,
            error: {
              code: 'ACCESS_DENIED',
              message: 'Access denied to this evidence item',
            },
            timestamp: new Date(),
          };
          return res.status(403).json(response);
        }
      }

      logSecurity('evidence_accessed', {
        evidenceId: evidence.id,
        evidenceType: evidence.evidence_type,
        userId: req.user.id,
        userRole: req.user.roleType,
        ip: req.ip,
      });

      const processedEvidence = {
        ...evidence,
        chainOfCustody: typeof evidence.chain_of_custody === 'string' ? 
          JSON.parse(evidence.chain_of_custody) : evidence.chain_of_custody,
        document: evidence.document_title ? {
          title: evidence.document_title,
          classification: evidence.document_classification
        } : null,
        sourceStakeholder: evidence.source_stakeholder_name ? {
          name: evidence.source_stakeholder_name
        } : null,
        verifier: evidence.verifier_email ? {
          email: evidence.verifier_email,
          firstName: evidence.verifier_first_name,
          lastName: evidence.verifier_last_name
        } : null
      };

      const response: APIResponse = {
        success: true,
        data: processedEvidence,
        timestamp: new Date(),
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching evidence item:', error);
      
      const response: APIResponse = {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch evidence item',
        },
        timestamp: new Date(),
      };
      
      res.status(500).json(response);
    }
  }
);

/**
 * @swagger
 * /api/evidence:
 *   post:
 *     summary: Create a new evidence item
 *     tags: [Evidence]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - evidenceType
 *             properties:
 *               documentId:
 *                 type: string
 *                 format: uuid
 *               evidenceType:
 *                 type: string
 *               sourceStakeholderId:
 *                 type: string
 *                 format: uuid
 *               significanceLevel:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Evidence item created successfully
 */
router.post('/',
  requireRole(['legal_team', 'government_entity']),
  validateRequest({ body: evidenceSchemas.create }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const {
        documentId,
        evidenceType,
        sourceStakeholderId,
        significanceLevel,
        notes
      } = req.body;

      // Validate document exists and user has access
      if (documentId) {
        const document = await database('documents')
          .select('file_hash')
          .where({ id: documentId })
          .first();

        if (!document) {
          const response: APIResponse = {
            success: false,
            error: {
              code: 'DOCUMENT_NOT_FOUND',
              message: 'Referenced document not found',
            },
            timestamp: new Date(),
          };
          return res.status(400).json(response);
        }
      }

      // Validate stakeholder exists
      if (sourceStakeholderId) {
        const stakeholder = await database('stakeholders')
          .select('id')
          .where({ id: sourceStakeholderId })
          .first();

        if (!stakeholder) {
          const response: APIResponse = {
            success: false,
            error: {
              code: 'STAKEHOLDER_NOT_FOUND',
              message: 'Referenced stakeholder not found',
            },
            timestamp: new Date(),
          };
          return res.status(400).json(response);
        }
      }

      // Generate integrity hash if document is provided
      let integrityHash: string | undefined;
      if (documentId) {
        const document = await database('documents')
          .select('file_hash')
          .where({ id: documentId })
          .first();
        integrityHash = document?.file_hash;
      }

      // Initialize chain of custody
      const initialChainOfCustody: ChainOfCustodyEntry[] = [{
        fromUser: 'system',
        toUser: req.user.id,
        transferredAt: new Date(),
        reason: 'Initial evidence creation',
        location: 'System',
      }];

      // Create evidence item
      const [evidenceId] = await database('evidence_items').insert({
        documentId: documentId || null,
        evidenceType,
        sourceStakeholderId: sourceStakeholderId || null,
        chainOfCustody: JSON.stringify(initialChainOfCustody),
        integrityHash,
        authenticityVerified: false,
        significanceLevel: significanceLevel || null,
        notes: notes || null,
      }).returning('id');

      logSecurity('evidence_created', {
        evidenceId,
        evidenceType,
        documentId,
        sourceStakeholderId,
        createdBy: req.user.id,
        ip: req.ip,
      });

      const response: APIResponse = {
        success: true,
        data: {
          id: evidenceId,
          message: 'Evidence item created successfully',
        },
        timestamp: new Date(),
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error('Error creating evidence item:', error);
      
      const response: APIResponse = {
        success: false,
        error: {
          code: 'CREATE_ERROR',
          message: 'Failed to create evidence item',
        },
        timestamp: new Date(),
      };
      
      res.status(500).json(response);
    }
  }
);

/**
 * @swagger
 * /api/evidence/{id}/transfer:
 *   post:
 *     summary: Transfer evidence to another user (chain of custody)
 *     tags: [Evidence]
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
 *             required:
 *               - toUser
 *               - reason
 *               - location
 *             properties:
 *               toUser:
 *                 type: string
 *                 format: uuid
 *               reason:
 *                 type: string
 *               location:
 *                 type: string
 *     responses:
 *       200:
 *         description: Evidence transferred successfully
 */
router.post('/:id/transfer',
  validateRequest({ 
    params: { id: commonSchemas.uuid },
    body: evidenceSchemas.chainOfCustody 
  }),
  requireRole(['legal_team', 'government_entity']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { toUser, reason, location } = req.body;

      // Get evidence item
      const evidence = await database('evidence_items')
        .select('*')
        .where({ id: req.params.id })
        .first();

      if (!evidence) {
        const response: APIResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Evidence item not found',
          },
          timestamp: new Date(),
        };
        return res.status(404).json(response);
      }

      // Validate target user exists
      const targetUser = await database('users')
        .select('id')
        .where({ id: toUser })
        .first();

      if (!targetUser) {
        const response: APIResponse = {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'Target user not found',
          },
          timestamp: new Date(),
        };
        return res.status(400).json(response);
      }

      // Parse existing chain of custody
      const chainOfCustody: ChainOfCustodyEntry[] = typeof evidence.chain_of_custody === 'string' ?
        JSON.parse(evidence.chain_of_custody) : evidence.chain_of_custody || [];

      // Add new transfer entry
      const transferEntry: ChainOfCustodyEntry = {
        fromUser: req.user.id,
        toUser,
        transferredAt: new Date(),
        reason,
        location,
      };

      chainOfCustody.push(transferEntry);

      // Update evidence item
      await database('evidence_items')
        .where({ id: req.params.id })
        .update({
          chainOfCustody: JSON.stringify(chainOfCustody),
        });

      logSecurity('evidence_transferred', {
        evidenceId: req.params.id,
        fromUser: req.user.id,
        toUser,
        reason,
        location,
        ip: req.ip,
      });

      const response: APIResponse = {
        success: true,
        data: {
          message: 'Evidence transferred successfully',
          chainOfCustody,
        },
        timestamp: new Date(),
      };

      res.json(response);
    } catch (error) {
      logger.error('Error transferring evidence:', error);
      
      const response: APIResponse = {
        success: false,
        error: {
          code: 'TRANSFER_ERROR',
          message: 'Failed to transfer evidence',
        },
        timestamp: new Date(),
      };
      
      res.status(500).json(response);
    }
  }
);

/**
 * @swagger
 * /api/evidence/{id}/verify:
 *   post:
 *     summary: Verify evidence authenticity
 *     tags: [Evidence]
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
 *             required:
 *               - authenticityVerified
 *             properties:
 *               authenticityVerified:
 *                 type: boolean
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Evidence verification updated
 */
router.post('/:id/verify',
  validateRequest({ 
    params: { id: commonSchemas.uuid },
    body: evidenceSchemas.verify 
  }),
  requireRole(['legal_team', 'government_entity']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { authenticityVerified, notes } = req.body;

      const evidence = await database('evidence_items')
        .select('id')
        .where({ id: req.params.id })
        .first();

      if (!evidence) {
        const response: APIResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Evidence item not found',
          },
          timestamp: new Date(),
        };
        return res.status(404).json(response);
      }

      // Update verification status
      await database('evidence_items')
        .where({ id: req.params.id })
        .update({
          authenticityVerified,
          verifiedBy: req.user.id,
          verifiedAt: new Date(),
          notes: notes || null,
        });

      logSecurity('evidence_verification_updated', {
        evidenceId: req.params.id,
        authenticityVerified,
        verifiedBy: req.user.id,
        ip: req.ip,
      });

      const response: APIResponse = {
        success: true,
        data: {
          message: `Evidence ${authenticityVerified ? 'verified' : 'marked as unverified'} successfully`,
        },
        timestamp: new Date(),
      };

      res.json(response);
    } catch (error) {
      logger.error('Error updating evidence verification:', error);
      
      const response: APIResponse = {
        success: false,
        error: {
          code: 'VERIFICATION_ERROR',
          message: 'Failed to update evidence verification',
        },
        timestamp: new Date(),
      };
      
      res.status(500).json(response);
    }
  }
);

export default router;