import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, AuditLog } from '../types';
import { logAudit } from '../utils/logger';
import database from '../config/database';

export const auditLogger = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Skip audit logging for GET requests (read operations)
  if (req.method === 'GET') {
    return next();
  }
  
  // Skip health check and documentation endpoints
  const skipPaths = ['/api/health', '/api-docs'];
  if (skipPaths.some(path => req.path.startsWith(path))) {
    return next();
  }
  
  // Capture original response data
  const originalSend = res.send;
  let responseBody: any;
  
  res.send = function(body) {
    responseBody = body;
    return originalSend.call(this, body);
  };
  
  // Continue with request processing
  next();
  
  // Log audit entry after response is sent
  res.on('finish', async () => {
    try {
      // Extract resource information from URL
      const urlParts = req.path.split('/');
      const resourceType = urlParts[2]; // e.g., 'stakeholders', 'documents'
      const resourceId = urlParts[3]; // specific resource ID if present
      
      const auditData: Partial<AuditLog> = {
        userId: req.user?.id,
        action: `${req.method}_${resourceType}`,
        resourceType,
        resourceId,
        oldValues: req.method === 'PUT' || req.method === 'PATCH' ? req.body.oldValues : undefined,
        newValues: req.method !== 'DELETE' ? req.body : undefined,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        sessionId: req.get('authorization')?.substring(0, 10), // First 10 chars of token for session tracking
      };
      
      // Save to database
      await database('audit_logs').insert({
        ...auditData,
        id: database.raw('gen_random_uuid()'),
        timestamp: new Date(),
      });
      
      // Also log to file
      logAudit(auditData.action!, resourceType, req.user?.id || 'anonymous', {
        resourceId,
        statusCode: res.statusCode,
        success: res.statusCode < 400,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
      
    } catch (error) {
      // Don't fail the request if audit logging fails
      console.error('Audit logging failed:', error);
    }
  });
};