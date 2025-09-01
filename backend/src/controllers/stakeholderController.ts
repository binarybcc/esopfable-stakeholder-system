import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import database from '../config/database';
import logger from '../utils/logger';
import { StakeholderCategory, StakeholderType, CreateStakeholderRequest, UpdateStakeholderRequest } from '../types';

export class StakeholderController {
  /**
   * Get all stakeholders with filtering and pagination
   */
  async getAllStakeholders(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        category,
        type,
        page = 1,
        limit = 50,
        search,
        sort_by = 'created_at',
        sort_order = 'desc'
      } = req.query;

      let query = database('stakeholders')
        .select(
          'id',
          'name',
          'category',
          'type',
          'contact_info',
          'role',
          'engagement_status',
          'metadata',
          'created_at',
          'updated_at'
        );

      // Apply filters
      if (category) {
        query = query.where('category', category as string);
      }
      
      if (type) {
        query = query.where('type', type as string);
      }

      if (search) {
        query = query.where(function() {
          this.where('name', 'ilike', `%${search}%`)
              .orWhere('role', 'ilike', `%${search}%`)
              .orWhere('contact_info->\'email\'', 'ilike', `%${search}%`);
        });
      }

      // Count total for pagination
      const totalQuery = query.clone();
      const [{ count }] = await totalQuery.count('* as count');
      const total = parseInt(count as string);

      // Apply pagination and sorting
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      query = query
        .orderBy(sort_by as string, sort_order as string)
        .limit(parseInt(limit as string))
        .offset(offset);

      const stakeholders = await query;

      res.json({
        success: true,
        data: {
          stakeholders,
          pagination: {
            page: parseInt(page as string),
            limit: parseInt(limit as string),
            total,
            pages: Math.ceil(total / parseInt(limit as string))
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching stakeholders:', error);
      next(error);
    }
  }

  /**
   * Get stakeholder by ID
   */
  async getStakeholderById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const stakeholder = await database('stakeholders')
        .where('id', id)
        .first();

      if (!stakeholder) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'STAKEHOLDER_NOT_FOUND',
            message: 'Stakeholder not found'
          }
        });
      }

      // Get related communications
      const communications = await database('communications')
        .where('stakeholder_id', id)
        .orderBy('created_at', 'desc')
        .limit(10);

      // Get related documents
      const documents = await database('document_access_log')
        .join('documents', 'document_access_log.document_id', 'documents.id')
        .where('document_access_log.user_id', id)
        .select(
          'documents.id',
          'documents.title',
          'documents.type',
          'document_access_log.access_type',
          'document_access_log.accessed_at'
        )
        .orderBy('document_access_log.accessed_at', 'desc')
        .limit(10);

      res.json({
        success: true,
        data: {
          stakeholder,
          related_data: {
            communications,
            recent_document_access: documents
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching stakeholder:', error);
      next(error);
    }
  }

  /**
   * Create new stakeholder
   */
  async createStakeholder(req: Request, res: Response, next: NextFunction) {
    try {
      // Check for validation errors
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

      const stakeholderData: CreateStakeholderRequest = req.body;
      const userId = req.user?.id;

      const trx = await database.transaction();
      
      try {
        const [stakeholder] = await trx('stakeholders')
          .insert({
            ...stakeholderData,
            created_by: userId,
            updated_by: userId,
            created_at: new Date(),
            updated_at: new Date()
          })
          .returning('*');

        // Log the creation in audit trail
        await trx('audit_logs').insert({
          table_name: 'stakeholders',
          record_id: stakeholder.id,
          action: 'CREATE',
          old_values: null,
          new_values: JSON.stringify(stakeholder),
          user_id: userId,
          timestamp: new Date(),
          ip_address: req.ip
        });

        await trx.commit();

        // Emit real-time update
        req.app.get('socketio').emit('stakeholder:created', {
          stakeholder,
          created_by: userId
        });

        res.status(201).json({
          success: true,
          data: { stakeholder },
          message: 'Stakeholder created successfully'
        });
      } catch (innerError) {
        await trx.rollback();
        throw innerError;
      }
    } catch (error) {
      logger.error('Error creating stakeholder:', error);
      next(error);
    }
  }

  /**
   * Update existing stakeholder
   */
  async updateStakeholder(req: Request, res: Response, next: NextFunction) {
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
      const updateData: UpdateStakeholderRequest = req.body;
      const userId = req.user?.id;

      const trx = await database.transaction();
      
      try {
        // Get current record for audit
        const oldRecord = await trx('stakeholders')
          .where('id', id)
          .first();

        if (!oldRecord) {
          await trx.rollback();
          return res.status(404).json({
            success: false,
            error: {
              code: 'STAKEHOLDER_NOT_FOUND',
              message: 'Stakeholder not found'
            }
          });
        }

        const [updatedStakeholder] = await trx('stakeholders')
          .where('id', id)
          .update({
            ...updateData,
            updated_by: userId,
            updated_at: new Date()
          })
          .returning('*');

        // Log the update in audit trail
        await trx('audit_logs').insert({
          table_name: 'stakeholders',
          record_id: id,
          action: 'UPDATE',
          old_values: JSON.stringify(oldRecord),
          new_values: JSON.stringify(updatedStakeholder),
          user_id: userId,
          timestamp: new Date(),
          ip_address: req.ip
        });

        await trx.commit();

        // Emit real-time update
        req.app.get('socketio').emit('stakeholder:updated', {
          stakeholder: updatedStakeholder,
          updated_by: userId
        });

        res.json({
          success: true,
          data: { stakeholder: updatedStakeholder },
          message: 'Stakeholder updated successfully'
        });
      } catch (innerError) {
        await trx.rollback();
        throw innerError;
      }
    } catch (error) {
      logger.error('Error updating stakeholder:', error);
      next(error);
    }
  }

  /**
   * Delete stakeholder (soft delete)
   */
  async deleteStakeholder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const trx = await database.transaction();
      
      try {
        const stakeholder = await trx('stakeholders')
          .where('id', id)
          .first();

        if (!stakeholder) {
          await trx.rollback();
          return res.status(404).json({
            success: false,
            error: {
              code: 'STAKEHOLDER_NOT_FOUND',
              message: 'Stakeholder not found'
            }
          });
        }

        // Soft delete
        await trx('stakeholders')
          .where('id', id)
          .update({
            deleted_at: new Date(),
            updated_by: userId,
            updated_at: new Date()
          });

        // Log the deletion in audit trail
        await trx('audit_logs').insert({
          table_name: 'stakeholders',
          record_id: id,
          action: 'DELETE',
          old_values: JSON.stringify(stakeholder),
          new_values: JSON.stringify({ deleted_at: new Date() }),
          user_id: userId,
          timestamp: new Date(),
          ip_address: req.ip
        });

        await trx.commit();

        // Emit real-time update
        req.app.get('socketio').emit('stakeholder:deleted', {
          stakeholder_id: id,
          deleted_by: userId
        });

        res.json({
          success: true,
          message: 'Stakeholder deleted successfully'
        });
      } catch (innerError) {
        await trx.rollback();
        throw innerError;
      }
    } catch (error) {
      logger.error('Error deleting stakeholder:', error);
      next(error);
    }
  }

  /**
   * Get stakeholders by category
   */
  async getStakeholdersByCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { category } = req.params;

      if (!Object.values(StakeholderCategory).includes(category as StakeholderCategory)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CATEGORY',
            message: 'Invalid stakeholder category'
          }
        });
      }

      const stakeholders = await database('stakeholders')
        .where('category', category)
        .whereNull('deleted_at')
        .orderBy('name', 'asc');

      res.json({
        success: true,
        data: {
          category,
          stakeholders,
          count: stakeholders.length
        }
      });
    } catch (error) {
      logger.error('Error fetching stakeholders by category:', error);
      next(error);
    }
  }

  /**
   * Get stakeholder relationship map
   */
  async getStakeholderRelationships(req: Request, res: Response, next: NextFunction) {
    try {
      const relationships = await database('stakeholder_relationships')
        .join('stakeholders as s1', 'stakeholder_relationships.stakeholder_id', 's1.id')
        .join('stakeholders as s2', 'stakeholder_relationships.related_stakeholder_id', 's2.id')
        .select(
          's1.id as stakeholder_id',
          's1.name as stakeholder_name',
          's1.category as stakeholder_category',
          's2.id as related_stakeholder_id',
          's2.name as related_stakeholder_name',
          's2.category as related_stakeholder_category',
          'stakeholder_relationships.relationship_type',
          'stakeholder_relationships.strength'
        );

      // Group by stakeholder for easier frontend consumption
      const relationshipMap = relationships.reduce((acc, rel) => {
        if (!acc[rel.stakeholder_id]) {
          acc[rel.stakeholder_id] = {
            id: rel.stakeholder_id,
            name: rel.stakeholder_name,
            category: rel.stakeholder_category,
            relationships: []
          };
        }
        
        acc[rel.stakeholder_id].relationships.push({
          id: rel.related_stakeholder_id,
          name: rel.related_stakeholder_name,
          category: rel.related_stakeholder_category,
          type: rel.relationship_type,
          strength: rel.strength
        });
        
        return acc;
      }, {} as Record<string, any>);

      res.json({
        success: true,
        data: {
          relationships: Object.values(relationshipMap)
        }
      });
    } catch (error) {
      logger.error('Error fetching stakeholder relationships:', error);
      next(error);
    }
  }
}