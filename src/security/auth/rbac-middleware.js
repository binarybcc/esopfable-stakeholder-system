/**
 * Role-Based Access Control (RBAC) Middleware
 * Enforces permissions based on user roles and resource access patterns
 */

const { permissionSystem } = require('../permission-system');
const { jwtManager } = require('./jwt-manager');
const { auditLogger } = require('../../services/audit-service');
const { networkAcl } = require('../network-acl');

class RbacMiddleware {
  constructor() {
    this.permissionSystem = permissionSystem;
    this.jwtManager = jwtManager;
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Authentication middleware - verify JWT token
   */
  authenticate() {
    return async (req, res, next) => {
      try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({
            error: 'Authentication required',
            message: 'Please provide a valid access token'
          });
        }

        const token = authHeader.substring(7);
        
        // Verify token
        const decoded = await this.jwtManager.verifyAccessToken(token);
        
        // Attach user info to request
        req.user = {
          id: decoded.sub,
          email: decoded.email,
          roleType: decoded.roleType,
          organizationId: decoded.organizationId,
          clearanceLevel: decoded.clearanceLevel,
          permissions: decoded.permissions,
          sessionId: decoded.sessionId,
          tokenId: decoded.tokenId
        };

        // Get client IP
        const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];
        req.clientIP = clientIP;

        // Log authentication
        await auditLogger.log({
          action: 'authentication_success',
          userId: req.user.id,
          email: req.user.email,
          sessionId: req.user.sessionId,
          ipAddress: clientIP,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          timestamp: new Date().toISOString()
        });

        next();
      } catch (error) {
        console.error('Authentication failed:', error);
        
        await auditLogger.log({
          action: 'authentication_failed',
          error: error.message,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          timestamp: new Date().toISOString()
        });

        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid or expired token'
        });
      }
    };
  }

  /**
   * Authorization middleware - check permissions
   */
  authorize(resourceType, action, options = {}) {
    return async (req, res, next) => {
      try {
        const user = req.user;
        const clientIP = req.clientIP;

        if (!user) {
          return res.status(401).json({
            error: 'Authentication required',
            message: 'User not authenticated'
          });
        }

        // Network ACL check for sensitive resources
        if (options.requireNetworkAcl) {
          const aclType = this.getAclTypeForResource(resourceType, action);
          const networkAccess = await networkAcl.checkAccess(clientIP, user.roleType, aclType);
          
          if (!networkAccess) {
            await auditLogger.log({
              action: 'network_acl_denied',
              userId: user.id,
              email: user.email,
              resourceType: resourceType,
              requestedAction: action,
              clientIP: clientIP,
              timestamp: new Date().toISOString()
            });

            return res.status(403).json({
              error: 'Network access denied',
              message: 'Access from this network is not permitted'
            });
          }
        }

        // Get resource data if available
        let resourceData = null;
        if (options.getResourceData) {
          resourceData = await options.getResourceData(req);
        } else if (req.params.id || req.body) {
          resourceData = { id: req.params.id, ...req.body };
        }

        // Check permission
        const hasPermission = await this.permissionSystem.hasPermission(
          user, 
          resourceType, 
          action, 
          resourceData
        );

        if (!hasPermission) {
          await auditLogger.log({
            action: 'authorization_denied',
            userId: user.id,
            email: user.email,
            resourceType: resourceType,
            requestedAction: action,
            resourceId: resourceData?.id,
            clientIP: clientIP,
            timestamp: new Date().toISOString()
          });

          return res.status(403).json({
            error: 'Access denied',
            message: 'Insufficient permissions for this action'
          });
        }

        // Log successful authorization
        await auditLogger.log({
          action: 'authorization_granted',
          userId: user.id,
          email: user.email,
          resourceType: resourceType,
          requestedAction: action,
          resourceId: resourceData?.id,
          clientIP: clientIP,
          timestamp: new Date().toISOString()
        });

        next();
      } catch (error) {
        console.error('Authorization failed:', error);
        
        await auditLogger.log({
          action: 'authorization_error',
          userId: req.user?.id,
          email: req.user?.email,
          resourceType: resourceType,
          requestedAction: action,
          error: error.message,
          clientIP: req.clientIP,
          timestamp: new Date().toISOString()
        });

        return res.status(500).json({
          error: 'Authorization check failed',
          message: 'Please try again later'
        });
      }
    };
  }

  /**
   * Role-based access middleware
   */
  requireRole(allowedRoles) {
    return (req, res, next) => {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'User not authenticated'
        });
      }

      const userRole = user.roleType;
      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

      if (!roles.includes(userRole)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Insufficient role permissions'
        });
      }

      next();
    };
  }

  /**
   * Clearance level middleware for classified data
   */
  requireClearance(requiredLevel) {
    return (req, res, next) => {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'User not authenticated'
        });
      }

      const clearanceLevels = {
        'public': 0,
        'internal': 1,
        'confidential': 2,
        'secret': 3,
        'top_secret': 4
      };

      const userLevel = clearanceLevels[user.clearanceLevel] || 0;
      const requiredLevelValue = clearanceLevels[requiredLevel] || 0;

      if (userLevel < requiredLevelValue) {
        await auditLogger.log({
          action: 'clearance_denied',
          userId: user.id,
          email: user.email,
          userClearance: user.clearanceLevel,
          requiredClearance: requiredLevel,
          clientIP: req.clientIP,
          timestamp: new Date().toISOString()
        });

        return res.status(403).json({
          error: 'Insufficient clearance level',
          message: 'Higher security clearance required'
        });
      }

      next();
    };
  }

  /**
   * Organization-based access middleware
   */
  requireOrganization(allowedOrgs) {
    return (req, res, next) => {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'User not authenticated'
        });
      }

      const orgs = Array.isArray(allowedOrgs) ? allowedOrgs : [allowedOrgs];

      if (!orgs.includes(user.organizationId)) {
        return res.status(403).json({
          error: 'Organization access denied',
          message: 'Access restricted to authorized organizations'
        });
      }

      next();
    };
  }

  /**
   * Dynamic permission middleware with custom logic
   */
  checkPermission(permissionCheck) {
    return async (req, res, next) => {
      try {
        const user = req.user;

        if (!user) {
          return res.status(401).json({
            error: 'Authentication required',
            message: 'User not authenticated'
          });
        }

        const hasPermission = await permissionCheck(user, req, res);

        if (!hasPermission) {
          return res.status(403).json({
            error: 'Access denied',
            message: 'Custom permission check failed'
          });
        }

        next();
      } catch (error) {
        console.error('Dynamic permission check failed:', error);
        return res.status(500).json({
          error: 'Permission check failed',
          message: 'Please try again later'
        });
      }
    };
  }

  /**
   * Multi-factor authentication requirement
   */
  requireMfa() {
    return async (req, res, next) => {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'User not authenticated'
        });
      }

      // Check if MFA is required for this user's role
      const mfaRequiredRoles = ['legal_team', 'government_entity'];
      
      if (mfaRequiredRoles.includes(user.roleType)) {
        const mfaHeader = req.headers['x-mfa-token'];
        
        if (!mfaHeader) {
          return res.status(403).json({
            error: 'MFA required',
            message: 'Multi-factor authentication token required',
            requiresMfa: true
          });
        }

        // Verify MFA token (simplified - would integrate with actual MFA service)
        const isMfaValid = await this.verifyMfaToken(user.id, mfaHeader);
        
        if (!isMfaValid) {
          await auditLogger.log({
            action: 'mfa_failed',
            userId: user.id,
            email: user.email,
            clientIP: req.clientIP,
            timestamp: new Date().toISOString()
          });

          return res.status(403).json({
            error: 'Invalid MFA token',
            message: 'Multi-factor authentication failed'
          });
        }
      }

      next();
    };
  }

  /**
   * Get ACL type based on resource and action
   */
  getAclTypeForResource(resourceType, action) {
    // Map resource types to ACL levels
    const resourceAclMap = {
      'witness_data': 'witness',
      'classified_documents': 'secret',
      'confidential_communications': 'confidential',
      'stakeholder_pii': 'confidential'
    };

    return resourceAclMap[resourceType] || 'default';
  }

  /**
   * Verify MFA token (mock implementation)
   */
  async verifyMfaToken(userId, token) {
    // This would integrate with your MFA provider (TOTP, SMS, etc.)
    // For now, we'll return true to allow testing
    return true;
  }

  /**
   * Rate limiting based on user role and action
   */
  rateLimitByRole(config = {}) {
    const limits = {
      'legal_team': { requests: 1000, window: 3600 }, // 1000/hour
      'government_entity': { requests: 500, window: 3600 }, // 500/hour
      'esop_participant': { requests: 100, window: 3600 }, // 100/hour
      'media_contact': { requests: 50, window: 3600 }, // 50/hour
      'opposition': { requests: 25, window: 3600 }, // 25/hour
      ...config
    };

    return async (req, res, next) => {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({
          error: 'Authentication required'
        });
      }

      const roleLimit = limits[user.roleType] || limits['opposition'];
      const key = `rate_limit:${user.roleType}:${user.id}`;
      
      try {
        // Simple in-memory rate limiting (use Redis in production)
        const current = this.cache.get(key) || { count: 0, reset: Date.now() + (roleLimit.window * 1000) };
        
        if (Date.now() > current.reset) {
          current.count = 0;
          current.reset = Date.now() + (roleLimit.window * 1000);
        }

        if (current.count >= roleLimit.requests) {
          await auditLogger.log({
            action: 'rate_limit_exceeded',
            userId: user.id,
            email: user.email,
            roleType: user.roleType,
            clientIP: req.clientIP,
            timestamp: new Date().toISOString()
          });

          return res.status(429).json({
            error: 'Rate limit exceeded',
            message: 'Too many requests',
            retryAfter: Math.ceil((current.reset - Date.now()) / 1000)
          });
        }

        current.count++;
        this.cache.set(key, current);
        
        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': roleLimit.requests,
          'X-RateLimit-Remaining': roleLimit.requests - current.count,
          'X-RateLimit-Reset': Math.ceil(current.reset / 1000)
        });

        next();
      } catch (error) {
        console.error('Rate limiting failed:', error);
        next(); // Continue on rate limiting errors
      }
    };
  }
}

// Create singleton instance
const rbacMiddleware = new RbacMiddleware();

module.exports = {
  RbacMiddleware,
  rbacMiddleware
};