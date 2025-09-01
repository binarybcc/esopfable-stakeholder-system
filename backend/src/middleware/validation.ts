import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { APIResponse } from '../types';

export const validateRequest = (schema: {
  body?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: any[] = [];
    
    // Validate request body
    if (schema.body) {
      const { error } = schema.body.validate(req.body);
      if (error) {
        errors.push({
          type: 'body',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value,
          })),
        });
      }
    }
    
    // Validate request parameters
    if (schema.params) {
      const { error } = schema.params.validate(req.params);
      if (error) {
        errors.push({
          type: 'params',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value,
          })),
        });
      }
    }
    
    // Validate query parameters
    if (schema.query) {
      const { error } = schema.query.validate(req.query);
      if (error) {
        errors.push({
          type: 'query',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value,
          })),
        });
      }
    }
    
    // If validation errors exist, return them
    if (errors.length > 0) {
      const response: APIResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: errors,
        },
        timestamp: new Date(),
      };
      
      res.status(400).json(response);
      return;
    }
    
    next();
  };
};

// Common validation schemas
export const commonSchemas = {
  uuid: Joi.string().uuid().required(),
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  }),
  dateRange: Joi.object({
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().greater(Joi.ref('startDate')),
  }),
  search: Joi.object({
    q: Joi.string().min(1).max(200),
    filters: Joi.object(),
  }),
};

// Stakeholder validation schemas
export const stakeholderSchemas = {
  create: Joi.object({
    category: Joi.string().valid(
      'legal_team',
      'government_entities', 
      'esop_participants',
      'key_witnesses',
      'media_contacts',
      'opposition'
    ).required(),
    subcategory: Joi.string().max(100),
    name: Joi.string().min(1).max(255).required(),
    organization: Joi.string().max(255),
    title: Joi.string().max(255),
    contactInfo: Joi.object().required(),
    metadata: Joi.object(),
    securityLevel: Joi.string().valid('standard', 'restricted', 'high').default('standard'),
  }),
  update: Joi.object({
    category: Joi.string().valid(
      'legal_team',
      'government_entities', 
      'esop_participants',
      'key_witnesses',
      'media_contacts',
      'opposition'
    ),
    subcategory: Joi.string().max(100),
    name: Joi.string().min(1).max(255),
    organization: Joi.string().max(255),
    title: Joi.string().max(255),
    contactInfo: Joi.object(),
    metadata: Joi.object(),
    securityLevel: Joi.string().valid('standard', 'restricted', 'high'),
  }),
};

// Document validation schemas
export const documentSchemas = {
  create: Joi.object({
    title: Joi.string().min(1).max(500).required(),
    description: Joi.string(),
    classification: Joi.string().valid('public', 'internal', 'confidential', 'secret').required(),
  }),
  update: Joi.object({
    title: Joi.string().min(1).max(500),
    description: Joi.string(),
    classification: Joi.string().valid('public', 'internal', 'confidential', 'secret'),
  }),
};

// Communication validation schemas
export const communicationSchemas = {
  create: Joi.object({
    communicationType: Joi.string().valid('email', 'call', 'meeting', 'letter').required(),
    subject: Joi.string().max(500),
    summary: Joi.string(),
    participants: Joi.array().items(Joi.string().uuid()).min(1).required(),
    initiatedBy: Joi.string().uuid(),
    occurredAt: Joi.date().iso().required(),
    durationMinutes: Joi.number().integer().min(0),
    location: Joi.string().max(255),
    outcome: Joi.string(),
    followUpRequired: Joi.boolean().default(false),
    followUpDate: Joi.date().iso().when('followUpRequired', {
      is: true,
      then: Joi.required(),
    }),
    sensitiveContent: Joi.boolean().default(false),
  }),
};

// Task validation schemas
export const taskSchemas = {
  create: Joi.object({
    title: Joi.string().min(1).max(500).required(),
    description: Joi.string(),
    taskType: Joi.string().max(100),
    priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
    assignedTo: Joi.string().uuid(),
    dueDate: Joi.date().iso(),
    dependsOn: Joi.array().items(Joi.string().uuid()),
    stakeholderIds: Joi.array().items(Joi.string().uuid()),
    phase: Joi.string().max(100),
  }),
  update: Joi.object({
    title: Joi.string().min(1).max(500),
    description: Joi.string(),
    taskType: Joi.string().max(100),
    priority: Joi.string().valid('low', 'medium', 'high', 'critical'),
    status: Joi.string().valid('pending', 'in_progress', 'completed', 'blocked', 'cancelled'),
    assignedTo: Joi.string().uuid(),
    dueDate: Joi.date().iso(),
    dependsOn: Joi.array().items(Joi.string().uuid()),
    stakeholderIds: Joi.array().items(Joi.string().uuid()),
    phase: Joi.string().max(100),
  }),
};