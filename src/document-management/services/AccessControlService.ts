import { ClassificationLevel, Permission, Document, User, DocumentPermission } from '../types';

export interface AccessPolicy {
  classification: ClassificationLevel;
  requiredClearance: ClassificationLevel;
  allowedRoles: string[];
  permissions: Permission[];
  restrictions: {
    requiresApproval?: boolean;
    timeRestricted?: {
      start: string; // HH:mm format
      end: string;   // HH:mm format
    };
    locationRestricted?: {
      allowedIPs: string[];
      allowedCountries: string[];
    };
    downloadLimit?: number;
    viewTimeLimit?: number; // minutes
  };
}

export interface AccessContext {
  user: User;
  ipAddress: string;
  userAgent: string;
  location?: {
    country: string;
    region: string;
    city: string;
  };
  timestamp: Date;
}

export interface AccessDecision {
  allowed: boolean;
  permissions: Permission[];
  restrictions: any;
  reason?: string;
  requiresApproval?: boolean;
  approvalRequired?: {
    level: 'SUPERVISOR' | 'MANAGER' | 'ADMINISTRATOR';
    reason: string;
  };
}

export class AccessControlService {
  private policies: Map<ClassificationLevel, AccessPolicy>;
  private roleHierarchy: Map<string, string[]>;

  constructor() {
    this.policies = new Map();
    this.roleHierarchy = new Map();
    this.initializeDefaultPolicies();
    this.initializeRoleHierarchy();
  }

  private initializeDefaultPolicies(): void {
    // Public documents - accessible to everyone
    this.policies.set(ClassificationLevel.PUBLIC, {
      classification: ClassificationLevel.PUBLIC,
      requiredClearance: ClassificationLevel.PUBLIC,
      allowedRoles: ['*'], // Everyone
      permissions: [Permission.READ, Permission.DOWNLOAD],
      restrictions: {}
    });

    // Internal documents - for employees only
    this.policies.set(ClassificationLevel.INTERNAL, {
      classification: ClassificationLevel.INTERNAL,
      requiredClearance: ClassificationLevel.INTERNAL,
      allowedRoles: ['employee', 'contractor', 'manager', 'admin'],
      permissions: [Permission.READ, Permission.DOWNLOAD, Permission.COMMENT],
      restrictions: {
        locationRestricted: {
          allowedIPs: [], // Configured based on office networks
          allowedCountries: ['US', 'CA', 'UK'] // Example countries
        }
      }
    });

    // Confidential documents - restricted access
    this.policies.set(ClassificationLevel.CONFIDENTIAL, {
      classification: ClassificationLevel.CONFIDENTIAL,
      requiredClearance: ClassificationLevel.CONFIDENTIAL,
      allowedRoles: ['manager', 'senior-employee', 'admin'],
      permissions: [Permission.READ, Permission.DOWNLOAD, Permission.COMMENT],
      restrictions: {
        requiresApproval: true,
        timeRestricted: {
          start: '08:00',
          end: '18:00'
        },
        locationRestricted: {
          allowedIPs: [], // Secure office networks only
          allowedCountries: ['US']
        },
        downloadLimit: 5, // Max 5 downloads per day
        viewTimeLimit: 120 // 2 hours max view time
      }
    });

    // Secret documents - highest security
    this.policies.set(ClassificationLevel.SECRET, {
      classification: ClassificationLevel.SECRET,
      requiredClearance: ClassificationLevel.SECRET,
      allowedRoles: ['admin', 'security-officer', 'executive'],
      permissions: [Permission.READ], // No download by default
      restrictions: {
        requiresApproval: true,
        timeRestricted: {
          start: '09:00',
          end: '17:00'
        },
        locationRestricted: {
          allowedIPs: [], // Specific secure workstations only
          allowedCountries: ['US']
        },
        downloadLimit: 0, // No downloads allowed
        viewTimeLimit: 60 // 1 hour max view time
      }
    });
  }

  private initializeRoleHierarchy(): void {
    // Define role inheritance - higher roles inherit lower role permissions
    this.roleHierarchy.set('admin', ['manager', 'senior-employee', 'employee', 'contractor']);
    this.roleHierarchy.set('executive', ['admin', 'manager', 'senior-employee', 'employee']);
    this.roleHierarchy.set('security-officer', ['admin', 'manager', 'senior-employee', 'employee']);
    this.roleHierarchy.set('manager', ['senior-employee', 'employee']);
    this.roleHierarchy.set('senior-employee', ['employee']);
    this.roleHierarchy.set('employee', []);
    this.roleHierarchy.set('contractor', []);
  }

  /**
   * Check if user has access to a document
   */
  checkAccess(document: Document, context: AccessContext): AccessDecision {
    const policy = this.policies.get(document.classification);
    
    if (!policy) {
      return {
        allowed: false,
        permissions: [],
        restrictions: {},
        reason: 'No policy defined for classification level'
      };
    }

    // Check clearance level
    if (!this.hasClearanceLevel(context.user, policy.requiredClearance)) {
      return {
        allowed: false,
        permissions: [],
        restrictions: {},
        reason: 'Insufficient clearance level'
      };
    }

    // Check role permissions
    if (!this.hasRequiredRole(context.user, policy.allowedRoles)) {
      return {
        allowed: false,
        permissions: [],
        restrictions: {},
        reason: 'Role not authorized for this classification'
      };
    }

    // Check document-specific permissions
    const documentPermissions = this.getDocumentPermissions(document, context.user);
    
    // Check time restrictions
    if (policy.restrictions.timeRestricted) {
      if (!this.isWithinAllowedTime(context.timestamp, policy.restrictions.timeRestricted)) {
        return {
          allowed: false,
          permissions: [],
          restrictions: {},
          reason: 'Access not allowed at this time'
        };
      }
    }

    // Check location restrictions
    if (policy.restrictions.locationRestricted) {
      if (!this.isFromAllowedLocation(context, policy.restrictions.locationRestricted)) {
        return {
          allowed: false,
          permissions: [],
          restrictions: {},
          reason: 'Access not allowed from this location'
        };
      }
    }

    // Combine policy permissions with document-specific permissions
    const effectivePermissions = this.combinePermissions(
      policy.permissions,
      documentPermissions
    );

    // Check if approval is required
    const requiresApproval = policy.restrictions.requiresApproval || 
      this.documentRequiresApproval(document, context.user);

    return {
      allowed: true,
      permissions: effectivePermissions,
      restrictions: policy.restrictions,
      requiresApproval,
      approvalRequired: requiresApproval ? {
        level: this.getRequiredApprovalLevel(document.classification),
        reason: `Access to ${document.classification} document requires approval`
      } : undefined
    };
  }

  /**
   * Check specific permission for user on document
   */
  checkPermission(
    document: Document, 
    user: User, 
    permission: Permission, 
    context: AccessContext
  ): boolean {
    const accessDecision = this.checkAccess(document, context);
    
    if (!accessDecision.allowed) {
      return false;
    }

    return accessDecision.permissions.includes(permission);
  }

  /**
   * Get all permissions for user on document
   */
  getUserPermissions(document: Document, user: User, context: AccessContext): Permission[] {
    const accessDecision = this.checkAccess(document, context);
    return accessDecision.allowed ? accessDecision.permissions : [];
  }

  private hasClearanceLevel(user: User, requiredLevel: ClassificationLevel): boolean {
    const levels = [
      ClassificationLevel.PUBLIC,
      ClassificationLevel.INTERNAL,
      ClassificationLevel.CONFIDENTIAL,
      ClassificationLevel.SECRET
    ];

    const userLevelIndex = levels.indexOf(user.clearanceLevel);
    const requiredLevelIndex = levels.indexOf(requiredLevel);

    return userLevelIndex >= requiredLevelIndex;
  }

  private hasRequiredRole(user: User, allowedRoles: string[]): boolean {
    // Check if everyone is allowed
    if (allowedRoles.includes('*')) {
      return true;
    }

    // Check user's direct roles
    for (const userRole of user.roles) {
      if (allowedRoles.includes(userRole)) {
        return true;
      }

      // Check inherited roles
      const inheritedRoles = this.roleHierarchy.get(userRole) || [];
      for (const inheritedRole of inheritedRoles) {
        if (allowedRoles.includes(inheritedRole)) {
          return true;
        }
      }
    }

    return false;
  }

  private getDocumentPermissions(document: Document, user: User): Permission[] {
    const userPermissions = document.permissions.find(p => 
      p.userId === user.id && 
      p.isActive && 
      (!p.expiresAt || p.expiresAt > new Date())
    );

    if (userPermissions) {
      return userPermissions.permissions;
    }

    // Check role-based permissions
    for (const userRole of user.roles) {
      const rolePermissions = document.permissions.find(p =>
        p.roleId === userRole &&
        p.isActive &&
        (!p.expiresAt || p.expiresAt > new Date())
      );

      if (rolePermissions) {
        return rolePermissions.permissions;
      }
    }

    return [];
  }

  private isWithinAllowedTime(
    timestamp: Date, 
    timeRestriction: { start: string; end: string }
  ): boolean {
    const time = timestamp.toTimeString().substring(0, 5); // HH:mm format
    return time >= timeRestriction.start && time <= timeRestriction.end;
  }

  private isFromAllowedLocation(
    context: AccessContext,
    locationRestriction: { allowedIPs: string[]; allowedCountries: string[] }
  ): boolean {
    // Check IP restrictions
    if (locationRestriction.allowedIPs.length > 0) {
      if (!locationRestriction.allowedIPs.includes(context.ipAddress)) {
        // Check if IP is in allowed ranges (CIDR notation)
        const isInRange = locationRestriction.allowedIPs.some(range => {
          if (range.includes('/')) {
            return this.isIPInCIDR(context.ipAddress, range);
          }
          return false;
        });

        if (!isInRange) {
          return false;
        }
      }
    }

    // Check country restrictions
    if (locationRestriction.allowedCountries.length > 0 && context.location) {
      if (!locationRestriction.allowedCountries.includes(context.location.country)) {
        return false;
      }
    }

    return true;
  }

  private isIPInCIDR(ip: string, cidr: string): boolean {
    // Simple CIDR check - in production, use a proper IP library
    const [range, bits] = cidr.split('/');
    const mask = ~(2 ** (32 - parseInt(bits)) - 1);
    
    const ipInt = this.ipToInt(ip);
    const rangeInt = this.ipToInt(range);
    
    return (ipInt & mask) === (rangeInt & mask);
  }

  private ipToInt(ip: string): number {
    return ip.split('.').reduce((int, octet) => (int << 8) + parseInt(octet), 0);
  }

  private combinePermissions(
    policyPermissions: Permission[], 
    documentPermissions: Permission[]
  ): Permission[] {
    // Document permissions override policy permissions (more restrictive wins)
    if (documentPermissions.length > 0) {
      return documentPermissions;
    }
    return policyPermissions;
  }

  private documentRequiresApproval(document: Document, user: User): boolean {
    // Check if document author requires approval
    if (document.author === user.id) {
      return false; // Authors don't need approval for their own documents
    }

    // Check if user has previously accessed this document
    const hasRecentAccess = document.activities.some(activity =>
      activity.userId === user.id &&
      activity.timestamp > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Within last 7 days
    );

    return !hasRecentAccess;
  }

  private getRequiredApprovalLevel(classification: ClassificationLevel): 'SUPERVISOR' | 'MANAGER' | 'ADMINISTRATOR' {
    switch (classification) {
      case ClassificationLevel.SECRET:
        return 'ADMINISTRATOR';
      case ClassificationLevel.CONFIDENTIAL:
        return 'MANAGER';
      default:
        return 'SUPERVISOR';
    }
  }

  /**
   * Grant permission to user for document
   */
  async grantPermission(
    documentId: string,
    userId: string,
    permissions: Permission[],
    grantedBy: string,
    expiresAt?: Date
  ): Promise<DocumentPermission> {
    const permission: DocumentPermission = {
      id: require('crypto').randomUUID(),
      documentId,
      userId,
      permissions,
      grantedBy,
      grantedAt: new Date(),
      expiresAt,
      isActive: true
    };

    // In a real implementation, this would save to database
    console.log('Permission granted:', permission);

    return permission;
  }

  /**
   * Revoke permission from user for document
   */
  async revokePermission(documentId: string, userId: string): Promise<void> {
    // In a real implementation, this would update database
    console.log(`Permission revoked for user ${userId} on document ${documentId}`);
  }

  /**
   * Check if user can delegate permissions
   */
  canDelegate(user: User, permission: Permission): boolean {
    // Only certain roles can delegate permissions
    const delegationRoles = ['admin', 'manager', 'security-officer'];
    
    return user.roles.some(role => delegationRoles.includes(role));
  }

  /**
   * Audit access attempt
   */
  async auditAccess(
    document: Document,
    context: AccessContext,
    action: string,
    success: boolean,
    reason?: string
  ): Promise<void> {
    const auditEntry = {
      timestamp: new Date(),
      documentId: document.id,
      userId: context.user.id,
      action,
      success,
      reason,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      classification: document.classification,
      location: context.location
    };

    // In production, this would save to audit log database
    console.log('Access audited:', auditEntry);

    // Alert on suspicious activities
    if (!success || this.isSuspiciousActivity(auditEntry)) {
      await this.alertSecurity(auditEntry);
    }
  }

  private isSuspiciousActivity(auditEntry: any): boolean {
    // Define patterns that indicate suspicious activity
    return (
      auditEntry.action === 'DOWNLOAD' && 
      auditEntry.classification === 'SECRET'
    ) || (
      // Multiple failed access attempts
      auditEntry.success === false &&
      auditEntry.reason?.includes('clearance')
    );
  }

  private async alertSecurity(auditEntry: any): Promise<void> {
    console.warn('SECURITY ALERT:', auditEntry);
    // In production, send alerts to security team
  }

  /**
   * Get user's effective clearance level considering temporary elevations
   */
  getEffectiveClearanceLevel(user: User): ClassificationLevel {
    // Check for temporary clearance elevations
    // This would typically check against a separate table/cache
    
    return user.clearanceLevel;
  }

  /**
   * Set classification policy for a classification level
   */
  setPolicy(classification: ClassificationLevel, policy: AccessPolicy): void {
    this.policies.set(classification, policy);
  }

  /**
   * Get policy for classification level
   */
  getPolicy(classification: ClassificationLevel): AccessPolicy | undefined {
    return this.policies.get(classification);
  }

  /**
   * Validate that user can assign given classification to document
   */
  canAssignClassification(user: User, classification: ClassificationLevel): boolean {
    // Users can only assign classifications up to their clearance level
    return this.hasClearanceLevel(user, classification);
  }

  /**
   * Get maximum allowed classification for user
   */
  getMaxAllowedClassification(user: User): ClassificationLevel {
    return user.clearanceLevel;
  }
}