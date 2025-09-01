/**
 * JWT Token Manager
 * Handles JWT token creation, validation, refresh, and blacklisting
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Redis } = require('ioredis');
const { auditLogger } = require('../../services/audit-service');

class JwtManager {
  constructor(config = {}) {
    this.accessTokenSecret = config.accessTokenSecret || process.env.JWT_ACCESS_SECRET;
    this.refreshTokenSecret = config.refreshTokenSecret || process.env.JWT_REFRESH_SECRET;
    this.accessTokenExpiry = config.accessTokenExpiry || '15m';
    this.refreshTokenExpiry = config.refreshTokenExpiry || '7d';
    this.issuer = config.issuer || 'esopfable-case-management';
    this.audience = config.audience || 'esopfable-users';
    
    // Redis for token blacklisting and session management
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });
  }

  /**
   * Generate access and refresh token pair
   */
  async generateTokenPair(user, sessionInfo = {}) {
    try {
      const tokenId = crypto.randomUUID();
      const sessionId = crypto.randomUUID();
      
      const basePayload = {
        sub: user.id,
        email: user.email,
        roleType: user.roleType,
        organizationId: user.organizationId,
        clearanceLevel: user.clearanceLevel,
        sessionId: sessionId,
        tokenId: tokenId,
        iss: this.issuer,
        aud: this.audience
      };

      // Access token with short expiry
      const accessToken = jwt.sign(
        {
          ...basePayload,
          type: 'access',
          permissions: user.permissions || []
        },
        this.accessTokenSecret,
        { 
          expiresIn: this.accessTokenExpiry,
          algorithm: 'HS256'
        }
      );

      // Refresh token with longer expiry
      const refreshToken = jwt.sign(
        {
          ...basePayload,
          type: 'refresh'
        },
        this.refreshTokenSecret,
        { 
          expiresIn: this.refreshTokenExpiry,
          algorithm: 'HS256'
        }
      );

      // Store session info in Redis
      await this.storeSession(sessionId, {
        userId: user.id,
        tokenId: tokenId,
        userAgent: sessionInfo.userAgent,
        ipAddress: sessionInfo.ipAddress,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        refreshToken: await this.hashToken(refreshToken)
      });

      // Log token generation
      await auditLogger.log({
        action: 'token_generated',
        userId: user.id,
        email: user.email,
        sessionId: sessionId,
        tokenId: tokenId,
        userAgent: sessionInfo.userAgent,
        ipAddress: sessionInfo.ipAddress,
        timestamp: new Date().toISOString()
      });

      return {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: this.parseExpiry(this.accessTokenExpiry),
        sessionId
      };
    } catch (error) {
      console.error('Token generation failed:', error);
      throw new Error('Failed to generate authentication tokens');
    }
  }

  /**
   * Verify and decode access token
   */
  async verifyAccessToken(token) {
    try {
      // Check if token is blacklisted
      const isBlacklisted = await this.isTokenBlacklisted(token);
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }

      const decoded = jwt.verify(token, this.accessTokenSecret, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['HS256']
      });

      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      // Verify session is still active
      const session = await this.getSession(decoded.sessionId);
      if (!session || session.tokenId !== decoded.tokenId) {
        throw new Error('Session not found or token mismatch');
      }

      // Update last activity
      await this.updateSessionActivity(decoded.sessionId);

      return decoded;
    } catch (error) {
      console.error('Access token verification failed:', error);
      throw error;
    }
  }

  /**
   * Verify refresh token and generate new token pair
   */
  async refreshTokens(refreshToken, sessionInfo = {}) {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.refreshTokenSecret, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['HS256']
      });

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Get session and verify refresh token
      const session = await this.getSession(decoded.sessionId);
      if (!session || session.tokenId !== decoded.tokenId) {
        throw new Error('Session not found or token mismatch');
      }

      const storedTokenHash = session.refreshToken;
      const providedTokenHash = await this.hashToken(refreshToken);
      
      if (storedTokenHash !== providedTokenHash) {
        throw new Error('Invalid refresh token');
      }

      // Create user object for new token generation
      const user = {
        id: decoded.sub,
        email: decoded.email,
        roleType: decoded.roleType,
        organizationId: decoded.organizationId,
        clearanceLevel: decoded.clearanceLevel,
        permissions: [] // Would typically fetch from database
      };

      // Revoke old tokens
      await this.revokeSession(decoded.sessionId);

      // Generate new token pair
      const newTokens = await this.generateTokenPair(user, sessionInfo);

      await auditLogger.log({
        action: 'token_refreshed',
        userId: decoded.sub,
        email: decoded.email,
        oldSessionId: decoded.sessionId,
        newSessionId: newTokens.sessionId,
        ipAddress: sessionInfo.ipAddress,
        timestamp: new Date().toISOString()
      });

      return newTokens;
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }

  /**
   * Revoke all tokens for a session
   */
  async revokeSession(sessionId) {
    try {
      const session = await this.getSession(sessionId);
      if (session) {
        // Add tokens to blacklist
        const accessTokenExpiry = this.parseExpiry(this.accessTokenExpiry);
        const refreshTokenExpiry = this.parseExpiry(this.refreshTokenExpiry);
        
        await this.blacklistToken(session.tokenId, Math.max(accessTokenExpiry, refreshTokenExpiry));
        
        // Remove session
        await this.redis.del(`session:${sessionId}`);

        await auditLogger.log({
          action: 'session_revoked',
          sessionId: sessionId,
          userId: session.userId,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Session revocation failed:', error);
      throw error;
    }
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllUserSessions(userId) {
    try {
      const sessionKeys = await this.redis.keys(`session:*`);
      const revokedSessions = [];

      for (const key of sessionKeys) {
        const session = await this.redis.hgetall(key);
        if (session.userId === userId.toString()) {
          const sessionId = key.replace('session:', '');
          await this.revokeSession(sessionId);
          revokedSessions.push(sessionId);
        }
      }

      await auditLogger.log({
        action: 'all_user_sessions_revoked',
        userId: userId,
        revokedSessions: revokedSessions.length,
        timestamp: new Date().toISOString()
      });

      return revokedSessions;
    } catch (error) {
      console.error('All user sessions revocation failed:', error);
      throw error;
    }
  }

  /**
   * Store session information in Redis
   */
  async storeSession(sessionId, sessionData) {
    const expiry = this.parseExpiry(this.refreshTokenExpiry);
    await this.redis.hmset(`session:${sessionId}`, sessionData);
    await this.redis.expire(`session:${sessionId}`, expiry);
  }

  /**
   * Get session information from Redis
   */
  async getSession(sessionId) {
    const session = await this.redis.hgetall(`session:${sessionId}`);
    return Object.keys(session).length > 0 ? session : null;
  }

  /**
   * Update session last activity
   */
  async updateSessionActivity(sessionId) {
    await this.redis.hset(`session:${sessionId}`, 'lastActivity', new Date().toISOString());
  }

  /**
   * Blacklist a token
   */
  async blacklistToken(tokenId, expirySeconds) {
    await this.redis.setex(`blacklist:${tokenId}`, expirySeconds, '1');
  }

  /**
   * Check if token is blacklisted
   */
  async isTokenBlacklisted(token) {
    try {
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.tokenId) {
        return false;
      }
      
      const result = await this.redis.get(`blacklist:${decoded.tokenId}`);
      return result === '1';
    } catch (error) {
      return false;
    }
  }

  /**
   * Hash token for secure storage
   */
  async hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Parse expiry time to seconds
   */
  parseExpiry(expiry) {
    const matches = expiry.match(/^(\d+)([smhd])$/);
    if (!matches) {
      throw new Error('Invalid expiry format');
    }

    const value = parseInt(matches[1]);
    const unit = matches[2];
    
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: throw new Error('Invalid expiry unit');
    }
  }

  /**
   * Get active sessions for a user
   */
  async getUserSessions(userId) {
    try {
      const sessionKeys = await this.redis.keys(`session:*`);
      const userSessions = [];

      for (const key of sessionKeys) {
        const session = await this.redis.hgetall(key);
        if (session.userId === userId.toString()) {
          userSessions.push({
            sessionId: key.replace('session:', ''),
            ...session
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
   * Clean up expired sessions (maintenance function)
   */
  async cleanupExpiredSessions() {
    try {
      const sessionKeys = await this.redis.keys(`session:*`);
      let cleaned = 0;

      for (const key of sessionKeys) {
        const ttl = await this.redis.ttl(key);
        if (ttl === -1) { // No expiry set
          await this.redis.del(key);
          cleaned++;
        }
      }

      console.log(`Cleaned up ${cleaned} expired sessions`);
      return cleaned;
    } catch (error) {
      console.error('Session cleanup failed:', error);
      return 0;
    }
  }

  /**
   * Get token statistics
   */
  async getTokenStats() {
    try {
      const sessionKeys = await this.redis.keys(`session:*`);
      const blacklistKeys = await this.redis.keys(`blacklist:*`);

      return {
        activeSessions: sessionKeys.length,
        blacklistedTokens: blacklistKeys.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to get token stats:', error);
      return {
        activeSessions: 0,
        blacklistedTokens: 0,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Create singleton instance
const jwtManager = new JwtManager();

module.exports = {
  JwtManager,
  jwtManager
};