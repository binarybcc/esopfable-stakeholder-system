/**
 * Security Configuration Management
 * Centralized configuration for all security components
 */

const path = require('path');

class SecurityConfig {
  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.isDevelopment = this.environment === 'development';
    this.isProduction = this.environment === 'production';
    
    this.config = this.loadConfiguration();
  }

  /**
   * Load security configuration based on environment
   */
  loadConfiguration() {
    const baseConfig = {
      // JWT Configuration
      jwt: {
        accessTokenSecret: process.env.JWT_ACCESS_SECRET || this.generateSecret('jwt-access'),
        refreshTokenSecret: process.env.JWT_REFRESH_SECRET || this.generateSecret('jwt-refresh'),
        accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
        refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
        issuer: process.env.JWT_ISSUER || 'esopfable-case-management',
        audience: process.env.JWT_AUDIENCE || 'esopfable-users',
        algorithm: 'HS256'
      },

      // Encryption Configuration
      encryption: {
        algorithm: 'aes-256-gcm',
        keyDerivationRounds: parseInt(process.env.ENCRYPTION_KEY_ROUNDS) || 100000,
        masterKey: process.env.DOCUMENT_ENCRYPTION_KEY,
        keyRotationInterval: parseInt(process.env.KEY_ROTATION_INTERVAL) || (30 * 24 * 60 * 60 * 1000), // 30 days
        compressionLevel: 6,
        keySize: 32,
        ivSize: 16,
        tagSize: 16,
        saltSize: 32
      },

      // Rate Limiting Configuration
      rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || (15 * 60 * 1000), // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        standardHeaders: true,
        legacyHeaders: false
      },

      // Role-based Rate Limits
      roleLimits: {
        legal_team: { requests: 1000, window: 3600 },
        government_entity: { requests: 500, window: 3600 },
        esop_participant: { requests: 100, window: 3600 },
        media_contact: { requests: 50, window: 3600 },
        opposition: { requests: 25, window: 3600 }
      },

      // CSRF Protection
      csrf: {
        secret: process.env.CSRF_SECRET || this.generateSecret('csrf'),
        cookie: {
          httpOnly: true,
          secure: this.isProduction,
          sameSite: 'strict',
          maxAge: 3600000 // 1 hour
        }
      },

      // Session Configuration
      session: {
        secret: process.env.SESSION_SECRET || this.generateSecret('session'),
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: this.isProduction,
          httpOnly: true,
          maxAge: parseInt(process.env.SESSION_TIMEOUT) || (24 * 60 * 60 * 1000), // 24 hours
          sameSite: 'strict'
        },
        name: 'esopfable.sid'
      },

      // Security Headers
      helmet: {
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:', 'https:'],
            scriptSrc: ["'self'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: this.isProduction ? [] : undefined,
            blockAllMixedContent: this.isProduction ? [] : undefined
          },
        },
        hsts: {
          maxAge: 31536000, // 1 year
          includeSubDomains: true,
          preload: true
        },
        noSniff: true,
        frameguard: { action: 'deny' },
        xssFilter: true,
        referrerPolicy: { policy: 'same-origin' },
        permittedCrossDomainPolicies: false,
        dnsPrefetchControl: { allow: false }
      },

      // Network ACL Configuration
      networkAcl: {
        witness: {
          ipWhitelist: process.env.WITNESS_IP_WHITELIST?.split(',') || [],
          allowedNetworks: process.env.WITNESS_ALLOWED_NETWORKS?.split(',') || [],
          deniedNetworks: process.env.WITNESS_DENIED_NETWORKS?.split(',') || [],
          requireVpn: process.env.WITNESS_REQUIRE_VPN === 'true',
          blockedCountries: ['CN', 'RU', 'KP', 'IR']
        },
        confidential: {
          allowedNetworks: process.env.CONFIDENTIAL_ALLOWED_NETWORKS?.split(',') || [],
          deniedNetworks: process.env.CONFIDENTIAL_DENIED_NETWORKS?.split(',') || []
        },
        secret: {
          // Secret data uses witness-level restrictions
          inheritFrom: 'witness'
        },
        default: {
          allowedNetworks: process.env.DEFAULT_ALLOWED_NETWORKS?.split(',') || [],
          blockedCountries: ['KP', 'IR', 'SY', 'CU'] // Embargoed countries
        }
      },

      // Security Monitoring Configuration
      monitoring: {
        alertThresholds: {
          failedLogins: parseInt(process.env.FAILED_LOGIN_THRESHOLD) || 5,
          rateLimitHits: parseInt(process.env.RATE_LIMIT_THRESHOLD) || 10,
          suspiciousActivity: parseInt(process.env.SUSPICIOUS_ACTIVITY_THRESHOLD) || 3
        },
        windowSize: parseInt(process.env.MONITORING_WINDOW) || (60 * 60 * 1000), // 1 hour
        cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL) || (24 * 60 * 60 * 1000), // 24 hours
        notifications: {
          emailEnabled: process.env.SECURITY_EMAIL_ENABLED === 'true',
          webhookEnabled: process.env.SECURITY_WEBHOOK_ENABLED === 'true',
          slackWebhook: process.env.SLACK_WEBHOOK_URL,
          webhookUrl: process.env.SECURITY_WEBHOOK_URL
        }
      },

      // Email Configuration for Security Alerts
      email: {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER,
        password: process.env.SMTP_PASSWORD,
        from: process.env.SECURITY_EMAIL_FROM || 'security@esopfable.com',
        securityTeam: process.env.SECURITY_EMAIL_RECIPIENTS?.split(',') || ['security@esopfable.com']
      },

      // File Upload Security
      fileUpload: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || (50 * 1024 * 1024), // 50MB
        allowedMimes: [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'image/gif',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain',
          'text/csv'
        ],
        uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '../../../uploads'),
        quarantineDir: process.env.QUARANTINE_DIR || path.join(__dirname, '../../../quarantine'),
        virusScanEnabled: process.env.VIRUS_SCAN_ENABLED === 'true',
        encryptUploads: process.env.ENCRYPT_UPLOADS !== 'false'
      },

      // Database Security
      database: {
        ssl: this.isProduction,
        connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 60000,
        queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT) || 30000,
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS) || 10,
        encryptConnection: this.isProduction
      },

      // Redis Configuration for JWT and Session Storage
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB) || 0,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        connectTimeout: 10000,
        lazyConnect: true,
        keepAlive: 30000
      },

      // Audit Configuration
      audit: {
        enabled: process.env.AUDIT_ENABLED !== 'false',
        logLevel: process.env.AUDIT_LOG_LEVEL || 'info',
        logPath: process.env.AUDIT_LOG_PATH || path.join(__dirname, '../../../logs'),
        retention: parseInt(process.env.AUDIT_RETENTION_DAYS) || 365, // 1 year
        compressionEnabled: process.env.AUDIT_COMPRESSION === 'true',
        encryptLogs: process.env.ENCRYPT_AUDIT_LOGS === 'true'
      },

      // Multi-Factor Authentication
      mfa: {
        enabled: process.env.MFA_ENABLED === 'true',
        requiredRoles: ['legal_team', 'government_entity'],
        totpIssuer: process.env.TOTP_ISSUER || 'ESOP Fable',
        backupCodes: parseInt(process.env.MFA_BACKUP_CODES) || 10,
        gracePeriod: parseInt(process.env.MFA_GRACE_PERIOD) || (7 * 24 * 60 * 60 * 1000) // 7 days
      },

      // API Security
      api: {
        keyFormat: /^esop_[a-z]{2}_[a-z]+_[a-zA-Z0-9]{32,}$/,
        keyExpiry: parseInt(process.env.API_KEY_EXPIRY) || (365 * 24 * 60 * 60 * 1000), // 1 year
        maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb',
        corsOrigins: process.env.CORS_ORIGINS?.split(',') || [],
        trustedProxies: process.env.TRUSTED_PROXIES?.split(',') || []
      },

      // Logging Configuration
      logging: {
        level: process.env.LOG_LEVEL || (this.isProduction ? 'warn' : 'debug'),
        format: process.env.LOG_FORMAT || 'json',
        maxFiles: parseInt(process.env.LOG_MAX_FILES) || 10,
        maxSize: process.env.LOG_MAX_SIZE || '10m',
        sensitiveFields: ['password', 'token', 'secret', 'key', 'authorization'],
        logToFile: process.env.LOG_TO_FILE !== 'false',
        logToConsole: process.env.LOG_TO_CONSOLE !== 'false'
      }
    };

    // Environment-specific overrides
    return this.applyEnvironmentOverrides(baseConfig);
  }

  /**
   * Apply environment-specific configuration overrides
   */
  applyEnvironmentOverrides(config) {
    if (this.isDevelopment) {
      return {
        ...config,
        // Development overrides
        jwt: {
          ...config.jwt,
          accessTokenExpiry: '1h', // Longer tokens for development
          refreshTokenExpiry: '30d'
        },
        rateLimit: {
          ...config.rateLimit,
          max: 1000, // More lenient rate limiting
          windowMs: 60 * 1000 // 1 minute window
        },
        networkAcl: {
          ...config.networkAcl,
          default: {
            ...config.networkAcl.default,
            allowedNetworks: ['127.0.0.0/8', '192.168.0.0/16', '10.0.0.0/8'] // Allow local networks
          }
        },
        helmet: {
          ...config.helmet,
          contentSecurityPolicy: {
            ...config.helmet.contentSecurityPolicy,
            directives: {
              ...config.helmet.contentSecurityPolicy.directives,
              upgradeInsecureRequests: undefined, // Allow HTTP in development
              blockAllMixedContent: undefined
            }
          }
        }
      };
    }

    if (this.isProduction) {
      return {
        ...config,
        // Production overrides
        session: {
          ...config.session,
          cookie: {
            ...config.session.cookie,
            secure: true, // HTTPS only
            domain: process.env.COOKIE_DOMAIN
          }
        },
        database: {
          ...config.database,
          ssl: {
            rejectUnauthorized: true,
            ca: process.env.DB_SSL_CA,
            cert: process.env.DB_SSL_CERT,
            key: process.env.DB_SSL_KEY
          }
        }
      };
    }

    return config;
  }

  /**
   * Generate a secure secret if not provided in environment
   */
  generateSecret(purpose) {
    if (this.isProduction) {
      throw new Error(`${purpose.toUpperCase()}_SECRET must be provided in production environment`);
    }

    const crypto = require('crypto');
    const secret = crypto.randomBytes(32).toString('hex');
    
    console.warn(`⚠️  Generated temporary secret for ${purpose}. Set ${purpose.toUpperCase()}_SECRET in production.`);
    
    return secret;
  }

  /**
   * Get configuration for a specific component
   */
  get(component) {
    return this.config[component];
  }

  /**
   * Get all configuration
   */
  getAll() {
    return this.config;
  }

  /**
   * Validate configuration
   */
  validate() {
    const errors = [];

    // Validate required production secrets
    if (this.isProduction) {
      const requiredSecrets = [
        'JWT_ACCESS_SECRET',
        'JWT_REFRESH_SECRET',
        'CSRF_SECRET',
        'SESSION_SECRET',
        'DOCUMENT_ENCRYPTION_KEY'
      ];

      for (const secret of requiredSecrets) {
        if (!process.env[secret]) {
          errors.push(`${secret} is required in production`);
        }
      }

      // Validate secret lengths
      if (process.env.JWT_ACCESS_SECRET && process.env.JWT_ACCESS_SECRET.length < 32) {
        errors.push('JWT_ACCESS_SECRET must be at least 32 characters long');
      }

      if (process.env.DOCUMENT_ENCRYPTION_KEY) {
        try {
          const key = Buffer.from(process.env.DOCUMENT_ENCRYPTION_KEY, 'base64');
          if (key.length !== 32) {
            errors.push('DOCUMENT_ENCRYPTION_KEY must be 32 bytes (256 bits) when base64 decoded');
          }
        } catch (error) {
          errors.push('DOCUMENT_ENCRYPTION_KEY must be valid base64');
        }
      }
    }

    // Validate numeric configurations
    const numericConfigs = [
      { key: 'RATE_LIMIT_MAX', min: 1, max: 10000 },
      { key: 'FAILED_LOGIN_THRESHOLD', min: 1, max: 100 },
      { key: 'MAX_FILE_SIZE', min: 1024, max: 100 * 1024 * 1024 } // 1KB to 100MB
    ];

    for (const config of numericConfigs) {
      const value = parseInt(process.env[config.key]);
      if (process.env[config.key] && (isNaN(value) || value < config.min || value > config.max)) {
        errors.push(`${config.key} must be a number between ${config.min} and ${config.max}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get security headers configuration
   */
  getSecurityHeaders() {
    return {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'same-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
      'Strict-Transport-Security': this.isProduction ? 'max-age=31536000; includeSubDomains; preload' : undefined
    };
  }

  /**
   * Export configuration for testing
   */
  exportForTesting() {
    return {
      ...this.config,
      _environment: this.environment,
      _isDevelopment: this.isDevelopment,
      _isProduction: this.isProduction
    };
  }
}

// Create singleton instance
const securityConfig = new SecurityConfig();

// Validate configuration on startup
const validation = securityConfig.validate();
if (!validation.valid) {
  console.error('Security configuration validation failed:');
  validation.errors.forEach(error => console.error(`  - ${error}`));
  
  if (securityConfig.isProduction) {
    process.exit(1);
  }
}

module.exports = {
  SecurityConfig,
  securityConfig
};