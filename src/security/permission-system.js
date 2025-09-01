/**
 * Permission System
 * Granular permission management for resources and actions
 */

const { ROLES, CLASSIFICATION_LEVELS, auth0Config } = require('../../config/auth/auth0-config');
const { auditLogger } = require('../services/audit-service');

class PermissionSystem {
  constructor() {
    this.permissions = auth0Config.rolePermissions;
  }

  /**
   * Check if user has permission to perform action on resource
   */
  async hasPermission(user, resourceType, action, resourceData = null) {
    try {
      const userRole = user.roleType;
      const rolePermissions = this.permissions[userRole];

      if (!rolePermissions) {
        return false;
      }

      // Handle document classification permissions
      if (resourceType === 'documents') {
        return this.checkDocumentPermission(user, action, resourceData);
      }

      // Handle stakeholder permissions
      if (resourceType === 'stakeholders') {
        return this.checkStakeholderPermission(user, action, resourceData);
      }

      // Handle communication permissions
      if (resourceType === 'communications') {
        return this.checkCommunicationPermission(user, action, resourceData);
      }

      // Handle task permissions
      if (resourceType === 'tasks') {
        return this.checkTaskPermission(user, action, resourceData);
      }

      // Handle risk permissions
      if (resourceType === 'risks') {
        return this.checkRiskPermission(user, action, resourceData);
      }

      // Handle audit permissions
      if (resourceType === 'audit') {
        return this.checkAuditPermission(user, action, resourceData);
      }

      // Handle admin permissions
      if (resourceType === 'admin') {
        return this.checkAdminPermission(user, action, resourceData);
      }

      // Generic permission check
      const resourcePermissions = rolePermissions[resourceType];
      if (!resourcePermissions) {
        return false;
      }

      return Array.isArray(resourcePermissions) 
        ? resourcePermissions.includes(action)
        : resourcePermissions === action;

    } catch (error) {
      console.error('Permission check error:', error);
      return false;
    }
  }

  /**
   * Check document access permissions with classification levels
   */
  checkDocumentPermission(user, action, documentData) {
    const userRole = user.roleType;
    const rolePermissions = this.permissions[userRole];
    
    if (!rolePermissions.documents) {
      return false;
    }

    // For classification-based access
    if (documentData?.classification) {
      const allowedClassifications = rolePermissions.documents;
      const hasClassificationAccess = allowedClassifications.includes(documentData.classification);
      
      if (!hasClassificationAccess) {
        return false;
      }
    }

    // Check action-specific permissions
    switch (action) {
      case 'read':
      case 'view':
        return true; // If classification access granted, can read
      
      case 'download':
        // Media contacts and opposition cannot download documents
        return ![ROLES.MEDIA_CONTACT, ROLES.OPPOSITION].includes(userRole);
      
      case 'write':
      case 'edit':
        return [ROLES.LEGAL_TEAM, ROLES.GOVERNMENT_ENTITY].includes(userRole);
      
      case 'delete':
        return userRole === ROLES.LEGAL_TEAM;
      
      case 'upload':
        return ![ROLES.MEDIA_CONTACT, ROLES.OPPOSITION].includes(userRole);
      
      default:
        return false;
    }
  }

  /**
   * Check stakeholder access permissions
   */
  checkStakeholderPermission(user, action, stakeholderData) {
    const userRole = user.roleType;
    const rolePermissions = this.permissions[userRole];
    
    if (!rolePermissions.stakeholders) {
      return false;
    }

    const permissions = rolePermissions.stakeholders;

    // Handle self-access patterns
    if (action.includes('_own')) {
      if (stakeholderData?.user_id && stakeholderData.user_id === user.sub) {
        return permissions.includes(action);
      }
      return false;
    }

    // Handle approved/public access patterns
    if (action.includes('_approved') || action.includes('_public')) {
      // Check if stakeholder data is marked as public/approved
      if (stakeholderData?.is_public || stakeholderData?.is_approved) {
        return permissions.includes(action);
      }
      return false;
    }

    // Regular permission check
    return permissions.includes(action);
  }

  /**
   * Check communication access permissions
   */
  checkCommunicationPermission(user, action, communicationData) {
    const userRole = user.roleType;
    const rolePermissions = this.permissions[userRole];
    
    if (!rolePermissions.communications) {
      return false;
    }

    const permissions = rolePermissions.communications;

    // Handle own communications
    if (action.includes('_own')) {
      if (communicationData?.created_by === user.sub || 
          communicationData?.participants?.includes(user.sub)) {
        return permissions.includes(action);
      }
      return false;
    }

    // Handle approved communications (for media)
    if (action.includes('_approved')) {
      if (communicationData?.is_approved_for_media) {
        return permissions.includes(action);
      }
      return false;
    }

    // Handle public communications
    if (action.includes('_public')) {
      if (communicationData?.is_public) {
        return permissions.includes(action);
      }
      return false;
    }

    // Regular permission check
    return permissions.includes(action);
  }

  /**
   * Check task permissions
   */
  checkTaskPermission(user, action, taskData) {
    const userRole = user.roleType;
    const rolePermissions = this.permissions[userRole];
    
    if (!rolePermissions.tasks) {
      return false;
    }

    const permissions = rolePermissions.tasks;

    // Handle assigned tasks
    if (action.includes('_assigned')) {
      if (taskData?.assigned_to === user.sub) {
        return permissions.includes(action);
      }
      return false;
    }

    // Regular permission check
    return permissions.includes(action);
  }

  /**
   * Check risk permissions
   */
  checkRiskPermission(user, action, riskData) {
    const userRole = user.roleType;
    const rolePermissions = this.permissions[userRole];
    
    if (!rolePermissions.risks) {
      return false;
    }

    const permissions = rolePermissions.risks;

    // Handle own risk reports
    if (action.includes('_own')) {
      if (riskData?.reported_by === user.sub || 
          riskData?.affected_stakeholders?.includes(user.sub)) {
        return permissions.includes(action);
      }
      return false;
    }

    // Regular permission check
    return permissions.includes(action);
  }

  /**
   * Check audit permissions
   */
  checkAuditPermission(user, action, auditData) {
    const userRole = user.roleType;
    const rolePermissions = this.permissions[userRole];
    
    if (!rolePermissions.audit) {
      return false;
    }

    const permissions = rolePermissions.audit;
    return permissions.includes(action);
  }

  /**
   * Check admin permissions
   */
  checkAdminPermission(user, action, adminData) {
    const userRole = user.roleType;
    const rolePermissions = this.permissions[userRole];
    
    if (!rolePermissions.admin) {
      return false;
    }

    const permissions = rolePermissions.admin;
    return permissions.includes(action);
  }

  /**
   * Get all permissions for a user role
   */
  getUserPermissions(userRole) {
    return this.permissions[userRole] || {};
  }

  /**
   * Check if user can access document based on classification
   */
  canAccessDocumentClassification(userRole, classification) {
    const rolePermissions = this.permissions[userRole];
    if (!rolePermissions?.documents) {
      return false;
    }
    return rolePermissions.documents.includes(classification);
  }

  /**
   * Get highest document classification user can access
   */
  getMaxDocumentClassification(userRole) {
    const rolePermissions = this.permissions[userRole];
    if (!rolePermissions?.documents) {
      return null;
    }

    const classifications = rolePermissions.documents;
    const levels = [
      CLASSIFICATION_LEVELS.PUBLIC,
      CLASSIFICATION_LEVELS.INTERNAL,
      CLASSIFICATION_LEVELS.CONFIDENTIAL,
      CLASSIFICATION_LEVELS.SECRET
    ];

    // Return highest level user can access
    for (let i = levels.length - 1; i >= 0; i--) {
      if (classifications.includes(levels[i])) {
        return levels[i];
      }
    }

    return null;
  }

  /**
   * Filter resources based on user permissions
   */
  async filterResources(user, resources, resourceType) {
    const filteredResources = [];

    for (const resource of resources) {
      const hasAccess = await this.hasPermission(user, resourceType, 'read', resource);
      if (hasAccess) {
        // Apply field-level filtering if needed
        const filteredResource = this.applyFieldLevelSecurity(user, resource, resourceType);
        filteredResources.push(filteredResource);
      }
    }

    return filteredResources;
  }

  /**
   * Apply field-level security filtering
   */
  applyFieldLevelSecurity(user, resource, resourceType) {
    const userRole = user.roleType;
    const filteredResource = { ...resource };

    // Remove sensitive fields based on role
    switch (resourceType) {
      case 'stakeholders':
        if ([ROLES.MEDIA_CONTACT, ROLES.OPPOSITION].includes(userRole)) {
          delete filteredResource.contact_info;
          delete filteredResource.metadata;
          delete filteredResource.security_level;
        }
        break;

      case 'communications':
        if ([ROLES.MEDIA_CONTACT, ROLES.OPPOSITION].includes(userRole)) {
          delete filteredResource.participants;
          delete filteredResource.sensitive_content;
        }
        break;

      case 'documents':
        if ([ROLES.MEDIA_CONTACT, ROLES.OPPOSITION].includes(userRole)) {
          delete filteredResource.file_path;
          delete filteredResource.encryption_key_id;
          delete filteredResource.uploaded_by;
        }
        break;
    }

    return filteredResource;
  }

  /**
   * Log permission check for audit trail
   */
  async logPermissionCheck(user, resourceType, action, allowed, resourceData = null) {
    await auditLogger.log({
      action: 'permission_check',
      userId: user.sub,
      email: user.email,
      roleType: user.roleType,
      resourceType: resourceType,
      requestedAction: action,
      allowed: allowed,
      resourceId: resourceData?.id,
      timestamp: new Date().toISOString()
    });
  }
}

// Create singleton instance
const permissionSystem = new PermissionSystem();

module.exports = {
  PermissionSystem,
  permissionSystem
};