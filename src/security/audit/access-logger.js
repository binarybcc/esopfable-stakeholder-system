/**
 * Access Logger and Auditing System
 * Comprehensive logging for document access, user activities, and security events
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const winston = require('winston');
const { Writable } = require('stream');

class AccessLogger {
  constructor(config = {}) {
    this.config = {
      logPath: config.logPath || path.join(__dirname, '../../../logs'),
      maxFileSize: config.maxFileSize || 10 * 1024 * 1024, // 10MB
      maxFiles: config.maxFiles || 10,
      encryptLogs: config.encryptLogs || false,
      compressionEnabled: config.compressionEnabled || true,
      retention: config.retention || 365, // days
      ...config
    };

    this.loggers = new Map(); // category -> winston logger
    this.encryptionKey = this.getEncryptionKey();
    this.accessCounts = new Map(); // resource -> access count
    this.suspiciousPatterns = new Map(); // user -> suspicious activities

    this.initializeLoggers();
    this.startCleanupScheduler();
  }

  /**
   * Initialize category-specific loggers
   */
  async initializeLoggers() {
    const categories = [
      'document_access',
      'user_activity',
      'security_events',
      'authentication',
      'authorization',
      'file_operations',
      'network_activity',
      'admin_actions',
      'system_events'
    ];

    // Ensure log directory exists
    await fs.mkdir(this.config.logPath, { recursive: true });

    for (const category of categories) {
      this.loggers.set(category, this.createLogger(category));
    }

    console.log('Access logging system initialized');
  }

  /**
   * Create winston logger for a category
   */
  createLogger(category) {
    const logFilePath = path.join(this.config.logPath, `${category}.log`);
    
    const formats = [
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ];

    // Add encryption format if enabled
    if (this.config.encryptLogs) {
      formats.push(winston.format.printf(this.encryptLogEntry.bind(this)));
    }

    const transports = [
      new winston.transports.File({
        filename: logFilePath,
        maxsize: this.config.maxFileSize,
        maxFiles: this.config.maxFiles,
        tailable: true
      })
    ];

    // Add console transport in development
    if (process.env.NODE_ENV !== 'production') {
      transports.push(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }));
    }

    return winston.createLogger({
      format: winston.format.combine(...formats),
      transports,
      level: 'info'
    });
  }

  /**
   * Log document access event
   */
  async logDocumentAccess(accessData) {
    const logger = this.loggers.get('document_access');
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      event_type: 'document_access',
      user_id: accessData.userId,
      email: accessData.email,
      document_id: accessData.documentId,
      document_name: accessData.documentName,
      classification: accessData.classification,
      action: accessData.action, // view, download, edit, delete
      client_ip: accessData.clientIP,
      user_agent: accessData.userAgent,
      session_id: accessData.sessionId,
      success: accessData.success,
      denial_reason: accessData.denialReason,
      file_size: accessData.fileSize,
      access_duration: accessData.accessDuration,
      location: accessData.location // geographic location if available
    };

    // Track access patterns
    this.trackAccessPattern(accessData);

    // Check for suspicious activity
    await this.checkSuspiciousDocumentAccess(accessData);

    logger.info('Document access event', logEntry);
    
    // Update access statistics
    this.updateAccessStatistics(accessData);

    return logEntry;
  }

  /**
   * Log user activity
   */
  async logUserActivity(activityData) {
    const logger = this.loggers.get('user_activity');
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      event_type: 'user_activity',
      user_id: activityData.userId,
      email: activityData.email,
      role: activityData.role,
      action: activityData.action,
      resource_type: activityData.resourceType,
      resource_id: activityData.resourceId,
      client_ip: activityData.clientIP,
      user_agent: activityData.userAgent,
      session_id: activityData.sessionId,
      endpoint: activityData.endpoint,
      method: activityData.method,
      status_code: activityData.statusCode,
      response_time: activityData.responseTime,
      request_size: activityData.requestSize,
      response_size: activityData.responseSize
    };

    logger.info('User activity', logEntry);
    
    return logEntry;
  }

  /**
   * Log security event
   */
  async logSecurityEvent(eventData) {
    const logger = this.loggers.get('security_events');
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      event_type: 'security_event',
      severity: eventData.severity || 'medium',
      event_category: eventData.category, // authentication, authorization, threat, etc.
      user_id: eventData.userId,
      email: eventData.email,
      client_ip: eventData.clientIP,
      user_agent: eventData.userAgent,
      session_id: eventData.sessionId,
      threat_type: eventData.threatType,
      threat_description: eventData.description,
      blocked: eventData.blocked || false,
      action_taken: eventData.actionTaken,
      risk_score: eventData.riskScore,
      indicators: eventData.indicators || [],
      related_events: eventData.relatedEvents || []
    };

    // Immediate alert for critical events
    if (eventData.severity === 'critical') {
      await this.triggerImmediateAlert(logEntry);
    }

    logger.warn('Security event', logEntry);
    
    return logEntry;
  }

  /**
   * Log authentication event
   */
  async logAuthentication(authData) {
    const logger = this.loggers.get('authentication');
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      event_type: 'authentication',
      user_id: authData.userId,
      email: authData.email,
      auth_method: authData.method, // password, mfa, token, etc.
      success: authData.success,
      failure_reason: authData.failureReason,
      client_ip: authData.clientIP,
      user_agent: authData.userAgent,
      session_id: authData.sessionId,
      token_id: authData.tokenId,
      location: authData.location,
      device_fingerprint: authData.deviceFingerprint,
      previous_login: authData.previousLogin,
      failed_attempts: authData.failedAttempts || 0
    };

    // Track failed attempts
    if (!authData.success) {
      await this.trackFailedAuthentication(authData);
    }

    logger.info('Authentication event', logEntry);
    
    return logEntry;
  }

  /**
   * Log file operation
   */
  async logFileOperation(operationData) {
    const logger = this.loggers.get('file_operations');
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      event_type: 'file_operation',
      user_id: operationData.userId,
      email: operationData.email,
      operation: operationData.operation, // upload, download, delete, encrypt, decrypt
      file_path: operationData.filePath,
      file_name: operationData.fileName,
      file_size: operationData.fileSize,
      file_type: operationData.fileType,
      classification: operationData.classification,
      encryption_key_id: operationData.encryptionKeyId,
      success: operationData.success,
      error_message: operationData.errorMessage,
      client_ip: operationData.clientIP,
      processing_time: operationData.processingTime,
      hash_before: operationData.hashBefore,
      hash_after: operationData.hashAfter
    };

    logger.info('File operation', logEntry);
    
    return logEntry;
  }

  /**
   * Log network activity
   */
  async logNetworkActivity(networkData) {
    const logger = this.loggers.get('network_activity');
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      event_type: 'network_activity',
      client_ip: networkData.clientIP,
      destination_ip: networkData.destinationIP,
      port: networkData.port,
      protocol: networkData.protocol,
      user_id: networkData.userId,
      action: networkData.action, // connect, disconnect, block, allow
      bytes_sent: networkData.bytesSent,
      bytes_received: networkData.bytesReceived,
      connection_duration: networkData.connectionDuration,
      blocked: networkData.blocked || false,
      block_reason: networkData.blockReason,
      geo_location: networkData.geoLocation,
      asn: networkData.asn,
      threat_intel: networkData.threatIntel
    };

    logger.info('Network activity', logEntry);
    
    return logEntry;
  }

  /**
   * Log admin action
   */
  async logAdminAction(actionData) {
    const logger = this.loggers.get('admin_actions');
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      event_type: 'admin_action',
      admin_user_id: actionData.adminUserId,
      admin_email: actionData.adminEmail,
      action: actionData.action,
      target_user_id: actionData.targetUserId,
      target_email: actionData.targetEmail,
      target_resource: actionData.targetResource,
      changes: actionData.changes,
      justification: actionData.justification,
      client_ip: actionData.clientIP,
      session_id: actionData.sessionId,
      success: actionData.success,
      error_message: actionData.errorMessage,
      approval_required: actionData.approvalRequired || false,
      approved_by: actionData.approvedBy
    };

    // Admin actions require higher logging level
    logger.warn('Admin action', logEntry);
    
    return logEntry;
  }

  /**
   * Search logs by criteria
   */
  async searchLogs(criteria) {
    try {
      const results = [];
      const categories = criteria.categories || Array.from(this.loggers.keys());

      for (const category of categories) {
        const logFile = path.join(this.config.logPath, `${category}.log`);
        
        try {
          const content = await fs.readFile(logFile, 'utf8');
          const lines = content.split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              
              if (this.matchesCriteria(entry, criteria)) {
                results.push({ category, entry });
              }
            } catch (parseError) {
              // Skip invalid JSON lines
              continue;
            }
          }
        } catch (fileError) {
          // Skip missing log files
          continue;
        }
      }

      // Sort by timestamp (newest first)
      results.sort((a, b) => new Date(b.entry.timestamp) - new Date(a.entry.timestamp));

      // Apply limit
      if (criteria.limit) {
        return results.slice(0, criteria.limit);
      }

      return results;
    } catch (error) {
      console.error('Log search failed:', error);
      throw new Error('Failed to search logs');
    }
  }

  /**
   * Check if log entry matches search criteria
   */
  matchesCriteria(entry, criteria) {
    // Time range filter
    if (criteria.startTime || criteria.endTime) {
      const entryTime = new Date(entry.timestamp);
      
      if (criteria.startTime && entryTime < new Date(criteria.startTime)) {
        return false;
      }
      
      if (criteria.endTime && entryTime > new Date(criteria.endTime)) {
        return false;
      }
    }

    // User filter
    if (criteria.userId && entry.user_id !== criteria.userId) {
      return false;
    }

    if (criteria.email && entry.email !== criteria.email) {
      return false;
    }

    // IP filter
    if (criteria.clientIP && entry.client_ip !== criteria.clientIP) {
      return false;
    }

    // Event type filter
    if (criteria.eventType && entry.event_type !== criteria.eventType) {
      return false;
    }

    // Action filter
    if (criteria.action && entry.action !== criteria.action) {
      return false;
    }

    // Severity filter
    if (criteria.severity && entry.severity !== criteria.severity) {
      return false;
    }

    // Text search in all fields
    if (criteria.searchText) {
      const searchText = criteria.searchText.toLowerCase();
      const entryText = JSON.stringify(entry).toLowerCase();
      
      if (!entryText.includes(searchText)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Generate access report
   */
  async generateAccessReport(options = {}) {
    const endTime = options.endTime || new Date();
    const startTime = options.startTime || new Date(endTime.getTime() - (24 * 60 * 60 * 1000)); // Last 24 hours

    try {
      const logs = await this.searchLogs({
        categories: ['document_access', 'user_activity', 'security_events'],
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString()
      });

      const report = {
        generated_at: new Date().toISOString(),
        period: {
          start: startTime.toISOString(),
          end: endTime.toISOString()
        },
        summary: {
          total_events: logs.length,
          document_accesses: logs.filter(l => l.category === 'document_access').length,
          user_activities: logs.filter(l => l.category === 'user_activity').length,
          security_events: logs.filter(l => l.category === 'security_events').length,
          unique_users: new Set(logs.map(l => l.entry.user_id).filter(Boolean)).size,
          unique_ips: new Set(logs.map(l => l.entry.client_ip).filter(Boolean)).size
        },
        top_accessed_documents: this.getTopAccessedDocuments(logs),
        most_active_users: this.getMostActiveUsers(logs),
        suspicious_activities: this.getSuspiciousActivities(logs),
        security_incidents: this.getSecurityIncidents(logs),
        access_patterns: this.getAccessPatterns(logs)
      };

      return report;
    } catch (error) {
      console.error('Failed to generate access report:', error);
      throw new Error('Failed to generate access report');
    }
  }

  /**
   * Track access patterns for anomaly detection
   */
  trackAccessPattern(accessData) {
    const userKey = `${accessData.userId}:${accessData.clientIP}`;
    const hour = new Date().getHours();
    
    if (!this.accessCounts.has(userKey)) {
      this.accessCounts.set(userKey, {
        total: 0,
        byHour: new Array(24).fill(0),
        documents: new Set(),
        lastAccess: null
      });
    }

    const pattern = this.accessCounts.get(userKey);
    pattern.total++;
    pattern.byHour[hour]++;
    pattern.documents.add(accessData.documentId);
    pattern.lastAccess = new Date();
  }

  /**
   * Check for suspicious document access patterns
   */
  async checkSuspiciousDocumentAccess(accessData) {
    const indicators = [];

    // Check for unusual access times
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) { // Outside business hours
      indicators.push('off_hours_access');
    }

    // Check for rapid successive access
    const userKey = `${accessData.userId}:${accessData.clientIP}`;
    const pattern = this.accessCounts.get(userKey);
    
    if (pattern && pattern.lastAccess) {
      const timeDiff = Date.now() - pattern.lastAccess.getTime();
      if (timeDiff < 1000) { // Less than 1 second between accesses
        indicators.push('rapid_access');
      }
    }

    // Check for access to unusual classification levels
    if (accessData.classification === 'secret' || accessData.classification === 'top_secret') {
      indicators.push('high_classification_access');
    }

    // Check for bulk downloads
    if (accessData.action === 'download' && pattern && pattern.documents.size > 10) {
      indicators.push('bulk_download');
    }

    if (indicators.length > 0) {
      await this.logSecurityEvent({
        severity: 'medium',
        category: 'suspicious_access',
        userId: accessData.userId,
        email: accessData.email,
        clientIP: accessData.clientIP,
        threatType: 'anomalous_access_pattern',
        description: 'Suspicious document access pattern detected',
        indicators: indicators,
        documentId: accessData.documentId,
        classification: accessData.classification
      });
    }
  }

  /**
   * Track failed authentication attempts
   */
  async trackFailedAuthentication(authData) {
    const ipKey = authData.clientIP;
    const userKey = authData.email;
    
    // Track by IP
    if (!this.suspiciousPatterns.has(ipKey)) {
      this.suspiciousPatterns.set(ipKey, {
        failedLogins: 0,
        lastAttempt: null,
        users: new Set()
      });
    }

    const ipPattern = this.suspiciousPatterns.get(ipKey);
    ipPattern.failedLogins++;
    ipPattern.lastAttempt = new Date();
    ipPattern.users.add(userKey);

    // Alert on suspicious patterns
    if (ipPattern.failedLogins >= 5) {
      await this.logSecurityEvent({
        severity: 'high',
        category: 'authentication_threat',
        clientIP: authData.clientIP,
        threatType: 'brute_force_attack',
        description: 'Multiple failed login attempts detected',
        indicators: ['repeated_failures', 'multiple_users'],
        failedAttempts: ipPattern.failedLogins,
        targetedUsers: Array.from(ipPattern.users)
      });
    }
  }

  /**
   * Trigger immediate alert for critical events
   */
  async triggerImmediateAlert(logEntry) {
    // This would integrate with your alerting system
    console.error('CRITICAL SECURITY EVENT:', JSON.stringify(logEntry, null, 2));
    
    // Send to external monitoring systems, email, Slack, etc.
    // Implementation would depend on your alerting infrastructure
  }

  /**
   * Encrypt log entry if encryption is enabled
   */
  encryptLogEntry(info) {
    if (!this.config.encryptLogs || !this.encryptionKey) {
      return JSON.stringify(info);
    }

    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipherGCM('aes-256-gcm', this.encryptionKey, iv);
      
      const plaintext = JSON.stringify(info);
      const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();

      const result = {
        encrypted: true,
        iv: iv.toString('base64'),
        data: encrypted.toString('base64'),
        tag: tag.toString('base64'),
        timestamp: info.timestamp
      };

      return JSON.stringify(result);
    } catch (error) {
      console.error('Log encryption failed:', error);
      return JSON.stringify(info); // Fallback to unencrypted
    }
  }

  /**
   * Get encryption key for log encryption
   */
  getEncryptionKey() {
    const key = process.env.LOG_ENCRYPTION_KEY;
    if (key) {
      return Buffer.from(key, 'base64');
    }
    return null;
  }

  /**
   * Update access statistics
   */
  updateAccessStatistics(accessData) {
    // This would typically update database statistics
    // For now, we'll just maintain in-memory counts
  }

  /**
   * Get top accessed documents from logs
   */
  getTopAccessedDocuments(logs) {
    const documentCounts = new Map();
    
    logs
      .filter(l => l.category === 'document_access' && l.entry.success)
      .forEach(l => {
        const docId = l.entry.document_id;
        documentCounts.set(docId, (documentCounts.get(docId) || 0) + 1);
      });

    return Array.from(documentCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([documentId, count]) => ({ documentId, accessCount: count }));
  }

  /**
   * Get most active users from logs
   */
  getMostActiveUsers(logs) {
    const userCounts = new Map();
    
    logs
      .filter(l => l.entry.user_id)
      .forEach(l => {
        const userId = l.entry.user_id;
        userCounts.set(userId, (userCounts.get(userId) || 0) + 1);
      });

    return Array.from(userCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, count]) => ({ userId, activityCount: count }));
  }

  /**
   * Get suspicious activities from logs
   */
  getSuspiciousActivities(logs) {
    return logs
      .filter(l => l.category === 'security_events' && l.entry.severity === 'high')
      .slice(0, 20);
  }

  /**
   * Get security incidents from logs
   */
  getSecurityIncidents(logs) {
    return logs
      .filter(l => l.category === 'security_events' && l.entry.severity === 'critical')
      .slice(0, 10);
  }

  /**
   * Get access patterns from logs
   */
  getAccessPatterns(logs) {
    const patterns = {
      byHour: new Array(24).fill(0),
      byDay: new Array(7).fill(0),
      byIP: new Map()
    };

    logs.forEach(l => {
      const timestamp = new Date(l.entry.timestamp);
      const hour = timestamp.getHours();
      const day = timestamp.getDay();
      
      patterns.byHour[hour]++;
      patterns.byDay[day]++;
      
      if (l.entry.client_ip) {
        const ip = l.entry.client_ip;
        patterns.byIP.set(ip, (patterns.byIP.get(ip) || 0) + 1);
      }
    });

    return {
      hourly: patterns.byHour,
      daily: patterns.byDay,
      topIPs: Array.from(patterns.byIP.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([ip, count]) => ({ ip, count }))
    };
  }

  /**
   * Start cleanup scheduler for old logs
   */
  startCleanupScheduler() {
    // Run cleanup daily at 2 AM
    setInterval(() => {
      this.cleanupOldLogs();
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Clean up old log files
   */
  async cleanupOldLogs() {
    try {
      const cutoffDate = new Date(Date.now() - (this.config.retention * 24 * 60 * 60 * 1000));
      const files = await fs.readdir(this.config.logPath);
      
      for (const file of files) {
        if (file.endsWith('.log')) {
          const filePath = path.join(this.config.logPath, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            console.log(`Deleted old log file: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error('Log cleanup failed:', error);
    }
  }
}

// Create singleton instance
const accessLogger = new AccessLogger();

module.exports = {
  AccessLogger,
  accessLogger
};