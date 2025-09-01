/**
 * Network Access Control List (ACL)
 * Enhanced security for witness protection and sensitive data access
 */

const ipRangeCheck = require('ip-range-check');
const geoip = require('geoip-lite');
const { auditLogger } = require('../services/audit-service');

class NetworkAcl {
  constructor(networkConfig = {}) {
    this.config = networkConfig;
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Check if IP address has access based on role and ACL type
   */
  async checkAccess(clientIP, userRole, aclType = 'default') {
    try {
      // Create cache key
      const cacheKey = `${clientIP}-${userRole}-${aclType}`;
      
      // Check cache first
      const cached = this.cache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
        return cached.allowed;
      }

      let allowed = false;

      // Apply role-specific and ACL-specific rules
      switch (aclType) {
        case 'witness':
          allowed = await this.checkWitnessAccess(clientIP, userRole);
          break;
        case 'confidential':
          allowed = await this.checkConfidentialAccess(clientIP, userRole);
          break;
        case 'secret':
          allowed = await this.checkSecretAccess(clientIP, userRole);
          break;
        default:
          allowed = await this.checkDefaultAccess(clientIP, userRole);
      }

      // Cache result
      this.cache.set(cacheKey, {
        allowed: allowed,
        timestamp: Date.now()
      });

      // Log access check
      await auditLogger.log({
        action: 'network_acl_check',
        clientIP: clientIP,
        userRole: userRole,
        aclType: aclType,
        allowed: allowed,
        geoLocation: this.getGeoLocation(clientIP),
        timestamp: new Date().toISOString()
      });

      return allowed;
    } catch (error) {
      console.error('Network ACL check failed:', error);
      
      // Log error
      await auditLogger.log({
        action: 'network_acl_error',
        clientIP: clientIP,
        userRole: userRole,
        aclType: aclType,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      // Fail secure - deny access on error
      return false;
    }
  }

  /**
   * Check witness data access - highest security level
   */
  async checkWitnessAccess(clientIP, userRole) {
    const witnessConfig = this.config.witness || {};
    
    // Only legal team and government entities can access witness data
    if (!['legal_team', 'government_entity'].includes(userRole)) {
      return false;
    }

    // Check IP whitelist first (most restrictive)
    if (witnessConfig.ipWhitelist && witnessConfig.ipWhitelist.length > 0) {
      if (!witnessConfig.ipWhitelist.includes(clientIP)) {
        return false;
      }
    }

    // Check allowed networks
    if (witnessConfig.allowedNetworks && witnessConfig.allowedNetworks.length > 0) {
      const isInAllowedNetwork = witnessConfig.allowedNetworks.some(network => 
        ipRangeCheck(clientIP, network)
      );
      if (!isInAllowedNetwork) {
        return false;
      }
    }

    // Check denied networks
    if (witnessConfig.deniedNetworks && witnessConfig.deniedNetworks.length > 0) {
      const isInDeniedNetwork = witnessConfig.deniedNetworks.some(network => 
        ipRangeCheck(clientIP, network)
      );
      if (isInDeniedNetwork) {
        return false;
      }
    }

    // Check geographic restrictions
    const geoLocation = this.getGeoLocation(clientIP);
    if (geoLocation) {
      // Block access from certain countries known for cyber threats
      const blockedCountries = ['CN', 'RU', 'KP', 'IR'];
      if (blockedCountries.includes(geoLocation.country)) {
        return false;
      }
    }

    // Check for VPN/proxy if required
    if (witnessConfig.requireVpn) {
      const isVpn = await this.detectVpn(clientIP);
      if (!isVpn && !this.isPrivateNetwork(clientIP)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check confidential data access
   */
  async checkConfidentialAccess(clientIP, userRole) {
    const confidentialConfig = this.config.confidential || {};
    
    // Check role permissions
    if (!['legal_team', 'government_entity', 'esop_participant'].includes(userRole)) {
      return false;
    }

    // Check allowed networks
    if (confidentialConfig.allowedNetworks && confidentialConfig.allowedNetworks.length > 0) {
      const isInAllowedNetwork = confidentialConfig.allowedNetworks.some(network => 
        ipRangeCheck(clientIP, network)
      );
      if (!isInAllowedNetwork) {
        return false;
      }
    }

    // Check denied networks
    if (confidentialConfig.deniedNetworks && confidentialConfig.deniedNetworks.length > 0) {
      const isInDeniedNetwork = confidentialConfig.deniedNetworks.some(network => 
        ipRangeCheck(clientIP, network)
      );
      if (isInDeniedNetwork) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check secret data access - second highest security level
   */
  async checkSecretAccess(clientIP, userRole) {
    // Only legal team can access secret documents
    if (userRole !== 'legal_team') {
      return false;
    }

    // Use witness-level restrictions for secret data
    return this.checkWitnessAccess(clientIP, userRole);
  }

  /**
   * Default access check for public/internal data
   */
  async checkDefaultAccess(clientIP, userRole) {
    // Basic security checks for all users
    
    // Block known malicious IP ranges
    const maliciousNetworks = [
      '0.0.0.0/8',      // "This" network
      '10.0.0.0/8',     // Private networks (if not explicitly allowed)
      '127.0.0.0/8',    // Loopback (except for development)
      '169.254.0.0/16', // Link-local
      '172.16.0.0/12',  // Private networks
      '192.168.0.0/16'  // Private networks
    ];

    // Allow private networks in development
    if (process.env.NODE_ENV === 'development') {
      return true;
    }

    // Check against malicious networks
    const isInMaliciousNetwork = maliciousNetworks.some(network => 
      ipRangeCheck(clientIP, network)
    );

    if (isInMaliciousNetwork) {
      // Only allow if explicitly in allowed networks
      const allowedNetworks = this.config.default?.allowedNetworks || [];
      const isExplicitlyAllowed = allowedNetworks.some(network => 
        ipRangeCheck(clientIP, network)
      );
      return isExplicitlyAllowed;
    }

    // Check geographic restrictions
    const geoLocation = this.getGeoLocation(clientIP);
    if (geoLocation) {
      // Block access from embargoed countries
      const blockedCountries = ['KP', 'IR', 'SY', 'CU'];
      if (blockedCountries.includes(geoLocation.country)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get geographic location of IP address
   */
  getGeoLocation(clientIP) {
    try {
      return geoip.lookup(clientIP);
    } catch (error) {
      console.error('GeoIP lookup failed:', error);
      return null;
    }
  }

  /**
   * Detect if IP is from a VPN or proxy service
   */
  async detectVpn(clientIP) {
    try {
      // Simple heuristics for VPN detection
      // In production, you might use a service like IPQualityScore or similar
      
      // Check if it's a known VPN provider IP range
      const knownVpnRanges = [
        // Add known VPN provider IP ranges here
        // This is a simplified example
      ];

      const isKnownVpn = knownVpnRanges.some(range => 
        ipRangeCheck(clientIP, range)
      );

      return isKnownVpn;
    } catch (error) {
      console.error('VPN detection failed:', error);
      return false;
    }
  }

  /**
   * Check if IP is in a private network
   */
  isPrivateNetwork(clientIP) {
    const privateNetworks = [
      '10.0.0.0/8',
      '172.16.0.0/12',
      '192.168.0.0/16',
      '127.0.0.0/8'
    ];

    return privateNetworks.some(network => 
      ipRangeCheck(clientIP, network)
    );
  }

  /**
   * Add IP to whitelist (admin function)
   */
  async addToWhitelist(clientIP, userRole, aclType, adminUser) {
    try {
      // This would typically update a database
      // For now, we'll log the action
      
      await auditLogger.log({
        action: 'ip_whitelist_add',
        clientIP: clientIP,
        targetRole: userRole,
        aclType: aclType,
        adminUser: adminUser.email,
        adminUserId: adminUser.sub,
        timestamp: new Date().toISOString()
      });

      // Clear cache for this IP
      const cacheKeys = Array.from(this.cache.keys()).filter(key => 
        key.startsWith(clientIP)
      );
      cacheKeys.forEach(key => this.cache.delete(key));

      return true;
    } catch (error) {
      console.error('Failed to add IP to whitelist:', error);
      return false;
    }
  }

  /**
   * Remove IP from whitelist (admin function)
   */
  async removeFromWhitelist(clientIP, userRole, aclType, adminUser) {
    try {
      await auditLogger.log({
        action: 'ip_whitelist_remove',
        clientIP: clientIP,
        targetRole: userRole,
        aclType: aclType,
        adminUser: adminUser.email,
        adminUserId: adminUser.sub,
        timestamp: new Date().toISOString()
      });

      // Clear cache for this IP
      const cacheKeys = Array.from(this.cache.keys()).filter(key => 
        key.startsWith(clientIP)
      );
      cacheKeys.forEach(key => this.cache.delete(key));

      return true;
    } catch (error) {
      console.error('Failed to remove IP from whitelist:', error);
      return false;
    }
  }

  /**
   * Get network access statistics
   */
  getAccessStats() {
    // Return cached access statistics
    const stats = {
      totalChecks: 0,
      allowedAccess: 0,
      deniedAccess: 0,
      cacheSize: this.cache.size,
      topCountries: {},
      topDeniedIps: {}
    };

    // This would typically be retrieved from a database
    return stats;
  }

  /**
   * Clear cache (admin function)
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = {
  NetworkAcl
};