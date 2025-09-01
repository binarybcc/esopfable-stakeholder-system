/**
 * Authentication Middleware
 * Comprehensive JWT validation and role-based access control
 */

const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const { auth0Config, ROLES, CLASSIFICATION_LEVELS } = require('../../config/auth/auth0-config');
const { auditLogger } = require('../services/audit-service');
const { NetworkAcl } = require('../security/network-acl');
const { promisify } = require('util');

class AuthenticationMiddleware {
  constructor() {
    this.jwksClient = jwksClient({
      jwksUri: `https://${auth0Config.domain}/.well-known/jwks.json`,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 600000 // 10 minutes
    });
    
    this.networkAcl = new NetworkAcl(auth0Config.networkAcl);
    this.getSigningKey = promisify(this.jwksClient.getSigningKey);
  }

  /**
   * Verify JWT token and extract user information
   */
  async verifyToken(req, res, next) {
    try {
      const token = this.extractToken(req);
      if (!token) {
        return this.unauthorizedResponse(res, 'No token provided');
      }

      // Decode token header to get kid
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || !decoded.header.kid) {
        return this.unauthorizedResponse(res, 'Invalid token format');
      }

      // Get signing key
      const key = await this.getSigningKey(decoded.header.kid);
      const signingKey = key.publicKey || key.rsaPublicKey;

      // Verify token
      const payload = jwt.verify(token, signingKey, {
        audience: auth0Config.audience,
        issuer: `https://${auth0Config.domain}/`,
        algorithms: ['RS256']
      });

      // Extract user information
      const namespace = auth0Config.customClaimsNamespace;
      req.user = {
        sub: payload.sub,
        email: payload.email,
        roles: payload[`${namespace}roles`] || [],
        roleType: payload[`${namespace}role_type`],
        securityLevel: payload[`${namespace}security_level`] || 'standard',
        userMetadata: payload[`${namespace}user_metadata`] || {},
        appMetadata: payload[`${namespace}app_metadata`] || {},
        permissions: payload.permissions || []
      };

      // Log authentication success
      await auditLogger.logAuth({
        action: 'token_verification_success',
        userId: req.user.sub,
        email: req.user.email,
        roleType: req.user.roleType,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      next();
    } catch (error) {
      console.error('Token verification failed:', error);
      
      await auditLogger.logAuth({
        action: 'token_verification_failed',
        error: error.message,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return this.unauthorizedResponse(res, 'Invalid token');
    }
  }

  /**
   * Require authentication - must have valid token
   */
  requireAuth() {
    return async (req, res, next) => {
      await this.verifyToken(req, res, next);
    };
  }

  /**
   * Require specific roles
   */
  requireRoles(allowedRoles) {
    return async (req, res, next) => {
      if (!req.user) {
        return this.unauthorizedResponse(res, 'Authentication required');
      }

      const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.roleType];
      const hasRequiredRole = allowedRoles.some(role => userRoles.includes(role));

      if (!hasRequiredRole) {
        await auditLogger.logAuth({
          action: 'insufficient_permissions',
          userId: req.user.sub,
          email: req.user.email,
          requiredRoles: allowedRoles,
          userRoles: userRoles,
          ip: req.ip
        });

        return this.forbiddenResponse(res, 'Insufficient permissions');
      }

      next();
    };
  }

  /**
   * Require specific document classification access
   */
  requireDocumentAccess(classificationLevel) {
    return async (req, res, next) => {
      if (!req.user) {
        return this.unauthorizedResponse(res, 'Authentication required');
      }

      const userRole = req.user.roleType;
      const allowedClassifications = auth0Config.rolePermissions[userRole]?.documents || [];

      if (!allowedClassifications.includes(classificationLevel)) {
        await auditLogger.logAuth({
          action: 'document_access_denied',
          userId: req.user.sub,
          email: req.user.email,
          roleType: userRole,
          requiredClassification: classificationLevel,
          allowedClassifications: allowedClassifications,
          ip: req.ip
        });

        return this.forbiddenResponse(res, 'Insufficient document access level');
      }

      next();
    };
  }

  /**
   * Network ACL restrictions for sensitive data
   */
  requireNetworkAcl(aclType = 'default') {
    return async (req, res, next) => {
      if (!req.user) {
        return this.unauthorizedResponse(res, 'Authentication required');
      }

      const clientIP = req.ip;
      const userRole = req.user.roleType;

      try {
        const isAllowed = await this.networkAcl.checkAccess(clientIP, userRole, aclType);
        
        if (!isAllowed) {
          await auditLogger.logAuth({
            action: 'network_acl_denied',
            userId: req.user.sub,
            email: req.user.email,
            roleType: userRole,
            clientIP: clientIP,
            aclType: aclType
          });

          return this.forbiddenResponse(res, 'Access denied from this network location');
        }

        next();
      } catch (error) {
        console.error('Network ACL check failed:', error);
        return this.forbiddenResponse(res, 'Network access check failed');
      }
    };
  }

  /**
   * Witness data protection - enhanced security for witness access
   */
  requireWitnessProtection() {
    return async (req, res, next) => {
      if (!req.user) {
        return this.unauthorizedResponse(res, 'Authentication required');
      }

      const userRole = req.user.roleType;
      
      // Only legal team and government entities can access witness data
      if (![ROLES.LEGAL_TEAM, ROLES.GOVERNMENT_ENTITY].includes(userRole)) {
        return this.forbiddenResponse(res, 'Insufficient permissions for witness data');
      }

      // Apply network ACL for witness data
      const clientIP = req.ip;
      const isAllowed = await this.networkAcl.checkAccess(clientIP, userRole, 'witness');

      if (!isAllowed) {
        await auditLogger.logAuth({
          action: 'witness_data_access_denied',
          userId: req.user.sub,
          email: req.user.email,
          roleType: userRole,
          clientIP: clientIP
        });

        return this.forbiddenResponse(res, 'Witness data access denied from this location');
      }

      next();
    };
  }

  /**
   * Check if user can access specific resource
   */
  requireResourceAccess(resourceType, action = 'read') {
    return async (req, res, next) => {
      if (!req.user) {
        return this.unauthorizedResponse(res, 'Authentication required');
      }

      const userRole = req.user.roleType;
      const rolePermissions = auth0Config.rolePermissions[userRole];

      if (!rolePermissions || !rolePermissions[resourceType]) {
        return this.forbiddenResponse(res, 'Resource access not permitted');
      }

      const allowedActions = rolePermissions[resourceType];
      const hasPermission = Array.isArray(allowedActions) 
        ? allowedActions.includes(action)
        : allowedActions === action;

      if (!hasPermission) {
        await auditLogger.logAuth({
          action: 'resource_access_denied',
          userId: req.user.sub,
          email: req.user.email,
          roleType: userRole,
          resourceType: resourceType,
          requestedAction: action,
          allowedActions: allowedActions,
          ip: req.ip
        });

        return this.forbiddenResponse(res, `Action '${action}' not permitted on ${resourceType}`);
      }

      next();
    };
  }

  /**
   * Admin access control
   */
  requireAdmin() {
    return async (req, res, next) => {
      if (!req.user) {
        return this.unauthorizedResponse(res, 'Authentication required');
      }

      const userRole = req.user.roleType;
      const rolePermissions = auth0Config.rolePermissions[userRole];

      if (!rolePermissions?.admin?.length) {
        return this.forbiddenResponse(res, 'Admin access required');
      }

      next();
    };
  }

  /**
   * Session validation middleware
   */
  validateSession() {
    return async (req, res, next) => {
      if (!req.user) {
        return next();
      }

      const userRole = req.user.roleType;
      const sessionStart = req.session?.startTime;
      const now = Date.now();

      // Check session timeout based on role
      let maxDuration;
      if (userRole === ROLES.WITNESS) {
        maxDuration = auth0Config.networkAcl.witness.maxSessionDuration;
      } else {
        maxDuration = auth0Config.networkAcl.confidential.maxSessionDuration;
      }

      if (sessionStart && (now - sessionStart) > maxDuration) {
        req.session.destroy();
        
        await auditLogger.logAuth({
          action: 'session_timeout',
          userId: req.user.sub,
          email: req.user.email,
          roleType: userRole,
          sessionDuration: now - sessionStart,
          ip: req.ip
        });

        return this.unauthorizedResponse(res, 'Session expired');
      }

      next();
    };
  }

  /**
   * Extract JWT token from request
   */
  extractToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return null;
  }

  /**
   * Standard unauthorized response
   */
  unauthorizedResponse(res, message) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Standard forbidden response
   */
  forbiddenResponse(res, message) {
    return res.status(403).json({
      error: 'Forbidden',
      message: message,
      timestamp: new Date().toISOString()
    });
  }
}

// Create singleton instance
const authMiddleware = new AuthenticationMiddleware();

// Export middleware functions
module.exports = {
  requireAuth: authMiddleware.requireAuth(),
  requireRoles: (roles) => authMiddleware.requireRoles(roles),
  requireDocumentAccess: (level) => authMiddleware.requireDocumentAccess(level),
  requireNetworkAcl: (type) => authMiddleware.requireNetworkAcl(type),
  requireWitnessProtection: authMiddleware.requireWitnessProtection(),
  requireResourceAccess: (resource, action) => authMiddleware.requireResourceAccess(resource, action),
  requireAdmin: authMiddleware.requireAdmin(),
  validateSession: authMiddleware.validateSession(),
  AuthenticationMiddleware
};