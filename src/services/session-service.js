/**
 * Session Management Service
 * Comprehensive session handling with role-based timeouts and security
 */

const session = require('express-session');
const MongoStore = require('connect-mongo');
const RedisStore = require('connect-redis');
const redis = require('redis');
const { auth0Config, ROLES } = require('../../config/auth/auth0-config');
const { auditLogger } = require('./audit-service');
const crypto = require('crypto');

class SessionService {
  constructor() {
    this.config = auth0Config.session;
    this.store = this.initializeStore();
    this.activeSessions = new Map(); // In-memory tracking for critical sessions
  }

  /**
   * Initialize session store based on environment
   */
  initializeStore() {
    const storeType = process.env.SESSION_STORE_TYPE || 'memory';

    switch (storeType) {
      case 'redis':
        return this.initializeRedisStore();
      case 'mongodb':
        return this.initializeMongoStore();
      default:
        // Memory store (development only)
        console.warn('Using memory store - not recommended for production');
        return null;
    }
  }

  /**
   * Initialize Redis session store
   */
  initializeRedisStore() {
    try {
      const redisClient = redis.createClient({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB || 0,
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3
      });

      redisClient.on('error', (err) => {
        console.error('Redis session store error:', err);
      });

      redisClient.on('connect', () => {
        console.log('Redis session store connected');
      });

      return new RedisStore({ client: redisClient });
    } catch (error) {
      console.error('Failed to initialize Redis store:', error);
      return null;
    }
  }

  /**
   * Initialize MongoDB session store
   */
  initializeMongoStore() {
    try {
      return MongoStore.create({
        mongoUrl: process.env.MONGODB_SESSION_URI || process.env.MONGODB_URI,
        dbName: process.env.MONGODB_SESSION_DB || 'sessions',
        collectionName: 'user_sessions',
        ttl: 24 * 60 * 60, // 1 day default
        autoRemove: 'native',
        crypto: {
          secret: process.env.SESSION_ENCRYPTION_KEY || this.config.secret
        }
      });
    } catch (error) {
      console.error('Failed to initialize MongoDB store:', error);
      return null;
    }
  }

  /**
   * Get session middleware configuration
   */
  getSessionMiddleware() {
    const sessionConfig = {
      ...this.config,
      store: this.store,
      genid: () => {
        return crypto.randomBytes(32).toString('hex');
      },
      rolling: true, // Reset expiration on activity
      
      // Enhanced cookie security
      cookie: {
        ...this.config.cookie,
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'strict'
      }
    };

    return session(sessionConfig);
  }

  /**
   * Create session for user with role-based configuration
   */
  async createSession(req, user) {
    try {
      const sessionId = req.sessionID || crypto.randomBytes(32).toString('hex');
      const now = new Date();
      
      // Determine session timeout based on role
      const timeout = this.getSessionTimeout(user.roleType);
      const expiresAt = new Date(now.getTime() + timeout);

      // Create session data
      const sessionData = {
        sessionId: sessionId,
        userId: user.sub,
        email: user.email,
        roleType: user.roleType,
        securityLevel: user.securityLevel,
        createdAt: now,
        lastActivity: now,
        expiresAt: expiresAt,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        
        // Security tracking
        loginMethod: user.loginMethod || 'password',
        mfaVerified: user.mfaVerified || false,
        deviceFingerprint: this.generateDeviceFingerprint(req),
        
        // Role-specific data
        roleSpecificData: this.getRoleSpecificSessionData(user.roleType, user),
        
        // Security flags
        highSecurity: this.isHighSecurityRole(user.roleType),
        requiresMfa: auth0Config.mfa.required.includes(user.roleType),
        networkRestricted: user.roleType === ROLES.WITNESS
      };

      // Store session in request
      req.session.user = sessionData;
      req.session.startTime = now.getTime();

      // Track in memory for high-security sessions
      if (sessionData.highSecurity) {
        this.activeSessions.set(sessionId, sessionData);
      }

      // Log session creation
      await auditLogger.logAuth({
        action: 'session_created',
        userId: user.sub,
        email: user.email,
        roleType: user.roleType,
        sessionId: sessionId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        expiresAt: expiresAt.toISOString()
      });

      return sessionId;

    } catch (error) {
      console.error('Session creation failed:', error);
      throw error;
    }
  }

  /**
   * Validate and refresh session
   */
  async validateSession(req, res, next) {
    try {
      if (!req.session?.user) {
        return next(); // No session to validate
      }

      const sessionData = req.session.user;
      const now = new Date();

      // Check if session has expired
      if (now > new Date(sessionData.expiresAt)) {
        await this.destroySession(req, 'session_expired');
        return res.status(401).json({ error: 'Session expired' });
      }

      // Check for role-specific timeout
      const maxInactivity = this.getInactivityTimeout(sessionData.roleType);
      const lastActivity = new Date(sessionData.lastActivity);
      
      if (now - lastActivity > maxInactivity) {
        await this.destroySession(req, 'inactivity_timeout');
        return res.status(401).json({ error: 'Session expired due to inactivity' });
      }

      // Validate session integrity for high-security roles
      if (sessionData.highSecurity) {
        const isValid = await this.validateSessionIntegrity(req, sessionData);
        if (!isValid) {
          await this.destroySession(req, 'session_integrity_violation');
          return res.status(401).json({ error: 'Session validation failed' });
        }
      }

      // Check for suspicious activity
      const suspiciousActivity = await this.detectSuspiciousActivity(req, sessionData);
      if (suspiciousActivity) {
        await this.handleSuspiciousActivity(req, sessionData, suspiciousActivity);
        return res.status(401).json({ error: 'Session terminated due to suspicious activity' });
      }

      // Update last activity
      sessionData.lastActivity = now;
      req.session.user = sessionData;

      // Update in-memory tracking
      if (sessionData.highSecurity) {
        this.activeSessions.set(sessionData.sessionId, sessionData);
      }

      next();

    } catch (error) {
      console.error('Session validation failed:', error);
      await this.destroySession(req, 'validation_error');
      return res.status(500).json({ error: 'Session validation error' });
    }
  }

  /**
   * Destroy session
   */
  async destroySession(req, reason = 'manual_logout') {
    try {
      const sessionData = req.session?.user;
      
      if (sessionData) {
        // Log session destruction
        await auditLogger.logAuth({
          action: 'session_destroyed',
          userId: sessionData.userId,
          email: sessionData.email,
          roleType: sessionData.roleType,
          sessionId: sessionData.sessionId,
          reason: reason,
          duration: Date.now() - new Date(sessionData.createdAt).getTime(),
          ip: req.ip
        });

        // Remove from in-memory tracking
        this.activeSessions.delete(sessionData.sessionId);
      }

      // Destroy session
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destruction error:', err);
        }
      });

      return true;

    } catch (error) {
      console.error('Session destruction failed:', error);
      return false;
    }
  }

  /**
   * Get session timeout based on role
   */
  getSessionTimeout(roleType) {
    const timeouts = {
      [ROLES.WITNESS]: auth0Config.networkAcl.witness.maxSessionDuration,
      [ROLES.LEGAL_TEAM]: 8 * 60 * 60 * 1000, // 8 hours
      [ROLES.GOVERNMENT_ENTITY]: 8 * 60 * 60 * 1000, // 8 hours
      [ROLES.ESOP_PARTICIPANT]: 4 * 60 * 60 * 1000, // 4 hours
      [ROLES.MEDIA_CONTACT]: 2 * 60 * 60 * 1000, // 2 hours
      [ROLES.OPPOSITION]: 1 * 60 * 60 * 1000 // 1 hour
    };

    return timeouts[roleType] || auth0Config.networkAcl.confidential.maxSessionDuration;
  }

  /**
   * Get inactivity timeout based on role
   */
  getInactivityTimeout(roleType) {
    const timeouts = {
      [ROLES.WITNESS]: 30 * 60 * 1000, // 30 minutes
      [ROLES.LEGAL_TEAM]: 60 * 60 * 1000, // 1 hour
      [ROLES.GOVERNMENT_ENTITY]: 60 * 60 * 1000, // 1 hour
      [ROLES.ESOP_PARTICIPANT]: 45 * 60 * 1000, // 45 minutes
      [ROLES.MEDIA_CONTACT]: 30 * 60 * 1000, // 30 minutes
      [ROLES.OPPOSITION]: 15 * 60 * 1000 // 15 minutes
    };

    return timeouts[roleType] || 30 * 60 * 1000;
  }

  /**
   * Check if role requires high security
   */
  isHighSecurityRole(roleType) {
    return [ROLES.WITNESS, ROLES.LEGAL_TEAM, ROLES.GOVERNMENT_ENTITY].includes(roleType);
  }

  /**
   * Get role-specific session data
   */
  getRoleSpecificSessionData(roleType, user) {
    const data = {};

    switch (roleType) {
      case ROLES.WITNESS:
        data.anonymityRequired = true;
        data.networkRestricted = true;
        data.auditTrailEnabled = true;
        break;

      case ROLES.LEGAL_TEAM:
        data.privilegedAccess = true;
        data.documentAccess = 'secret';
        data.canApproveUsers = true;
        break;

      case ROLES.GOVERNMENT_ENTITY:
        data.officialCapacity = true;
        data.documentAccess = 'confidential';
        data.jurisdictionLevel = user.metadata?.jurisdiction;
        break;

      case ROLES.ESOP_PARTICIPANT:
        data.employeeId = user.metadata?.employeeId;
        data.esopStake = user.metadata?.esopStake;
        break;

      case ROLES.MEDIA_CONTACT:
        data.outlet = user.metadata?.outlet;
        data.verificationStatus = user.metadata?.verificationStatus;
        data.accessLevel = 'public_only';
        break;

      case ROLES.OPPOSITION:
        data.restrictedAccess = true;
        data.accessLevel = 'public_only';
        data.monitored = true;
        break;
    }

    return data;
  }

  /**
   * Generate device fingerprint
   */
  generateDeviceFingerprint(req) {
    const userAgent = req.get('User-Agent') || '';
    const acceptLanguage = req.get('Accept-Language') || '';
    const acceptEncoding = req.get('Accept-Encoding') || '';
    
    const fingerprintData = `${userAgent}|${acceptLanguage}|${acceptEncoding}`;
    return crypto.createHash('sha256').update(fingerprintData).digest('hex');
  }

  /**
   * Validate session integrity
   */
  async validateSessionIntegrity(req, sessionData) {
    try {
      // Check device fingerprint
      const currentFingerprint = this.generateDeviceFingerprint(req);
      if (currentFingerprint !== sessionData.deviceFingerprint) {
        await auditLogger.logSecurityEvent({
          action: 'device_fingerprint_mismatch',
          userId: sessionData.userId,
          sessionId: sessionData.sessionId,
          expected: sessionData.deviceFingerprint,
          actual: currentFingerprint,
          ip: req.ip
        });
        return false;
      }

      // Check IP consistency for high-security roles
      if (sessionData.roleType === ROLES.WITNESS) {
        if (req.ip !== sessionData.ipAddress) {
          await auditLogger.logSecurityEvent({
            action: 'ip_address_change_witness',
            userId: sessionData.userId,
            sessionId: sessionData.sessionId,
            originalIp: sessionData.ipAddress,
            newIp: req.ip
          });
          return false;
        }
      }

      return true;

    } catch (error) {
      console.error('Session integrity validation failed:', error);
      return false;
    }
  }

  /**
   * Detect suspicious activity
   */
  async detectSuspiciousActivity(req, sessionData) {
    const suspicious = [];

    // Check for rapid IP changes
    if (req.ip !== sessionData.ipAddress) {
      const timeSinceLastActivity = Date.now() - new Date(sessionData.lastActivity).getTime();
      if (timeSinceLastActivity < 60000) { // Less than 1 minute
        suspicious.push('rapid_ip_change');
      }
    }

    // Check for unusual user agent changes
    const currentUserAgent = req.get('User-Agent');
    if (currentUserAgent !== sessionData.userAgent) {
      suspicious.push('user_agent_change');
    }

    // Check for multiple simultaneous sessions (if tracked globally)
    // This would require checking active sessions store
    
    return suspicious.length > 0 ? suspicious : null;
  }

  /**
   * Handle suspicious activity
   */
  async handleSuspiciousActivity(req, sessionData, suspiciousActivity) {
    await auditLogger.logSecurityEvent({
      action: 'suspicious_session_activity',
      userId: sessionData.userId,
      email: sessionData.email,
      sessionId: sessionData.sessionId,
      suspiciousActivity: suspiciousActivity,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'high'
    });

    // Destroy session for high-security roles
    if (this.isHighSecurityRole(sessionData.roleType)) {
      await this.destroySession(req, 'suspicious_activity');
    }
  }

  /**
   * Get active sessions for user (admin function)
   */
  async getUserSessions(userId) {
    try {
      // This would query the session store
      // For now, return in-memory high-security sessions
      const userSessions = [];
      
      for (const [sessionId, sessionData] of this.activeSessions.entries()) {
        if (sessionData.userId === userId) {
          userSessions.push({
            sessionId: sessionId,
            createdAt: sessionData.createdAt,
            lastActivity: sessionData.lastActivity,
            ipAddress: sessionData.ipAddress,
            userAgent: sessionData.userAgent
          });
        }
      }

      return userSessions;

    } catch (error) {
      console.error('Failed to get user sessions:', error);
      return [];
    }
  }

  /**
   * Terminate all user sessions (admin function)
   */
  async terminateUserSessions(userId, terminatedBy) {
    try {
      let terminated = 0;

      // Terminate in-memory sessions
      for (const [sessionId, sessionData] of this.activeSessions.entries()) {
        if (sessionData.userId === userId) {
          this.activeSessions.delete(sessionId);
          terminated++;
        }
      }

      // In a real implementation, you would also query and terminate
      // all sessions in the session store

      await auditLogger.logAdminAction({
        action: 'user_sessions_terminated',
        targetUserId: userId,
        terminatedBy: terminatedBy.sub,
        terminatedByEmail: terminatedBy.email,
        sessionCount: terminated
      });

      return terminated;

    } catch (error) {
      console.error('Failed to terminate user sessions:', error);
      throw error;
    }
  }

  /**
   * Get session statistics
   */
  getSessionStats() {
    const stats = {
      activeHighSecuritySessions: this.activeSessions.size,
      sessionsByRole: {},
      oldestSession: null,
      newestSession: null
    };

    // Calculate stats from in-memory sessions
    for (const sessionData of this.activeSessions.values()) {
      const role = sessionData.roleType;
      stats.sessionsByRole[role] = (stats.sessionsByRole[role] || 0) + 1;

      const createdAt = new Date(sessionData.createdAt);
      if (!stats.oldestSession || createdAt < new Date(stats.oldestSession)) {
        stats.oldestSession = sessionData.createdAt;
      }
      if (!stats.newestSession || createdAt > new Date(stats.newestSession)) {
        stats.newestSession = sessionData.createdAt;
      }
    }

    return stats;
  }
}

// Create singleton instance
const sessionService = new SessionService();

module.exports = {
  SessionService,
  sessionService
};