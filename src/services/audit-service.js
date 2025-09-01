/**
 * Audit Service
 * Comprehensive logging and audit trail for security and compliance
 */

const crypto = require('crypto');
const { auth0Config } = require('../../config/auth/auth0-config');

class AuditService {
  constructor() {
    this.config = auth0Config.audit;
    this.logQueue = [];
    this.processingQueue = false;
    
    // Initialize encryption for sensitive logs
    this.encryptionKey = process.env.AUDIT_ENCRYPTION_KEY || crypto.randomBytes(32);
    this.algorithm = 'aes-256-gcm';
    
    // Start periodic queue processing
    setInterval(() => this.processLogQueue(), 5000); // Process every 5 seconds
  }

  /**
   * Log authentication events
   */
  async logAuth(eventData) {
    const logEntry = {
      category: 'authentication',
      ...eventData,
      timestamp: eventData.timestamp || new Date().toISOString(),
      severity: this.determineSeverity('authentication', eventData.action)
    };

    return this.log(logEntry);
  }

  /**
   * Log document access events
   */
  async logDocumentAccess(eventData) {
    const logEntry = {
      category: 'document_access',
      ...eventData,
      timestamp: eventData.timestamp || new Date().toISOString(),
      severity: this.determineSeverity('document_access', eventData.action)
    };

    return this.log(logEntry);
  }

  /**
   * Log stakeholder access events
   */
  async logStakeholderAccess(eventData) {
    const logEntry = {
      category: 'stakeholder_access',
      ...eventData,
      timestamp: eventData.timestamp || new Date().toISOString(),
      severity: this.determineSeverity('stakeholder_access', eventData.action)
    };

    return this.log(logEntry);
  }

  /**
   * Log admin actions
   */
  async logAdminAction(eventData) {
    const logEntry = {
      category: 'admin_action',
      ...eventData,
      timestamp: eventData.timestamp || new Date().toISOString(),
      severity: 'high'
    };

    return this.log(logEntry);
  }

  /**
   * Log security events
   */
  async logSecurityEvent(eventData) {
    const logEntry = {
      category: 'security',
      ...eventData,
      timestamp: eventData.timestamp || new Date().toISOString(),
      severity: eventData.severity || 'high'
    };

    return this.log(logEntry);
  }

  /**
   * Log risk events
   */
  async logRiskEvent(eventData) {
    const logEntry = {
      category: 'risk_management',
      ...eventData,
      timestamp: eventData.timestamp || new Date().toISOString(),
      severity: this.determineSeverity('risk_management', eventData.action)
    };

    return this.log(logEntry);
  }

  /**
   * Main logging function
   */
  async log(eventData) {
    if (!this.config.enabled) {
      return;
    }

    try {
      // Generate unique event ID
      const eventId = crypto.randomUUID();
      
      // Create comprehensive log entry
      const logEntry = {
        id: eventId,
        timestamp: eventData.timestamp || new Date().toISOString(),
        category: eventData.category,
        action: eventData.action,
        userId: eventData.userId,
        email: eventData.email,
        roleType: eventData.roleType,
        resourceType: eventData.resourceType,
        resourceId: eventData.resourceId,
        severity: eventData.severity || 'info',
        clientIP: this.anonymizeIP(eventData.ip || eventData.clientIP),
        userAgent: eventData.userAgent,
        sessionId: eventData.sessionId,
        requestId: eventData.requestId,
        metadata: eventData.metadata || {},
        
        // Additional context
        environment: process.env.NODE_ENV || 'development',
        application: 'esopfable-case-management',
        version: process.env.APP_VERSION || '1.0.0',
        
        // Security context
        securityLevel: eventData.securityLevel,
        classificationLevel: eventData.classificationLevel,
        networkLocation: eventData.networkLocation,
        
        // Compliance fields
        retainUntil: this.calculateRetentionDate(),
        complianceFlags: this.getComplianceFlags(eventData),
        
        // Integrity check
        checksum: null // Will be calculated after encryption
      };

      // Remove sensitive data based on configuration
      const sanitizedEntry = this.sanitizeLogEntry(logEntry);

      // Encrypt sensitive fields if configured
      const processedEntry = this.config.encryption 
        ? await this.encryptSensitiveFields(sanitizedEntry)
        : sanitizedEntry;

      // Calculate integrity checksum
      processedEntry.checksum = this.calculateChecksum(processedEntry);

      // Add to queue for processing
      this.logQueue.push(processedEntry);

      // For high-severity events, process immediately
      if (processedEntry.severity === 'critical' || processedEntry.severity === 'high') {
        await this.processLogQueue();
      }

      return eventId;

    } catch (error) {
      console.error('Audit logging failed:', error);
      
      // Fallback logging to console for critical events
      if (eventData.severity === 'critical') {
        console.error('CRITICAL SECURITY EVENT:', JSON.stringify(eventData, null, 2));
      }
      
      throw error;
    }
  }

  /**
   * Process log queue
   */
  async processLogQueue() {
    if (this.processingQueue || this.logQueue.length === 0) {
      return;
    }

    this.processingQueue = true;

    try {
      const logsToProcess = [...this.logQueue];
      this.logQueue = [];

      // Batch insert to database
      await this.persistLogs(logsToProcess);

      // Send alerts for high-severity events
      await this.processAlerts(logsToProcess);

    } catch (error) {
      console.error('Log queue processing failed:', error);
      
      // Re-queue failed logs
      this.logQueue.unshift(...this.logQueue);
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Persist logs to database
   */
  async persistLogs(logs) {
    try {
      // In a real implementation, this would use your database client
      for (const log of logs) {
        // await db.audit_logs.insert(log);
        console.log('AUDIT LOG:', JSON.stringify(log, null, 2));
      }
    } catch (error) {
      console.error('Failed to persist audit logs:', error);
      throw error;
    }
  }

  /**
   * Process alerts for high-severity events
   */
  async processAlerts(logs) {
    const alertLogs = logs.filter(log => 
      ['high', 'critical'].includes(log.severity)
    );

    for (const log of alertLogs) {
      await this.sendSecurityAlert(log);
    }
  }

  /**
   * Send security alert
   */
  async sendSecurityAlert(logEntry) {
    try {
      // In production, this would integrate with alerting systems
      console.log('SECURITY ALERT:', {
        level: logEntry.severity,
        action: logEntry.action,
        user: logEntry.email,
        timestamp: logEntry.timestamp,
        details: logEntry.metadata
      });

      // Could integrate with services like:
      // - Email notifications
      // - Slack/Teams webhooks  
      // - PagerDuty
      // - SIEM systems
      
    } catch (error) {
      console.error('Failed to send security alert:', error);
    }
  }

  /**
   * Determine event severity
   */
  determineSeverity(category, action) {
    const severityMap = {
      authentication: {
        'login': 'info',
        'logout': 'info',
        'login_failed': 'warning',
        'token_verification_failed': 'warning',
        'mfa_failed': 'high',
        'account_locked': 'high',
        'password_reset': 'warning',
        'suspicious_login': 'high'
      },
      document_access: {
        'view': 'info',
        'download': 'warning',
        'upload': 'warning',
        'delete': 'high',
        'unauthorized_access': 'critical',
        'classification_violation': 'critical'
      },
      stakeholder_access: {
        'view': 'info',
        'edit': 'warning',
        'delete': 'high',
        'witness_data_access': 'high',
        'unauthorized_stakeholder_access': 'critical'
      },
      admin_action: {
        'user_created': 'warning',
        'user_deleted': 'high',
        'role_changed': 'high',
        'permission_granted': 'high',
        'system_config_changed': 'critical'
      },
      security: {
        'ip_blocked': 'warning',
        'rate_limit_exceeded': 'warning',
        'injection_attempt': 'critical',
        'data_breach_suspected': 'critical'
      },
      risk_management: {
        'risk_reported': 'warning',
        'threat_detected': 'high',
        'witness_compromise': 'critical'
      }
    };

    return severityMap[category]?.[action] || 'info';
  }

  /**
   * Anonymize IP addresses for privacy
   */
  anonymizeIP(ip) {
    if (!ip || !this.config.anonymizeIps) {
      return ip;
    }

    // For IPv4, replace last octet with 0
    if (ip.includes('.')) {
      const parts = ip.split('.');
      parts[3] = '0';
      return parts.join('.');
    }

    // For IPv6, replace last segment with 0
    if (ip.includes(':')) {
      const parts = ip.split(':');
      parts[parts.length - 1] = '0';
      return parts.join(':');
    }

    return ip;
  }

  /**
   * Sanitize log entry by removing sensitive data
   */
  sanitizeLogEntry(entry) {
    const sanitized = { ...entry };

    // Remove sensitive fields based on configuration
    if (this.config.level === 'basic') {
      delete sanitized.userAgent;
      delete sanitized.clientIP;
      delete sanitized.sessionId;
    }

    return sanitized;
  }

  /**
   * Encrypt sensitive fields
   */
  async encryptSensitiveFields(entry) {
    if (!this.config.encryption) {
      return entry;
    }

    const sensitiveFields = ['email', 'userAgent', 'metadata', 'clientIP'];
    const encrypted = { ...entry };

    for (const field of sensitiveFields) {
      if (encrypted[field]) {
        encrypted[field] = this.encrypt(JSON.stringify(encrypted[field]));
      }
    }

    return encrypted;
  }

  /**
   * Encrypt data
   */
  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);
    cipher.setAAD(Buffer.from('audit-log'));
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      data: encrypted
    };
  }

  /**
   * Calculate checksum for integrity
   */
  calculateChecksum(entry) {
    const data = JSON.stringify(entry, Object.keys(entry).sort());
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Calculate retention date based on configuration
   */
  calculateRetentionDate() {
    const retentionMs = this.config.retention;
    const retentionDate = new Date(Date.now() + retentionMs);
    return retentionDate.toISOString();
  }

  /**
   * Get compliance flags for log entry
   */
  getComplianceFlags(eventData) {
    const flags = [];

    // GDPR compliance
    if (eventData.email) {
      flags.push('gdpr');
    }

    // Financial data compliance (if applicable)
    if (eventData.category === 'document_access' && eventData.metadata?.containsFinancialData) {
      flags.push('sox', 'pci');
    }

    // Legal privilege (if applicable)
    if (eventData.category === 'document_access' && eventData.metadata?.isPrivileged) {
      flags.push('attorney_client_privilege');
    }

    // Witness protection
    if (eventData.roleType === 'witness' || eventData.resourceType === 'witness_data') {
      flags.push('witness_protection');
    }

    return flags;
  }

  /**
   * Query audit logs (admin function)
   */
  async queryLogs(filters = {}, limit = 100, offset = 0) {
    try {
      // In a real implementation, this would query the database
      const query = this.buildLogQuery(filters, limit, offset);
      
      // Mock response for now
      return {
        logs: [],
        total: 0,
        hasMore: false
      };
    } catch (error) {
      console.error('Audit log query failed:', error);
      throw error;
    }
  }

  /**
   * Build database query for logs
   */
  buildLogQuery(filters, limit, offset) {
    // This would build appropriate database query
    return {
      where: filters,
      limit: limit,
      offset: offset,
      orderBy: { timestamp: 'desc' }
    };
  }

  /**
   * Export audit logs for compliance
   */
  async exportLogs(filters = {}, format = 'json') {
    try {
      const logs = await this.queryLogs(filters, 10000, 0); // Large limit for export
      
      switch (format) {
        case 'csv':
          return this.convertToCSV(logs);
        case 'json':
          return JSON.stringify(logs, null, 2);
        case 'xml':
          return this.convertToXML(logs);
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error('Audit log export failed:', error);
      throw error;
    }
  }

  /**
   * Convert logs to CSV format
   */
  convertToCSV(logs) {
    // Implementation for CSV conversion
    return 'timestamp,category,action,userId,severity\n' + 
           logs.map(log => `${log.timestamp},${log.category},${log.action},${log.userId},${log.severity}`).join('\n');
  }

  /**
   * Convert logs to XML format
   */
  convertToXML(logs) {
    // Implementation for XML conversion
    return `<?xml version="1.0" encoding="UTF-8"?>\n<audit_logs>\n${
      logs.map(log => `  <log>${JSON.stringify(log)}</log>`).join('\n')
    }\n</audit_logs>`;
  }
}

// Create singleton instance
const auditLogger = new AuditService();

module.exports = {
  AuditService,
  auditLogger
};