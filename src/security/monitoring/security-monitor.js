/**
 * Security Monitoring and Alerting System
 * Real-time threat detection, suspicious activity monitoring, and automated response
 */

const EventEmitter = require('events');
const { auditLogger } = require('../../services/audit-service');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

class SecurityMonitor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      alertThresholds: {
        failedLogins: 5, // Failed logins per IP per hour
        rateLimitHits: 10, // Rate limit hits per IP per hour
        suspiciousActivity: 3, // Suspicious activities per user per hour
        ...config.alertThresholds
      },
      monitoring: {
        windowSize: 60 * 60 * 1000, // 1 hour monitoring window
        cleanupInterval: 24 * 60 * 60 * 1000, // 24 hours cleanup interval
        ...config.monitoring
      },
      notifications: {
        emailEnabled: process.env.NODE_ENV === 'production',
        webhookEnabled: true,
        ...config.notifications
      },
      ...config
    };

    // Tracking stores
    this.failedLogins = new Map(); // IP -> { count, firstAttempt, lastAttempt }
    this.rateLimitHits = new Map(); // IP -> { count, firstHit, lastHit }
    this.suspiciousActivities = new Map(); // userId -> { activities: [], count }
    this.blockedIPs = new Set(); // Temporarily blocked IPs
    this.alertCooldowns = new Map(); // Alert type -> lastSent timestamp

    // Email transporter
    this.emailTransporter = this.setupEmailTransporter();

    // Setup event listeners
    this.setupEventListeners();

    // Start monitoring processes
    this.startMonitoring();
  }

  /**
   * Start monitoring processes
   */
  startMonitoring() {
    // Cleanup old tracking data periodically
    setInterval(() => {
      this.cleanupOldData();
    }, this.config.monitoring.cleanupInterval);

    // Log monitoring status
    console.log('Security monitoring initialized');
    
    auditLogger.log({
      action: 'security_monitoring_started',
      config: {
        failedLoginThreshold: this.config.alertThresholds.failedLogins,
        rateLimitThreshold: this.config.alertThresholds.rateLimitHits,
        monitoringWindow: this.config.monitoring.windowSize
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Setup event listeners for security events
   */
  setupEventListeners() {
    // Listen for failed authentication
    this.on('failed_login', async (data) => {
      await this.handleFailedLogin(data);
    });

    // Listen for rate limit hits
    this.on('rate_limit_hit', async (data) => {
      await this.handleRateLimitHit(data);
    });

    // Listen for suspicious activities
    this.on('suspicious_activity', async (data) => {
      await this.handleSuspiciousActivity(data);
    });

    // Listen for successful authentications after failed attempts
    this.on('successful_login_after_failures', async (data) => {
      await this.handleSuccessfulLoginAfterFailures(data);
    });

    // Listen for privilege escalation attempts
    this.on('privilege_escalation', async (data) => {
      await this.handlePrivilegeEscalation(data);
    });

    // Listen for data access violations
    this.on('data_access_violation', async (data) => {
      await this.handleDataAccessViolation(data);
    });
  }

  /**
   * Handle failed login attempts
   */
  async handleFailedLogin(data) {
    const { clientIP, email, userAgent, timestamp } = data;
    const now = new Date(timestamp || Date.now());

    // Track failed login attempts per IP
    if (!this.failedLogins.has(clientIP)) {
      this.failedLogins.set(clientIP, {
        count: 0,
        firstAttempt: now,
        lastAttempt: now,
        attempts: []
      });
    }

    const loginData = this.failedLogins.get(clientIP);
    loginData.count++;
    loginData.lastAttempt = now;
    loginData.attempts.push({ email, userAgent, timestamp: now });

    // Check if threshold exceeded
    if (loginData.count >= this.config.alertThresholds.failedLogins) {
      const timeDiff = now - loginData.firstAttempt;
      
      if (timeDiff <= this.config.monitoring.windowSize) {
        await this.triggerAlert('failed_logins_threshold', {
          clientIP,
          count: loginData.count,
          timeWindow: timeDiff,
          attempts: loginData.attempts,
          severity: 'high'
        });

        // Temporarily block IP
        this.blockedIPs.add(clientIP);
        setTimeout(() => {
          this.blockedIPs.delete(clientIP);
        }, 30 * 60 * 1000); // Block for 30 minutes

        await auditLogger.log({
          action: 'ip_temporarily_blocked',
          clientIP,
          reason: 'excessive_failed_logins',
          count: loginData.count,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Handle rate limit hits
   */
  async handleRateLimitHit(data) {
    const { clientIP, endpoint, userAgent, timestamp } = data;
    const now = new Date(timestamp || Date.now());

    if (!this.rateLimitHits.has(clientIP)) {
      this.rateLimitHits.set(clientIP, {
        count: 0,
        firstHit: now,
        lastHit: now,
        endpoints: []
      });
    }

    const hitData = this.rateLimitHits.get(clientIP);
    hitData.count++;
    hitData.lastHit = now;
    hitData.endpoints.push({ endpoint, timestamp: now });

    if (hitData.count >= this.config.alertThresholds.rateLimitHits) {
      const timeDiff = now - hitData.firstHit;
      
      if (timeDiff <= this.config.monitoring.windowSize) {
        await this.triggerAlert('rate_limit_threshold', {
          clientIP,
          count: hitData.count,
          timeWindow: timeDiff,
          endpoints: hitData.endpoints,
          severity: 'medium'
        });
      }
    }
  }

  /**
   * Handle suspicious activities
   */
  async handleSuspiciousActivity(data) {
    const { userId, activityType, details, clientIP, timestamp } = data;
    const now = new Date(timestamp || Date.now());

    if (!this.suspiciousActivities.has(userId)) {
      this.suspiciousActivities.set(userId, {
        count: 0,
        firstActivity: now,
        lastActivity: now,
        activities: []
      });
    }

    const activityData = this.suspiciousActivities.get(userId);
    activityData.count++;
    activityData.lastActivity = now;
    activityData.activities.push({
      type: activityType,
      details,
      clientIP,
      timestamp: now
    });

    if (activityData.count >= this.config.alertThresholds.suspiciousActivity) {
      const timeDiff = now - activityData.firstActivity;
      
      if (timeDiff <= this.config.monitoring.windowSize) {
        await this.triggerAlert('suspicious_activity_threshold', {
          userId,
          count: activityData.count,
          timeWindow: timeDiff,
          activities: activityData.activities,
          severity: 'high'
        });
      }
    }
  }

  /**
   * Handle successful login after failed attempts
   */
  async handleSuccessfulLoginAfterFailures(data) {
    const { clientIP, userId, email, failedAttempts, timestamp } = data;

    if (failedAttempts >= 3) {
      await this.triggerAlert('successful_login_after_failures', {
        clientIP,
        userId,
        email,
        failedAttempts,
        severity: 'medium'
      });
    }

    // Clear failed login tracking for this IP
    this.failedLogins.delete(clientIP);
  }

  /**
   * Handle privilege escalation attempts
   */
  async handlePrivilegeEscalation(data) {
    const { userId, attemptedRole, currentRole, endpoint, clientIP } = data;

    await this.triggerAlert('privilege_escalation_attempt', {
      userId,
      attemptedRole,
      currentRole,
      endpoint,
      clientIP,
      severity: 'critical'
    });
  }

  /**
   * Handle data access violations
   */
  async handleDataAccessViolation(data) {
    const { userId, resourceType, resourceId, deniedAction, clientIP } = data;

    await this.triggerAlert('data_access_violation', {
      userId,
      resourceType,
      resourceId,
      deniedAction,
      clientIP,
      severity: 'high'
    });
  }

  /**
   * Trigger security alert
   */
  async triggerAlert(alertType, alertData) {
    const alertId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Check cooldown to prevent alert spam
    const lastAlertTime = this.alertCooldowns.get(alertType);
    const cooldownPeriod = 15 * 60 * 1000; // 15 minutes

    if (lastAlertTime && (Date.now() - lastAlertTime) < cooldownPeriod) {
      console.log(`Alert ${alertType} in cooldown period, skipping`);
      return;
    }

    this.alertCooldowns.set(alertType, Date.now());

    const alert = {
      id: alertId,
      type: alertType,
      severity: alertData.severity || 'medium',
      timestamp,
      data: alertData,
      resolved: false
    };

    // Log alert
    await auditLogger.log({
      action: 'security_alert_triggered',
      alertId,
      alertType,
      severity: alert.severity,
      alertData,
      timestamp
    });

    // Send notifications
    await this.sendAlertNotifications(alert);

    // Emit alert event for other systems
    this.emit('alert', alert);

    console.log(`Security alert triggered: ${alertType} (${alert.severity})`);
  }

  /**
   * Send alert notifications
   */
  async sendAlertNotifications(alert) {
    const notifications = [];

    // Email notification
    if (this.config.notifications.emailEnabled) {
      notifications.push(this.sendEmailAlert(alert));
    }

    // Webhook notification
    if (this.config.notifications.webhookEnabled) {
      notifications.push(this.sendWebhookAlert(alert));
    }

    // Slack notification (if configured)
    if (this.config.notifications.slackWebhook) {
      notifications.push(this.sendSlackAlert(alert));
    }

    try {
      await Promise.allSettled(notifications);
    } catch (error) {
      console.error('Failed to send some alert notifications:', error);
    }
  }

  /**
   * Send email alert
   */
  async sendEmailAlert(alert) {
    if (!this.emailTransporter) {
      return;
    }

    const emailConfig = this.config.email || {};
    const recipients = emailConfig.securityTeam || ['security@company.com'];

    const subject = `Security Alert: ${alert.type} (${alert.severity.toUpperCase()})`;
    const text = this.formatAlertEmail(alert);

    try {
      await this.emailTransporter.sendMail({
        from: emailConfig.from || 'security@esopfable.com',
        to: recipients,
        subject,
        text,
        html: this.formatAlertEmailHTML(alert)
      });

      console.log(`Email alert sent for ${alert.type}`);
    } catch (error) {
      console.error('Failed to send email alert:', error);
    }
  }

  /**
   * Send webhook alert
   */
  async sendWebhookAlert(alert) {
    const webhookUrl = this.config.notifications.webhookUrl;
    
    if (!webhookUrl) {
      return;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Alert-Signature': this.generateAlertSignature(alert)
        },
        body: JSON.stringify(alert)
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}`);
      }

      console.log(`Webhook alert sent for ${alert.type}`);
    } catch (error) {
      console.error('Failed to send webhook alert:', error);
    }
  }

  /**
   * Send Slack alert
   */
  async sendSlackAlert(alert) {
    const slackWebhook = this.config.notifications.slackWebhook;
    
    if (!slackWebhook) {
      return;
    }

    const color = {
      'low': 'good',
      'medium': 'warning',
      'high': 'danger',
      'critical': 'danger'
    }[alert.severity] || 'warning';

    const payload = {
      text: `Security Alert: ${alert.type}`,
      attachments: [{
        color,
        fields: [
          {
            title: 'Severity',
            value: alert.severity.toUpperCase(),
            short: true
          },
          {
            title: 'Time',
            value: alert.timestamp,
            short: true
          },
          {
            title: 'Details',
            value: JSON.stringify(alert.data, null, 2),
            short: false
          }
        ]
      }]
    };

    try {
      const response = await fetch(slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Slack webhook returned ${response.status}`);
      }

      console.log(`Slack alert sent for ${alert.type}`);
    } catch (error) {
      console.error('Failed to send Slack alert:', error);
    }
  }

  /**
   * Check if IP is blocked
   */
  isIPBlocked(clientIP) {
    return this.blockedIPs.has(clientIP);
  }

  /**
   * Manually block IP
   */
  async blockIP(clientIP, reason, duration = 60 * 60 * 1000) { // 1 hour default
    this.blockedIPs.add(clientIP);
    
    setTimeout(() => {
      this.blockedIPs.delete(clientIP);
    }, duration);

    await auditLogger.log({
      action: 'ip_manually_blocked',
      clientIP,
      reason,
      duration,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Unblock IP
   */
  async unblockIP(clientIP, reason) {
    this.blockedIPs.delete(clientIP);

    await auditLogger.log({
      action: 'ip_unblocked',
      clientIP,
      reason,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get security statistics
   */
  getSecurityStats() {
    const now = Date.now();
    const windowStart = now - this.config.monitoring.windowSize;

    return {
      failedLogins: {
        total: Array.from(this.failedLogins.values()).reduce((sum, data) => sum + data.count, 0),
        uniqueIPs: this.failedLogins.size,
        recentCount: Array.from(this.failedLogins.values())
          .filter(data => data.lastAttempt.getTime() > windowStart).length
      },
      rateLimitHits: {
        total: Array.from(this.rateLimitHits.values()).reduce((sum, data) => sum + data.count, 0),
        uniqueIPs: this.rateLimitHits.size,
        recentCount: Array.from(this.rateLimitHits.values())
          .filter(data => data.lastHit.getTime() > windowStart).length
      },
      suspiciousActivities: {
        total: Array.from(this.suspiciousActivities.values()).reduce((sum, data) => sum + data.count, 0),
        uniqueUsers: this.suspiciousActivities.size,
        recentCount: Array.from(this.suspiciousActivities.values())
          .filter(data => data.lastActivity.getTime() > windowStart).length
      },
      blockedIPs: Array.from(this.blockedIPs),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Setup email transporter
   */
  setupEmailTransporter() {
    const emailConfig = this.config.email;
    
    if (!emailConfig || !emailConfig.host) {
      return null;
    }

    return nodemailer.createTransporter({
      host: emailConfig.host,
      port: emailConfig.port || 587,
      secure: emailConfig.secure || false,
      auth: {
        user: emailConfig.user,
        pass: emailConfig.password
      }
    });
  }

  /**
   * Format alert email
   */
  formatAlertEmail(alert) {
    return `
Security Alert Triggered

Alert ID: ${alert.id}
Type: ${alert.type}
Severity: ${alert.severity.toUpperCase()}
Time: ${alert.timestamp}

Details:
${JSON.stringify(alert.data, null, 2)}

This alert was automatically generated by the ESOP Fable security monitoring system.
`;
  }

  /**
   * Format alert email HTML
   */
  formatAlertEmailHTML(alert) {
    return `
<html>
<head><title>Security Alert</title></head>
<body>
<h1>Security Alert Triggered</h1>
<p><strong>Alert ID:</strong> ${alert.id}</p>
<p><strong>Type:</strong> ${alert.type}</p>
<p><strong>Severity:</strong> <span style="color: ${alert.severity === 'critical' ? 'red' : alert.severity === 'high' ? 'orange' : 'black'}">${alert.severity.toUpperCase()}</span></p>
<p><strong>Time:</strong> ${alert.timestamp}</p>
<h2>Details:</h2>
<pre>${JSON.stringify(alert.data, null, 2)}</pre>
<p><em>This alert was automatically generated by the ESOP Fable security monitoring system.</em></p>
</body>
</html>
`;
  }

  /**
   * Generate alert signature for webhook verification
   */
  generateAlertSignature(alert) {
    const secret = process.env.WEBHOOK_SECRET || 'default-secret';
    return crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(alert))
      .digest('hex');
  }

  /**
   * Clean up old tracking data
   */
  cleanupOldData() {
    const cutoffTime = Date.now() - this.config.monitoring.windowSize;

    // Cleanup failed logins
    for (const [ip, data] of this.failedLogins.entries()) {
      if (data.lastAttempt.getTime() < cutoffTime) {
        this.failedLogins.delete(ip);
      }
    }

    // Cleanup rate limit hits
    for (const [ip, data] of this.rateLimitHits.entries()) {
      if (data.lastHit.getTime() < cutoffTime) {
        this.rateLimitHits.delete(ip);
      }
    }

    // Cleanup suspicious activities
    for (const [userId, data] of this.suspiciousActivities.entries()) {
      if (data.lastActivity.getTime() < cutoffTime) {
        this.suspiciousActivities.delete(userId);
      }
    }

    console.log('Security monitoring data cleanup completed');
  }
}

// Create singleton instance
const securityMonitor = new SecurityMonitor();

module.exports = {
  SecurityMonitor,
  securityMonitor
};