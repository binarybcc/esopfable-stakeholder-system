/**
 * Route Protection Middleware
 * API route protection with comprehensive security controls
 */

const { 
  requireAuth, 
  requireRoles, 
  requireDocumentAccess,
  requireNetworkAcl,
  requireWitnessProtection,
  requireResourceAccess,
  requireAdmin,
  validateSession
} = require('../auth/auth-middleware');

const { ROLES, CLASSIFICATION_LEVELS } = require('../../config/auth/auth0-config');
const { auditLogger } = require('../services/audit-service');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

/**
 * Security headers middleware
 */
const securityHeaders = () => {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", `https://${process.env.AUTH0_DOMAIN}`],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xssFilter: true
  });
};

/**
 * Rate limiting configurations
 */
const rateLimiters = {
  // General API rate limiting
  general: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
      error: 'Too many requests',
      message: 'Please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: async (req, res) => {
      await auditLogger.logSecurityEvent({
        action: 'rate_limit_exceeded',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl,
        severity: 'warning'
      });
      
      res.status(429).json({
        error: 'Too many requests',
        message: 'Please try again later'
      });
    }
  }),

  // Authentication endpoints
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 login attempts per windowMs
    skipSuccessfulRequests: true,
    message: {
      error: 'Too many login attempts',
      message: 'Please try again after 15 minutes'
    }
  }),

  // Document download
  download: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // limit each IP to 10 downloads per minute
    message: {
      error: 'Download rate limit exceeded',
      message: 'Please wait before downloading more documents'
    }
  }),

  // Admin operations
  admin: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // limit admin operations
    message: {
      error: 'Admin operation rate limit exceeded',
      message: 'Please contact system administrator'
    }
  }),

  // Witness data access
  witness: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // very restrictive for witness data
    message: {
      error: 'Witness data access rate limit exceeded',
      message: 'Please contact legal team if you need additional access'
    }
  })
};

/**
 * Input validation middleware
 */
const validateInput = () => {
  return (req, res, next) => {
    // Basic input sanitization
    const sanitizeObject = (obj) => {
      if (typeof obj === 'string') {
        return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      }
      if (typeof obj === 'object' && obj !== null) {
        Object.keys(obj).forEach(key => {
          obj[key] = sanitizeObject(obj[key]);
        });
      }
      return obj;
    };

    req.body = sanitizeObject(req.body);
    req.query = sanitizeObject(req.query);
    req.params = sanitizeObject(req.params);

    next();
  };
};

/**
 * Request logging middleware
 */
const logRequest = () => {
  return async (req, res, next) => {
    const startTime = Date.now();

    // Log request
    const logData = {
      action: 'api_request',
      method: req.method,
      endpoint: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.sub,
      email: req.user?.email,
      roleType: req.user?.roleType,
      timestamp: new Date().toISOString()
    };

    // Override res.json to log response
    const originalJson = res.json;
    res.json = function(data) {
      const duration = Date.now() - startTime;
      
      // Log response
      auditLogger.log({
        ...logData,
        action: 'api_response',
        statusCode: res.statusCode,
        duration: duration,
        responseSize: JSON.stringify(data).length
      });

      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Route protection configurations
 */
const protectionLevels = {
  // Public access - no authentication required
  public: [
    securityHeaders(),
    rateLimiters.general,
    validateInput(),
    logRequest()
  ],

  // Authenticated access - requires valid token
  authenticated: [
    securityHeaders(),
    rateLimiters.general,
    validateInput(),
    logRequest(),
    requireAuth,
    validateSession()
  ],

  // Internal access - authenticated + role restrictions
  internal: [
    securityHeaders(),
    rateLimiters.general,
    validateInput(),
    logRequest(),
    requireAuth,
    validateSession(),
    requireRoles([ROLES.LEGAL_TEAM, ROLES.GOVERNMENT_ENTITY, ROLES.ESOP_PARTICIPANT])
  ],

  // Confidential access - internal + document classification
  confidential: [
    securityHeaders(),
    rateLimiters.general,
    validateInput(),
    logRequest(),
    requireAuth,
    validateSession(),
    requireRoles([ROLES.LEGAL_TEAM, ROLES.GOVERNMENT_ENTITY]),
    requireDocumentAccess(CLASSIFICATION_LEVELS.CONFIDENTIAL),
    requireNetworkAcl('confidential')
  ],

  // Secret access - highest classification
  secret: [
    securityHeaders(),
    rateLimiters.general,
    validateInput(),
    logRequest(),
    requireAuth,
    validateSession(),
    requireRoles([ROLES.LEGAL_TEAM]),
    requireDocumentAccess(CLASSIFICATION_LEVELS.SECRET),
    requireNetworkAcl('confidential')
  ],

  // Witness protection - enhanced security
  witnessProtection: [
    securityHeaders(),
    rateLimiters.witness,
    validateInput(),
    logRequest(),
    requireAuth,
    validateSession(),
    requireWitnessProtection(),
    requireNetworkAcl('witness')
  ],

  // Admin access - administrative functions
  admin: [
    securityHeaders(),
    rateLimiters.admin,
    validateInput(),
    logRequest(),
    requireAuth,
    validateSession(),
    requireAdmin(),
    requireNetworkAcl('confidential')
  ],

  // Download protection
  download: [
    securityHeaders(),
    rateLimiters.download,
    validateInput(),
    logRequest(),
    requireAuth,
    validateSession(),
    // Additional middleware added dynamically based on document classification
  ]
};

/**
 * Apply protection level to route
 */
const protect = (level) => {
  const middlewares = protectionLevels[level];
  if (!middlewares) {
    throw new Error(`Unknown protection level: ${level}`);
  }
  return middlewares;
};

/**
 * Resource-specific protection
 */
const protectResource = (resourceType, action = 'read') => {
  return [
    ...protectionLevels.authenticated,
    requireResourceAccess(resourceType, action)
  ];
};

/**
 * Document-specific protection based on classification
 */
const protectDocument = (req, res, next) => {
  // This middleware would typically check the document's classification
  // and apply appropriate protection level dynamically
  
  const documentId = req.params.documentId || req.body.documentId;
  
  if (!documentId) {
    return res.status(400).json({ error: 'Document ID required' });
  }

  // In a real implementation, you would fetch the document classification
  // const document = await getDocument(documentId);
  // const classification = document.classification;
  
  // For now, we'll use a placeholder
  const classification = req.headers['x-document-classification'] || CLASSIFICATION_LEVELS.INTERNAL;

  // Apply appropriate middleware based on classification
  let middleware;
  switch (classification) {
    case CLASSIFICATION_LEVELS.SECRET:
      middleware = protectionLevels.secret;
      break;
    case CLASSIFICATION_LEVELS.CONFIDENTIAL:
      middleware = protectionLevels.confidential;
      break;
    case CLASSIFICATION_LEVELS.INTERNAL:
      middleware = protectionLevels.internal;
      break;
    case CLASSIFICATION_LEVELS.PUBLIC:
    default:
      middleware = protectionLevels.public;
      break;
  }

  // Apply middleware sequentially
  let index = 0;
  const runNext = () => {
    if (index >= middleware.length) {
      return next();
    }
    
    const currentMiddleware = middleware[index++];
    currentMiddleware(req, res, runNext);
  };

  runNext();
};

/**
 * Stakeholder-specific protection
 */
const protectStakeholder = (req, res, next) => {
  const stakeholderId = req.params.stakeholderId;
  
  if (!stakeholderId) {
    return res.status(400).json({ error: 'Stakeholder ID required' });
  }

  // Check if accessing witness data
  // In a real implementation, you would check the stakeholder type from database
  const isWitnessData = req.headers['x-stakeholder-type'] === 'witness';
  
  if (isWitnessData) {
    // Apply witness protection
    const witnessMiddleware = protectionLevels.witnessProtection;
    let index = 0;
    
    const runNext = () => {
      if (index >= witnessMiddleware.length) {
        return next();
      }
      
      const currentMiddleware = witnessMiddleware[index++];
      currentMiddleware(req, res, runNext);
    };

    return runNext();
  }

  // Standard stakeholder protection
  const standardMiddleware = protectionLevels.internal;
  let index = 0;
  
  const runNext = () => {
    if (index >= standardMiddleware.length) {
      return next();
    }
    
    const currentMiddleware = standardMiddleware[index++];
    currentMiddleware(req, res, runNext);
  };

  runNext();
};

/**
 * Media-specific restrictions
 */
const mediaRestrictions = () => {
  return (req, res, next) => {
    if (req.user?.roleType === ROLES.MEDIA_CONTACT) {
      // Media contacts can only access approved/public data
      req.mediaRestricted = true;
      
      // Add filter to queries to only show public/approved content
      req.query.publicOnly = true;
    }
    next();
  };
};

/**
 * Opposition restrictions
 */
const oppositionRestrictions = () => {
  return (req, res, next) => {
    if (req.user?.roleType === ROLES.OPPOSITION) {
      // Opposition can only access public data
      req.oppositionRestricted = true;
      
      // Add filter to queries to only show public content
      req.query.publicOnly = true;
      req.query.maxClassification = CLASSIFICATION_LEVELS.PUBLIC;
    }
    next();
  };
};

module.exports = {
  protect,
  protectResource,
  protectDocument,
  protectStakeholder,
  protectionLevels,
  rateLimiters,
  securityHeaders,
  validateInput,
  logRequest,
  mediaRestrictions,
  oppositionRestrictions
};