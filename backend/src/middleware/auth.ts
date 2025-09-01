import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, User, UserPermission } from '../types';
import database from '../config/database';
import { logSecurity } from '../utils/logger';

/**
 * Middleware to require authentication
 */
export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check if user is authenticated (set by JWT middleware)
    if (!req.auth) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
        timestamp: new Date(),
      });
      return;
    }

    // Get user details from database
    const user = await database('users')
      .select('*')
      .where({ auth0Id: req.auth.sub })
      .first();

    if (!user || !user.isActive) {
      logSecurity('inactive_user_access_attempt', {
        auth0Id: req.auth.sub,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.status(401).json({
        success: false,
        error: {
          code: 'ACCOUNT_INACTIVE',
          message: 'User account is inactive',
        },
        timestamp: new Date(),
      });
      return;
    }

    // Update last login
    await database('users')
      .where({ id: user.id })
      .update({ lastLogin: new Date() });

    // Get user permissions
    const permissions = await database('user_permissions')
      .select('*')
      .where({ userId: user.id })
      .where('expiresAt', '>', new Date())
      .orWhereNull('expiresAt');

    req.user = user;
    req.permissions = permissions;

    next();
  } catch (error) {
    logSecurity('authentication_error', {
      error: (error as Error).message,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Authentication failed',
      },
      timestamp: new Date(),
    });
  }
};

/**
 * Role-based access control
 */
export const requireRole = (allowedRoles: string[]) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
        timestamp: new Date(),
      });
      return;
    }

    if (!allowedRoles.includes(req.user.roleType)) {
      logSecurity('role_access_denied', {
        userId: req.user.id,
        userRole: req.user.roleType,
        requiredRoles: allowedRoles,
        resource: req.path,
        ip: req.ip,
      });

      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_ROLE',
          message: 'Insufficient role permissions',
        },
        timestamp: new Date(),
      });
      return;
    }

    next();
  };
};

/**
 * Permission-based access control
 */
export const requirePermission = (permissionType: string, resourceId?: string) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user || !req.permissions) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
        timestamp: new Date(),
      });
      return;
    }

    // Check for permission
    const hasPermission = req.permissions.some(permission => {
      const typeMatch = permission.permissionType === permissionType;
      const resourceMatch = !resourceId || 
                          !permission.resourceId || 
                          permission.resourceId === resourceId;
      return typeMatch && resourceMatch;
    });

    if (!hasPermission) {
      logSecurity('permission_access_denied', {
        userId: req.user.id,
        userRole: req.user.roleType,
        requiredPermission: permissionType,
        resourceId: resourceId || req.params.id,
        resource: req.path,
        ip: req.ip,
      });

      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions for this action',
        },
        timestamp: new Date(),
      });
      return;
    }

    next();
  };
};

/**
 * Security level access control for stakeholders
 */
export const requireSecurityLevel = (minLevel: 'standard' | 'restricted' | 'high') => {
  const levels = { standard: 1, restricted: 2, high: 3 };

  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
        timestamp: new Date(),
      });
      return;
    }

    // Legal team and government entities have highest clearance
    if (['legal_team', 'government_entity'].includes(req.user.roleType)) {
      return next();
    }

    // Get resource if accessing specific stakeholder
    if (req.params.id) {
      try {
        const stakeholder = await database('stakeholders')
          .select('securityLevel')
          .where({ id: req.params.id })
          .first();

        if (stakeholder) {
          const requiredLevel = levels[minLevel];
          const resourceLevel = levels[stakeholder.securityLevel as keyof typeof levels];

          if (resourceLevel > requiredLevel) {
            logSecurity('security_level_access_denied', {
              userId: req.user.id,
              userRole: req.user.roleType,
              requiredLevel: minLevel,
              resourceLevel: stakeholder.securityLevel,
              stakeholderId: req.params.id,
              ip: req.ip,
            });

            res.status(403).json({
              success: false,
              error: {
                code: 'INSUFFICIENT_SECURITY_CLEARANCE',
                message: 'Insufficient security clearance for this resource',
              },
              timestamp: new Date(),
            });
            return;
          }
        }
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'SECURITY_CHECK_ERROR',
            message: 'Security level verification failed',
          },
          timestamp: new Date(),
        });
        return;
      }
    }

    next();
  };
};

/**
 * Document classification access control
 */
export const requireDocumentAccess = (minClassification: 'public' | 'internal' | 'confidential' | 'secret') => {
  const levels = { public: 1, internal: 2, confidential: 3, secret: 4 };

  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
        timestamp: new Date(),
      });
      return;
    }

    // Get user's maximum clearance level based on role
    let userClearance = 1; // public
    switch (req.user.roleType) {
      case 'legal_team':
      case 'government_entity':
        userClearance = 4; // secret
        break;
      case 'witness':
        userClearance = 3; // confidential
        break;
      case 'esop_participant':
        userClearance = 2; // internal
        break;
      case 'media_contact':
      case 'opposition':
        userClearance = 1; // public only
        break;
    }

    // Get document if accessing specific document
    if (req.params.id) {
      try {
        const document = await database('documents')
          .select('classification')
          .where({ id: req.params.id })
          .first();

        if (document) {
          const requiredLevel = levels[document.classification as keyof typeof levels];

          if (userClearance < requiredLevel) {
            logSecurity('document_access_denied', {
              userId: req.user.id,
              userRole: req.user.roleType,
              userClearance,
              requiredLevel,
              documentId: req.params.id,
              documentClassification: document.classification,
              ip: req.ip,
            });

            res.status(403).json({
              success: false,
              error: {
                code: 'INSUFFICIENT_DOCUMENT_CLEARANCE',
                message: 'Insufficient clearance for document classification',
              },
              timestamp: new Date(),
            });
            return;
          }
        }
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'DOCUMENT_ACCESS_CHECK_ERROR',
            message: 'Document access verification failed',
          },
          timestamp: new Date(),
        });
        return;
      }
    }

    next();
  };
};

/**
 * Check if user owns resource or has admin access
 */
export const requireOwnershipOrAdmin = (resourceTable: string, userField: string = 'created_by') => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
        timestamp: new Date(),
      });
      return;
    }

    // Admin roles have access to everything
    if (['legal_team', 'government_entity'].includes(req.user.roleType)) {
      return next();
    }

    if (!req.params.id) {
      return next(); // No specific resource to check
    }

    try {
      const resource = await database(resourceTable)
        .select(userField)
        .where({ id: req.params.id })
        .first();

      if (!resource) {
        res.status(404).json({
          success: false,
          error: {
            code: 'RESOURCE_NOT_FOUND',
            message: 'Resource not found',
          },
          timestamp: new Date(),
        });
        return;
      }

      if (resource[userField] !== req.user.id) {
        logSecurity('ownership_access_denied', {
          userId: req.user.id,
          resourceId: req.params.id,
          resourceTable,
          resourceOwner: resource[userField],
          ip: req.ip,
        });

        res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Access denied: insufficient permissions',
          },
          timestamp: new Date(),
        });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'OWNERSHIP_CHECK_ERROR',
          message: 'Ownership verification failed',
        },
        timestamp: new Date(),
      });
    }
  };
};