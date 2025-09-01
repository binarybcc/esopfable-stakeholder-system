/**
 * Security Middleware Suite
 * Comprehensive security protection including XSS, CSRF, input sanitization, and rate limiting
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const validator = require('validator');
const csrf = require('csurf');
const compression = require('compression');
const { auditLogger } = require('../../services/audit-service');

class SecurityMiddleware {
  constructor(config = {}) {
    this.config = {
      rateLimitWindow: config.rateLimitWindow || 15 * 60 * 1000, // 15 minutes
      rateLimitMax: config.rateLimitMax || 100,
      csrfSecret: config.csrfSecret || process.env.CSRF_SECRET || 'secure-csrf-secret',
      maxRequestSize: config.maxRequestSize || '10mb',
      ...config
    };

    // Initialize DOMPurify with JSDOM
    const window = new JSDOM('').window;
    this.domPurify = DOMPurify(window);
  }

  /**
   * Apply all security middleware
   */
  applySecurityMiddleware(app) {
    // Compression middleware
    app.use(compression());

    // Helmet for various HTTP security headers
    app.use(this.getHelmetConfig());

    // Rate limiting
    app.use(this.getRateLimitConfig());

    // Request size limiting
    app.use(this.getRequestSizeLimit());

    // Input sanitization
    app.use(this.inputSanitization());

    // CSRF protection (for non-API routes)
    app.use('/api', this.getCsrfProtection());

    // XSS protection
    app.use(this.xssProtection());

    // Content Security Policy
    app.use(this.contentSecurityPolicy());

    // Request logging
    app.use(this.requestLogger());
  }

  /**
   * Helmet configuration for security headers
   */
  getHelmetConfig() {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:'],
          scriptSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
          blockAllMixedContent: []
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
    });
  }

  /**
   * Rate limiting configuration
   */
  getRateLimitConfig() {
    const limiter = rateLimit({
      windowMs: this.config.rateLimitWindow,
      max: this.config.rateLimitMax,
      message: {
        error: 'Rate limit exceeded',
        message: 'Too many requests from this IP, please try again later'
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: async (req, res) => {
        const clientIP = req.ip || req.connection.remoteAddress;
        
        await auditLogger.log({
          action: 'rate_limit_exceeded',
          clientIP: clientIP,
          userAgent: req.get('User-Agent'),
          endpoint: req.path,
          method: req.method,
          timestamp: new Date().toISOString()
        });

        res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Too many requests from this IP, please try again later'
        });
      },
      keyGenerator: (req) => {
        // Use user ID if authenticated, otherwise IP
        return req.user?.id || req.ip || 'anonymous';
      }
    });

    // Slow down middleware for additional protection
    const speedLimiter = slowDown({
      windowMs: this.config.rateLimitWindow,
      delayAfter: Math.floor(this.config.rateLimitMax * 0.5), // Start slowing after 50% of limit
      delayMs: 500, // Add 500ms delay per request
      maxDelayMs: 20000 // Maximum delay of 20 seconds
    });

    return [limiter, speedLimiter];
  }

  /**
   * Request size limiting
   */
  getRequestSizeLimit() {
    return (req, res, next) => {
      const contentLength = parseInt(req.get('Content-Length'));
      const maxSize = this.parseSize(this.config.maxRequestSize);
      
      if (contentLength && contentLength > maxSize) {
        res.status(413).json({
          error: 'Request too large',
          message: 'Request size exceeds maximum allowed limit'
        });
        return;
      }
      
      next();
    };
  }

  /**
   * Input sanitization middleware
   */
  inputSanitization() {
    return (req, res, next) => {
      try {
        // Sanitize request body
        if (req.body && typeof req.body === 'object') {
          req.body = this.sanitizeObject(req.body);
        }

        // Sanitize query parameters
        if (req.query && typeof req.query === 'object') {
          req.query = this.sanitizeObject(req.query);
        }

        // Sanitize URL parameters
        if (req.params && typeof req.params === 'object') {
          req.params = this.sanitizeObject(req.params);
        }

        next();
      } catch (error) {
        console.error('Input sanitization failed:', error);
        res.status(400).json({
          error: 'Invalid input',
          message: 'Request contains malicious content'
        });
      }
    };
  }

  /**
   * XSS protection middleware
   */
  xssProtection() {
    return (req, res, next) => {
      // Override res.json to sanitize output
      const originalJson = res.json;
      
      res.json = function(data) {
        if (data && typeof data === 'object') {
          data = this.sanitizeForOutput(data);
        }
        return originalJson.call(this, data);
      }.bind(this);

      next();
    };
  }

  /**
   * Content Security Policy middleware
   */
  contentSecurityPolicy() {
    return (req, res, next) => {
      // Generate nonce for inline scripts if needed
      const nonce = this.generateNonce();
      res.locals.nonce = nonce;

      // Set CSP header with nonce
      res.setHeader('Content-Security-Policy', 
        `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'`
      );

      next();
    };
  }

  /**
   * CSRF protection for non-API routes
   */
  getCsrfProtection() {
    return csrf({
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 3600000 // 1 hour
      },
      value: (req) => {
        return req.headers['x-csrf-token'] || 
               req.body._csrf || 
               req.query._csrf;
      }
    });
  }

  /**
   * Request logging middleware
   */
  requestLogger() {
    return async (req, res, next) => {
      const startTime = Date.now();
      const clientIP = req.ip || req.connection.remoteAddress;

      // Log request
      const requestLog = {
        action: 'http_request',
        method: req.method,
        path: req.path,
        clientIP: clientIP,
        userAgent: req.get('User-Agent'),
        referer: req.get('Referer'),
        contentType: req.get('Content-Type'),
        contentLength: req.get('Content-Length'),
        userId: req.user?.id,
        timestamp: new Date().toISOString()
      };

      // Override res.end to log response
      const originalEnd = res.end;
      res.end = function(...args) {
        const responseTime = Date.now() - startTime;
        
        // Log response
        auditLogger.log({
          ...requestLog,
          action: 'http_response',
          statusCode: res.statusCode,
          responseTime: responseTime,
          responseSize: res.get('Content-Length')
        });

        return originalEnd.apply(this, args);
      };

      await auditLogger.log(requestLog);
      next();
    };
  }

  /**
   * Sanitize object recursively
   */
  sanitizeObject(obj, depth = 0) {
    if (depth > 10) { // Prevent deep recursion attacks
      throw new Error('Object nesting too deep');
    }

    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, depth + 1));
    }

    if (typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        const cleanKey = this.sanitizeString(key);
        sanitized[cleanKey] = this.sanitizeObject(value, depth + 1);
      }
      return sanitized;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    return obj;
  }

  /**
   * Sanitize string input
   */
  sanitizeString(str) {
    if (typeof str !== 'string') {
      return str;
    }

    // Remove HTML tags and potentially dangerous content
    let sanitized = this.domPurify.sanitize(str, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    });

    // Escape SQL injection patterns
    sanitized = sanitized.replace(/['";\\]/g, '\\$&');

    // Remove control characters except newlines and tabs
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Limit string length to prevent DoS
    if (sanitized.length > 10000) {
      sanitized = sanitized.substring(0, 10000);
    }

    return sanitized;
  }

  /**
   * Sanitize data for output to prevent XSS
   */
  sanitizeForOutput(obj, depth = 0) {
    if (depth > 10) {
      return '[Max Depth Reached]';
    }

    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeForOutput(item, depth + 1));
    }

    if (typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeForOutput(value, depth + 1);
      }
      return sanitized;
    }

    if (typeof obj === 'string') {
      // HTML encode for output
      return validator.escape(obj);
    }

    return obj;
  }

  /**
   * Generate cryptographically secure nonce
   */
  generateNonce() {
    return require('crypto').randomBytes(16).toString('base64');
  }

  /**
   * Parse size string to bytes
   */
  parseSize(sizeStr) {
    const units = {
      'b': 1,
      'kb': 1024,
      'mb': 1024 * 1024,
      'gb': 1024 * 1024 * 1024
    };

    const match = sizeStr.toLowerCase().match(/^(\d+(?:\.\d+)?)(b|kb|mb|gb)?$/);
    if (!match) {
      throw new Error('Invalid size format');
    }

    const value = parseFloat(match[1]);
    const unit = match[2] || 'b';

    return Math.floor(value * units[unit]);
  }

  /**
   * Advanced threat detection middleware
   */
  threatDetection() {
    const suspiciousPatterns = [
      // SQL injection patterns
      /(\b(select|insert|update|delete|drop|create|alter|exec|union|script)\b)/i,
      // XSS patterns
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      // Path traversal
      /\.{2}[\/\\]/,
      // Command injection
      /[;&|`$(){}[\]]/,
      // LDAP injection
      /(\(|\)|&|\|)/
    ];

    return async (req, res, next) => {
      const requestData = JSON.stringify({
        body: req.body,
        query: req.query,
        params: req.params
      });

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(requestData)) {
          await auditLogger.log({
            action: 'threat_detected',
            pattern: pattern.toString(),
            clientIP: req.ip,
            userAgent: req.get('User-Agent'),
            endpoint: req.path,
            method: req.method,
            suspiciousData: requestData.substring(0, 500),
            timestamp: new Date().toISOString()
          });

          return res.status(400).json({
            error: 'Malicious request detected',
            message: 'Request contains potentially harmful content'
          });
        }
      }

      next();
    };
  }

  /**
   * File upload security middleware
   */
  fileUploadSecurity(options = {}) {
    const allowedMimes = options.allowedMimes || [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    const maxFileSize = options.maxFileSize || 50 * 1024 * 1024; // 50MB

    return async (req, res, next) => {
      if (!req.files || Object.keys(req.files).length === 0) {
        return next();
      }

      for (const file of Object.values(req.files)) {
        // Check file size
        if (file.size > maxFileSize) {
          return res.status(413).json({
            error: 'File too large',
            message: `File size exceeds ${maxFileSize} bytes`
          });
        }

        // Check MIME type
        if (!allowedMimes.includes(file.mimetype)) {
          return res.status(400).json({
            error: 'Invalid file type',
            message: 'File type not allowed'
          });
        }

        // Scan file content for malicious patterns
        const isMalicious = await this.scanFileContent(file.data);
        if (isMalicious) {
          await auditLogger.log({
            action: 'malicious_file_upload',
            filename: file.name,
            mimetype: file.mimetype,
            size: file.size,
            clientIP: req.ip,
            userId: req.user?.id,
            timestamp: new Date().toISOString()
          });

          return res.status(400).json({
            error: 'Malicious file detected',
            message: 'File contains potentially harmful content'
          });
        }
      }

      next();
    };
  }

  /**
   * Scan file content for malicious patterns
   */
  async scanFileContent(fileBuffer) {
    const content = fileBuffer.toString('utf8', 0, Math.min(1024, fileBuffer.length));
    
    const maliciousPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /expression\s*\(/i
    ];

    return maliciousPatterns.some(pattern => pattern.test(content));
  }

  /**
   * API key validation middleware
   */
  apiKeyValidation(requiredKeyType = 'standard') {
    return async (req, res, next) => {
      const apiKey = req.headers['x-api-key'];
      
      if (!apiKey) {
        return res.status(401).json({
          error: 'API key required',
          message: 'Please provide a valid API key'
        });
      }

      // Validate API key format and permissions
      const isValid = await this.validateApiKey(apiKey, requiredKeyType);
      
      if (!isValid) {
        await auditLogger.log({
          action: 'invalid_api_key',
          providedKey: apiKey.substring(0, 8) + '...',
          clientIP: req.ip,
          endpoint: req.path,
          timestamp: new Date().toISOString()
        });

        return res.status(401).json({
          error: 'Invalid API key',
          message: 'The provided API key is invalid or expired'
        });
      }

      next();
    };
  }

  /**
   * Validate API key (mock implementation)
   */
  async validateApiKey(apiKey, keyType) {
    // This would integrate with your API key management system
    // For now, we'll perform basic validation
    
    if (!apiKey || apiKey.length < 32) {
      return false;
    }

    // Check key format (e.g., esop_sk_live_...)
    const keyPattern = /^esop_[a-z]{2}_[a-z]+_[a-zA-Z0-9]{32,}$/;
    return keyPattern.test(apiKey);
  }
}

// Create singleton instance
const securityMiddleware = new SecurityMiddleware();

module.exports = {
  SecurityMiddleware,
  securityMiddleware
};