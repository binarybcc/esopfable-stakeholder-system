import { Request, Response, NextFunction } from 'express';
import { ValidationError } from 'joi';
import { APIResponse } from '../types';
import logger, { logError, logSecurity } from '../utils/logger';

interface CustomError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
  isOperational?: boolean;
}

export const errorHandler = (
  error: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log error details
  logError(error, {
    url: req.url,
    method: req.method,
    userAgent: req.get('user-agent'),
    ip: req.ip,
    userId: (req as any).user?.id,
  });

  // Default error response
  let statusCode = error.statusCode || 500;
  let errorCode = error.code || 'INTERNAL_SERVER_ERROR';
  let message = error.message || 'An unexpected error occurred';
  let details = error.details;

  // Handle different error types
  if (error.name === 'ValidationError' || error instanceof ValidationError) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = (error as ValidationError).details?.map(detail => ({
      field: detail.path?.join('.'),
      message: detail.message,
      value: detail.context?.value,
    }));
  }

  // JWT errors
  if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
    message = 'Invalid or expired token';
    
    // Log potential security issue
    logSecurity('unauthorized_access_attempt', {
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      error: error.message,
    });
  }

  // Database errors
  if (error.code === '23505') { // PostgreSQL unique violation
    statusCode = 409;
    errorCode = 'DUPLICATE_RESOURCE';
    message = 'Resource already exists';
  }

  if (error.code === '23503') { // PostgreSQL foreign key violation
    statusCode = 400;
    errorCode = 'INVALID_REFERENCE';
    message = 'Referenced resource does not exist';
  }

  if (error.code === '23502') { // PostgreSQL not null violation
    statusCode = 400;
    errorCode = 'MISSING_REQUIRED_FIELD';
    message = 'Required field is missing';
  }

  // File upload errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    errorCode = 'FILE_TOO_LARGE';
    message = 'File size exceeds limit';
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
    errorCode = 'INVALID_FILE_FIELD';
    message = 'Unexpected file field';
  }

  // Rate limiting errors
  if (error.code === 'TOO_MANY_REQUESTS') {
    statusCode = 429;
    errorCode = 'RATE_LIMIT_EXCEEDED';
    message = 'Too many requests, please try again later';
  }

  // Permission errors
  if (error.code === 'FORBIDDEN') {
    statusCode = 403;
    errorCode = 'INSUFFICIENT_PERMISSIONS';
    message = 'Insufficient permissions to perform this action';
    
    logSecurity('permission_denied', {
      url: req.url,
      method: req.method,
      userId: (req as any).user?.id,
      ip: req.ip,
    });
  }

  // Encryption/security errors
  if (error.message?.includes('Encryption') || error.message?.includes('Decryption')) {
    statusCode = 500;
    errorCode = 'ENCRYPTION_ERROR';
    message = 'Security operation failed';
    details = undefined; // Don't expose encryption details
    
    logSecurity('encryption_error', {
      url: req.url,
      method: req.method,
      userId: (req as any).user?.id,
      ip: req.ip,
      error: error.message,
    });
  }

  // Don't expose internal details in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal server error';
    details = undefined;
  }

  const response: APIResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
      ...(details && { details }),
    },
    timestamp: new Date(),
  };

  res.status(statusCode).json(response);
};