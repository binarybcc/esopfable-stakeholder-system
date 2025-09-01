import express from 'express';
import { AuthenticatedRequest, APIResponse, Communication } from '../types';
import database from '../config/database';
import { requireAuth, requireRole } from '../middleware/auth';
import { validateRequest, communicationSchemas, commonSchemas } from '../middleware/validation';
import logger, { logSecurity } from '../utils/logger';

const router = express.Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * @swagger
 * components:
 *   schemas:
 *     Communication:
 *       type: object
 *       required:
 *         - communicationType
 *         - participants
 *         - occurredAt
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         communicationType:
 *           type: string
 *           enum: [email, call, meeting, letter]
 *         subject:
 *           type: string
 *         summary:
 *           type: string
 *         participants:
 *           type: array
 *           items:
 *             type: string
 *             format: uuid
 *         initiatedBy:
 *           type: string
 *           format: uuid
 *         occurredAt:
 *           type: string
 *           format: date-time
 *         durationMinutes:
 *           type: integer
 *         location:
 *           type: string
 *         outcome:
 *           type: string
 *         followUpRequired:
 *           type: boolean
 *         followUpDate:
 *           type: string
 *           format: date-time
 *         sensitiveContent:
 *           type: boolean
 *         createdBy:
 *           type: string
 *           format: uuid
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/communications:
 *   get:
 *     summary: Get all communications with filtering
 *     tags: [Communications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: communicationType
 *         schema:
 *           type: string
 *           enum: [email, call, meeting, letter]
 *       - in: query
 *         name: sensitive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: followUpRequired
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: List of communications
 */
router.get('/',
  validateRequest({ query: commonSchemas.pagination }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const {
        communicationType,
        sensitive,
        followUpRequired,
        startDate,
        endDate,
        page = 1,
        limit = 20,
        sortBy = 'occurredAt',
        sortOrder = 'desc'
      } = req.query;

      let query = database('communications')
        .leftJoin('stakeholders as initiators', 'communications.initiated_by', 'initiators.id')
        .leftJoin('users as creators', 'communications.created_by', 'creators.id')
        .select([
          'communications.*',
          'initiators.name as initiator_name',
          'creators.email as creator_email',
          'creators.first_name as creator_first_name',
          'creators.last_name as creator_last_name'
        ]);

      // Apply filters
      if (communicationType) {
        query = query.where('communications.communication_type', communicationType as string);
      }

      if (sensitive !== undefined) {
        query = query.where('communications.sensitive_content', sensitive === 'true');
      }

      if (followUpRequired !== undefined) {
        query = query.where('communications.follow_up_required', followUpRequired === 'true');
      }

      if (startDate) {
        query = query.where('communications.occurred_at', '>=', new Date(startDate as string));
      }

      if (endDate) {
        query = query.where('communications.occurred_at', '<=', new Date(endDate as string));
      }

      // Security filtering - limit access based on user role
      if (!['legal_team', 'government_entity'].includes(req.user.roleType)) {
        // Non-admin users can't see sensitive communications
        query = query.where('communications.sensitive_content', false);
        
        // Users can only see communications they are involved in
        const userStakeholder = await database('stakeholders')
          .select('id')
          .where({ user_id: req.user.id })
          .first();
        
        if (userStakeholder) {
          query = query.whereRaw(
            "? = ANY(communications.participants::uuid[])", 
            [userStakeholder.id]
          );
        } else {
          // If no stakeholder record, user can't see any communications
          query = query.where('1', '0'); // Always false condition
        }
      }

      // Get total count
      const totalQuery = query.clone()
        .clearSelect()
        .clearOrder()
        .count('communications.id as count');
      
      const [{ count }] = await totalQuery;
      const total = parseInt(count as string);

      // Apply pagination and sorting
      const offset = (Number(page) - 1) * Number(limit);
      query = query
        .orderBy(`communications.${sortBy}`, sortOrder as 'asc' | 'desc')
        .limit(Number(limit))
        .offset(offset);

      const communications = await query;

      // Enhance with participant details
      const enhancedCommunications = await Promise.all(
        communications.map(async (comm: any) => {
          // Get participant details
          const participantIds = typeof comm.participants === 'string' ?
            JSON.parse(comm.participants) : comm.participants;

          const participants = await database('stakeholders')
            .select('id', 'name', 'organization')
            .whereIn('id', participantIds);

          return {
            ...comm,
            participants: participantIds,
            participantDetails: participants,
            initiator: comm.initiator_name ? {
              name: comm.initiator_name
            } : null,
            creator: {
              email: comm.creator_email,
              firstName: comm.creator_first_name,
              lastName: comm.creator_last_name
            }
          };
        })
      );

      const response: APIResponse = {
        success: true,
        data: enhancedCommunications,
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
      logger.error('Error fetching communications:', error);
      
      const response: APIResponse = {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch communications',
        },
        timestamp: new Date(),
      };
      
      res.status(500).json(response);
    }
  }
);

/**
 * @swagger
 * /api/communications/{id}:
 *   get:
 *     summary: Get a specific communication
 *     tags: [Communications]
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
 *         description: Communication details
 */
router.get('/:id',
  validateRequest({ params: { id: commonSchemas.uuid } }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const communication = await database('communications')
        .leftJoin('stakeholders as initiators', 'communications.initiated_by', 'initiators.id')
        .leftJoin('users as creators', 'communications.created_by', 'creators.id')
        .select([
          'communications.*',
          'initiators.name as initiator_name',
          'creators.email as creator_email',
          'creators.first_name as creator_first_name',
          'creators.last_name as creator_last_name'
        ])
        .where('communications.id', req.params.id)
        .first();

      if (!communication) {
        const response: APIResponse = {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Communication not found',
          },
          timestamp: new Date(),
        };
        return res.status(404).json(response);
      }

      // Security check - non-admin users need to be participants
      if (!['legal_team', 'government_entity'].includes(req.user.roleType)) {
        if (communication.sensitive_content) {
          const response: APIResponse = {
            success: false,
            error: {
              code: 'ACCESS_DENIED',
              message: 'Access denied to sensitive communication',
            },
            timestamp: new Date(),
          };
          return res.status(403).json(response);
        }

        const userStakeholder = await database('stakeholders')
          .select('id')
          .where({ user_id: req.user.id })
          .first();
        
        if (userStakeholder) {
          const participantIds = typeof communication.participants === 'string' ?
            JSON.parse(communication.participants) : communication.participants;
          
          if (!participantIds.includes(userStakeholder.id)) {
            const response: APIResponse = {
              success: false,
              error: {
                code: 'ACCESS_DENIED',
                message: 'Access denied - not a participant in this communication',
              },
              timestamp: new Date(),
            };
            return res.status(403).json(response);
          }
        }
      }

      // Get participant details
      const participantIds = typeof communication.participants === 'string' ?
        JSON.parse(communication.participants) : communication.participants;

      const participants = await database('stakeholders')
        .select('id', 'name', 'organization', 'title')
        .whereIn('id', participantIds);

      // Get attachments
      const attachments = await database('communication_attachments')
        .leftJoin('documents', 'communication_attachments.document_id', 'documents.id')
        .select([
          'communication_attachments.*',
          'documents.title as document_title',
          'documents.classification as document_classification'
        ])
        .where('communication_attachments.communication_id', req.params.id);

      logSecurity('communication_accessed', {
        communicationId: communication.id,
        communicationType: communication.communication_type,
        sensitiveContent: communication.sensitive_content,
        userId: req.user.id,
        userRole: req.user.roleType,
        ip: req.ip,
      });

      const enhancedCommunication = {
        ...communication,
        participants: participantIds,
        participantDetails: participants,
        attachments,
        initiator: communication.initiator_name ? {
          name: communication.initiator_name
        } : null,
        creator: {
          email: communication.creator_email,
          firstName: communication.creator_first_name,
          lastName: communication.creator_last_name
        }
      };

      const response: APIResponse = {
        success: true,
        data: enhancedCommunication,
        timestamp: new Date(),
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching communication:', error);
      
      const response: APIResponse = {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch communication',
        },
        timestamp: new Date(),
      };
      
      res.status(500).json(response);
    }
  }
);

/**
 * @swagger
 * /api/communications:
 *   post:
 *     summary: Create a new communication record
 *     tags: [Communications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - communicationType
 *               - participants
 *               - occurredAt
 *             properties:
 *               communicationType:
 *                 type: string
 *                 enum: [email, call, meeting, letter]
 *               subject:
 *                 type: string
 *               summary:
 *                 type: string
 *               participants:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *               initiatedBy:
 *                 type: string
 *                 format: uuid
 *               occurredAt:
 *                 type: string
 *                 format: date-time
 *               durationMinutes:
 *                 type: integer
 *               location:
 *                 type: string
 *               outcome:
 *                 type: string
 *               followUpRequired:
 *                 type: boolean
 *               followUpDate:
 *                 type: string
 *                 format: date-time
 *               sensitiveContent:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Communication created successfully
 */
router.post('/',
  requireRole(['legal_team', 'government_entity', 'witness']),
  validateRequest({ body: communicationSchemas.create }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const {
        communicationType,
        subject,
        summary,
        participants,
        initiatedBy,
        occurredAt,
        durationMinutes,
        location,
        outcome,
        followUpRequired,
        followUpDate,
        sensitiveContent
      } = req.body;

      // Validate all participants exist
      const existingParticipants = await database('stakeholders')
        .select('id')
        .whereIn('id', participants);

      if (existingParticipants.length !== participants.length) {
        const response: APIResponse = {
          success: false,
          error: {
            code: 'INVALID_PARTICIPANTS',
            message: 'One or more participants not found',
          },
          timestamp: new Date(),
        };
        return res.status(400).json(response);
      }

      // Validate initiator if provided
      if (initiatedBy) {
        const initiator = await database('stakeholders')
          .select('id')
          .where({ id: initiatedBy })
          .first();

        if (!initiator) {
          const response: APIResponse = {
            success: false,
            error: {
              code: 'INVALID_INITIATOR',
              message: 'Initiator not found',
            },
            timestamp: new Date(),
          };
          return res.status(400).json(response);
        }
      }

      // Create communication record
      const [communicationId] = await database('communications').insert({
        communicationType,
        subject: subject || null,
        summary: summary || null,
        participants: JSON.stringify(participants),
        initiatedBy: initiatedBy || null,
        occurredAt: new Date(occurredAt),
        durationMinutes: durationMinutes || null,
        location: location || null,
        outcome: outcome || null,
        followUpRequired: followUpRequired || false,
        followUpDate: followUpDate ? new Date(followUpDate) : null,
        sensitiveContent: sensitiveContent || false,
        createdBy: req.user.id,
      }).returning('id');

      logSecurity('communication_created', {
        communicationId,
        communicationType,
        participantCount: participants.length,
        sensitiveContent: sensitiveContent || false,
        createdBy: req.user.id,
        ip: req.ip,
      });

      const response: APIResponse = {
        success: true,
        data: {
          id: communicationId,
          message: 'Communication record created successfully',
        },
        timestamp: new Date(),
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error('Error creating communication:', error);
      
      const response: APIResponse = {
        success: false,
        error: {
          code: 'CREATE_ERROR',
          message: 'Failed to create communication record',
        },
        timestamp: new Date(),
      };
      
      res.status(500).json(response);
    }
  }
);

/**
 * @swagger
 * /api/communications/{id}/attachments:
 *   post:
 *     summary: Add document attachments to a communication
 *     tags: [Communications]
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
 *               - documentIds
 *             properties:
 *               documentIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *     responses:
 *       200:
 *         description: Attachments added successfully
 */
router.post('/:id/attachments',
  validateRequest({ params: { id: commonSchemas.uuid } }),
  requireRole(['legal_team', 'government_entity']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { documentIds } = req.body;

      if (!Array.isArray(documentIds) || documentIds.length === 0) {
        const response: APIResponse = {
          success: false,
          error: {
            code: 'INVALID_DOCUMENT_IDS',
            message: 'Document IDs must be a non-empty array',
          },
          timestamp: new Date(),
        };
        return res.status(400).json(response);
      }

      // Verify communication exists
      const communication = await database('communications')
        .select('id')
        .where({ id: req.params.id })
        .first();

      if (!communication) {
        const response: APIResponse = {
          success: false,
          error: {
            code: 'COMMUNICATION_NOT_FOUND',
            message: 'Communication not found',
          },
          timestamp: new Date(),
        };
        return res.status(404).json(response);
      }

      // Verify all documents exist
      const existingDocuments = await database('documents')
        .select('id')
        .whereIn('id', documentIds);

      if (existingDocuments.length !== documentIds.length) {
        const response: APIResponse = {
          success: false,
          error: {
            code: 'INVALID_DOCUMENTS',
            message: 'One or more documents not found',
          },
          timestamp: new Date(),
        };
        return res.status(400).json(response);
      }

      // Add attachments (ignore duplicates)
      const attachmentData = documentIds.map(documentId => ({
        communicationId: req.params.id,
        documentId,
      }));

      await database('communication_attachments')
        .insert(attachmentData)
        .onConflict(['communication_id', 'document_id'])
        .ignore();

      logSecurity('communication_attachments_added', {
        communicationId: req.params.id,
        documentIds,
        addedBy: req.user.id,
        ip: req.ip,
      });

      const response: APIResponse = {
        success: true,
        data: {
          message: 'Attachments added successfully',
        },
        timestamp: new Date(),
      };

      res.json(response);
    } catch (error) {
      logger.error('Error adding communication attachments:', error);
      
      const response: APIResponse = {
        success: false,
        error: {
          code: 'ATTACHMENT_ERROR',
          message: 'Failed to add attachments',
        },
        timestamp: new Date(),
      };
      
      res.status(500).json(response);
    }
  }
);

export default router;