/**
 * Auth0 Configuration
 * Comprehensive authentication setup for case management platform
 */

const crypto = require('crypto');

// Role definitions matching database schema
const ROLES = {
  LEGAL_TEAM: 'legal_team',
  GOVERNMENT_ENTITY: 'government_entity',
  ESOP_PARTICIPANT: 'esop_participant',
  WITNESS: 'witness',
  MEDIA_CONTACT: 'media_contact',
  OPPOSITION: 'opposition'
};

// Document classification levels
const CLASSIFICATION_LEVELS = {
  PUBLIC: 'public',
  INTERNAL: 'internal',
  CONFIDENTIAL: 'confidential',
  SECRET: 'secret'
};

// Security clearance levels
const SECURITY_LEVELS = {
  STANDARD: 'standard',
  RESTRICTED: 'restricted',
  HIGH: 'high'
};

// Auth0 Configuration
const auth0Config = {
  // Main application configuration
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  audience: process.env.AUTH0_AUDIENCE || `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
  
  // Management API configuration
  managementClientId: process.env.AUTH0_MANAGEMENT_CLIENT_ID,
  managementClientSecret: process.env.AUTH0_MANAGEMENT_CLIENT_SECRET,
  managementAudience: `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
  
  // Application URLs
  redirectUri: process.env.AUTH0_REDIRECT_URI || 'http://localhost:3000/callback',
  postLogoutRedirectUri: process.env.AUTH0_POST_LOGOUT_REDIRECT_URI || 'http://localhost:3000',
  
  // Session configuration
  session: {
    secret: process.env.SESSION_SECRET || crypto.randomBytes(64).toString('hex'),
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax'
    },
    name: 'esop-session',
    resave: false,
    saveUninitialized: false
  },
  
  // Token configuration
  tokenEndpointAuthMethod: 'client_secret_post',
  
  // Custom claims namespace
  customClaimsNamespace: 'https://esopfable.com/',
  
  // MFA settings
  mfa: {
    required: ['legal_team', 'government_entity', 'witness'],
    optional: ['esop_participant', 'media_contact'],
    forbidden: ['opposition'] // Opposition uses external verification
  },
  
  // Password policy
  passwordPolicy: {
    length: {
      min: 12,
      max: 128
    },
    includeCharacters: {
      lower: true,
      upper: true,
      numbers: true,
      symbols: true
    },
    excludeUsernameSubstring: true,
    excludeEmailSubstring: true,
    excludePasswordHistory: 12,
    excludeCommonPasswords: true
  },
  
  // Role-based access matrix
  rolePermissions: {
    [ROLES.LEGAL_TEAM]: {
      documents: [CLASSIFICATION_LEVELS.PUBLIC, CLASSIFICATION_LEVELS.INTERNAL, CLASSIFICATION_LEVELS.CONFIDENTIAL, CLASSIFICATION_LEVELS.SECRET],
      stakeholders: ['read', 'write', 'delete'],
      communications: ['read', 'write', 'delete'],
      tasks: ['read', 'write', 'assign', 'delete'],
      risks: ['read', 'write', 'assess', 'mitigate'],
      audit: ['read', 'export'],
      admin: ['user_management', 'system_config']
    },
    [ROLES.GOVERNMENT_ENTITY]: {
      documents: [CLASSIFICATION_LEVELS.PUBLIC, CLASSIFICATION_LEVELS.INTERNAL, CLASSIFICATION_LEVELS.CONFIDENTIAL],
      stakeholders: ['read', 'write'],
      communications: ['read', 'write'],
      tasks: ['read', 'write'],
      risks: ['read', 'write', 'assess'],
      audit: ['read'],
      admin: []
    },
    [ROLES.ESOP_PARTICIPANT]: {
      documents: [CLASSIFICATION_LEVELS.PUBLIC, CLASSIFICATION_LEVELS.INTERNAL],
      stakeholders: ['read_own', 'update_own'],
      communications: ['read_own', 'write_own'],
      tasks: ['read_assigned'],
      risks: ['read_own'],
      audit: [],
      admin: []
    },
    [ROLES.WITNESS]: {
      documents: [CLASSIFICATION_LEVELS.PUBLIC],
      stakeholders: ['read_own', 'update_own'],
      communications: ['read_own', 'write_own'],
      tasks: ['read_assigned'],
      risks: ['read_own', 'report'],
      audit: [],
      admin: []
    },
    [ROLES.MEDIA_CONTACT]: {
      documents: [CLASSIFICATION_LEVELS.PUBLIC],
      stakeholders: ['read_approved'],
      communications: ['read_approved', 'request_info'],
      tasks: [],
      risks: [],
      audit: [],
      admin: []
    },
    [ROLES.OPPOSITION]: {
      documents: [CLASSIFICATION_LEVELS.PUBLIC],
      stakeholders: ['read_public'],
      communications: ['read_public'],
      tasks: [],
      risks: [],
      audit: [],
      admin: []
    }
  },
  
  // Network ACL for sensitive data
  networkAcl: {
    witness: {
      allowedNetworks: process.env.WITNESS_ALLOWED_NETWORKS?.split(',') || ['127.0.0.0/8'],
      deniedNetworks: [],
      requireVpn: true,
      maxSessionDuration: 2 * 60 * 60 * 1000, // 2 hours
      ipWhitelist: process.env.WITNESS_IP_WHITELIST?.split(',') || []
    },
    confidential: {
      allowedNetworks: process.env.CONFIDENTIAL_ALLOWED_NETWORKS?.split(',') || ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'],
      deniedNetworks: [],
      requireMfa: true,
      maxSessionDuration: 8 * 60 * 60 * 1000 // 8 hours
    }
  },
  
  // Audit logging configuration
  audit: {
    enabled: true,
    level: 'detailed', // 'basic' | 'detailed' | 'verbose'
    retention: 7 * 365 * 24 * 60 * 60 * 1000, // 7 years in milliseconds
    encryption: true,
    anonymizeIps: process.env.NODE_ENV !== 'development',
    logActions: [
      'login',
      'logout',
      'document_access',
      'document_download',
      'stakeholder_view',
      'communication_create',
      'risk_event',
      'permission_change',
      'admin_action'
    ]
  }
};

// Auth0 Rules and Actions configuration
const auth0Rules = {
  // Custom claims rule
  addCustomClaims: `
    function addCustomClaims(user, context, callback) {
      const namespace = '${auth0Config.customClaimsNamespace}';
      const assignedRoles = (context.authorization || {}).roles || [];
      
      // Add user metadata
      context.idToken[namespace + 'user_metadata'] = user.user_metadata || {};
      context.idToken[namespace + 'app_metadata'] = user.app_metadata || {};
      context.idToken[namespace + 'roles'] = assignedRoles;
      
      // Add security level
      const userRole = user.app_metadata?.role_type;
      const securityLevel = user.app_metadata?.security_level || 'standard';
      context.idToken[namespace + 'security_level'] = securityLevel;
      context.idToken[namespace + 'role_type'] = userRole;
      
      callback(null, user, context);
    }
  `,
  
  // IP restriction rule for witnesses
  ipRestriction: `
    function ipRestriction(user, context, callback) {
      const userRole = user.app_metadata?.role_type;
      const clientIP = context.request.ip;
      
      if (userRole === 'witness') {
        const allowedNetworks = configuration.WITNESS_ALLOWED_NETWORKS?.split(',') || [];
        const ipWhitelist = configuration.WITNESS_IP_WHITELIST?.split(',') || [];
        
        // Check if IP is in whitelist or allowed networks
        const isAllowed = ipWhitelist.includes(clientIP) || 
                         allowedNetworks.some(network => isIpInNetwork(clientIP, network));
        
        if (!isAllowed) {
          return callback(new UnauthorizedError('Access denied from this location'));
        }
      }
      
      callback(null, user, context);
    }
  `,
  
  // Force MFA rule
  forceMfa: `
    function forceMfa(user, context, callback) {
      const userRole = user.app_metadata?.role_type;
      const requiredMfaRoles = ${JSON.stringify(auth0Config.mfa.required)};
      
      if (requiredMfaRoles.includes(userRole) && !context.multifactor) {
        context.multifactor = {
          provider: 'any',
          allowRememberBrowser: false
        };
      }
      
      callback(null, user, context);
    }
  `
};

// Database connection configuration
const databaseConnection = {
  connectionString: process.env.AUTH0_DATABASE_CONNECTION_STRING,
  options: {
    customFields: {
      role_type: 'text',
      security_level: 'text',
      organization: 'text',
      department: 'text',
      clearance_level: 'text',
      last_security_review: 'date'
    },
    validation: {
      username: {
        min: 3,
        max: 50
      }
    },
    passwordComplexity: auth0Config.passwordPolicy
  }
};

module.exports = {
  auth0Config,
  auth0Rules,
  databaseConnection,
  ROLES,
  CLASSIFICATION_LEVELS,
  SECURITY_LEVELS
};