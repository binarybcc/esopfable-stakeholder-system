/**
 * User Registration Service
 * Handles registration flows for different stakeholder types with Auth0
 */

const { ManagementClient } = require('auth0');
const { auth0Config, ROLES } = require('../../config/auth/auth0-config');
const { auditLogger } = require('../services/audit-service');
const { permissionSystem } = require('../security/permission-system');
const crypto = require('crypto');

class UserRegistrationService {
  constructor() {
    this.managementClient = new ManagementClient({
      domain: auth0Config.domain,
      clientId: auth0Config.managementClientId,
      clientSecret: auth0Config.managementClientSecret,
      audience: auth0Config.managementAudience
    });
  }

  /**
   * Register a new user with role-specific setup
   */
  async registerUser(registrationData) {
    try {
      const { 
        email, 
        password, 
        roleType, 
        organizationInfo, 
        securityLevel = 'standard',
        invitationCode,
        registeredBy 
      } = registrationData;

      // Validate registration data
      await this.validateRegistration(registrationData);

      // Create Auth0 user
      const auth0User = await this.createAuth0User({
        email,
        password,
        roleType,
        organizationInfo,
        securityLevel
      });

      // Create database user record
      const dbUser = await this.createDatabaseUser({
        auth0Id: auth0User.user_id,
        email: auth0User.email,
        roleType,
        securityLevel,
        organizationInfo
      });

      // Set up role-specific configurations
      await this.setupRoleSpecificConfig(auth0User.user_id, roleType, organizationInfo);

      // Send welcome email based on role
      await this.sendWelcomeEmail(auth0User, roleType);

      // Log registration
      await auditLogger.log({
        action: 'user_registration',
        userId: auth0User.user_id,
        email: auth0User.email,
        roleType: roleType,
        securityLevel: securityLevel,
        registeredBy: registeredBy,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        user: {
          id: auth0User.user_id,
          email: auth0User.email,
          roleType: roleType,
          securityLevel: securityLevel
        }
      };

    } catch (error) {
      console.error('User registration failed:', error);
      
      await auditLogger.log({
        action: 'user_registration_failed',
        email: registrationData.email,
        roleType: registrationData.roleType,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }

  /**
   * Create Auth0 user account
   */
  async createAuth0User({ email, password, roleType, organizationInfo, securityLevel }) {
    const userData = {
      email: email,
      password: password,
      connection: 'Username-Password-Authentication',
      email_verified: false,
      app_metadata: {
        role_type: roleType,
        security_level: securityLevel,
        organization: organizationInfo?.name,
        department: organizationInfo?.department,
        registration_date: new Date().toISOString(),
        requires_approval: this.requiresApproval(roleType)
      },
      user_metadata: {
        first_name: organizationInfo?.firstName,
        last_name: organizationInfo?.lastName,
        title: organizationInfo?.title,
        phone: organizationInfo?.phone
      }
    };

    // Add role-specific metadata
    userData.app_metadata = {
      ...userData.app_metadata,
      ...this.getRoleSpecificMetadata(roleType, organizationInfo)
    };

    const user = await this.managementClient.createUser(userData);

    // Assign roles
    await this.assignUserRoles(user.user_id, roleType);

    return user;
  }

  /**
   * Create database user record
   */
  async createDatabaseUser({ auth0Id, email, roleType, securityLevel, organizationInfo }) {
    // This would typically use your database ORM/client
    const userRecord = {
      auth0_id: auth0Id,
      email: email,
      role_type: roleType,
      security_level: securityLevel,
      is_active: false, // Pending approval for some roles
      created_at: new Date(),
      updated_at: new Date()
    };

    // In a real implementation, you would insert this into your database
    // const dbUser = await db.users.create(userRecord);
    
    return userRecord;
  }

  /**
   * Assign roles to user in Auth0
   */
  async assignUserRoles(userId, roleType) {
    try {
      // Get role ID from Auth0
      const roles = await this.managementClient.getRoles();
      const role = roles.find(r => r.name === roleType);

      if (role) {
        await this.managementClient.assignRolestoUser(
          { id: userId },
          { roles: [role.id] }
        );
      }

      // Assign default permissions based on role
      const permissions = this.getDefaultPermissions(roleType);
      if (permissions.length > 0) {
        await this.managementClient.assignPermissionsToUser(
          { id: userId },
          { permissions: permissions }
        );
      }
    } catch (error) {
      console.error('Failed to assign user roles:', error);
      throw error;
    }
  }

  /**
   * Get default permissions for role
   */
  getDefaultPermissions(roleType) {
    const rolePermissions = auth0Config.rolePermissions[roleType];
    if (!rolePermissions) return [];

    const permissions = [];

    // Convert role permissions to Auth0 permission format
    Object.keys(rolePermissions).forEach(resource => {
      const actions = rolePermissions[resource];
      if (Array.isArray(actions)) {
        actions.forEach(action => {
          permissions.push({
            permission_name: `${action}:${resource}`,
            resource_server_identifier: auth0Config.audience
          });
        });
      }
    });

    return permissions;
  }

  /**
   * Get role-specific metadata
   */
  getRoleSpecificMetadata(roleType, organizationInfo) {
    const metadata = {};

    switch (roleType) {
      case ROLES.LEGAL_TEAM:
        metadata.specialty = organizationInfo?.specialty;
        metadata.bar_number = organizationInfo?.barNumber;
        metadata.firm = organizationInfo?.firm;
        metadata.clearance_level = organizationInfo?.clearanceLevel || 'standard';
        break;

      case ROLES.GOVERNMENT_ENTITY:
        metadata.agency = organizationInfo?.agency;
        metadata.jurisdiction = organizationInfo?.jurisdiction;
        metadata.badge_number = organizationInfo?.badgeNumber;
        metadata.clearance_level = organizationInfo?.clearanceLevel || 'confidential';
        break;

      case ROLES.ESOP_PARTICIPANT:
        metadata.employee_id = organizationInfo?.employeeId;
        metadata.years_service = organizationInfo?.yearsService;
        metadata.esop_stake = organizationInfo?.esopStake;
        metadata.department = organizationInfo?.department;
        break;

      case ROLES.WITNESS:
        metadata.witness_type = organizationInfo?.witnessType;
        metadata.protection_level = organizationInfo?.protectionLevel || 'high';
        metadata.case_involvement = organizationInfo?.caseInvolvement;
        metadata.requires_anonymity = organizationInfo?.requiresAnonymity || true;
        break;

      case ROLES.MEDIA_CONTACT:
        metadata.outlet = organizationInfo?.outlet;
        metadata.beat = organizationInfo?.beat;
        metadata.circulation = organizationInfo?.circulation;
        metadata.verification_status = 'pending';
        break;

      case ROLES.OPPOSITION:
        metadata.organization_type = organizationInfo?.organizationType;
        metadata.relationship_to_case = organizationInfo?.relationshipToCase;
        metadata.access_level = 'public_only';
        break;
    }

    return metadata;
  }

  /**
   * Setup role-specific configurations
   */
  async setupRoleSpecificConfig(userId, roleType, organizationInfo) {
    switch (roleType) {
      case ROLES.WITNESS:
        await this.setupWitnessProtection(userId, organizationInfo);
        break;

      case ROLES.LEGAL_TEAM:
        await this.setupLegalTeamAccess(userId, organizationInfo);
        break;

      case ROLES.GOVERNMENT_ENTITY:
        await this.setupGovernmentAccess(userId, organizationInfo);
        break;

      case ROLES.MEDIA_CONTACT:
        await this.setupMediaVerification(userId, organizationInfo);
        break;

      default:
        // Standard setup for other roles
        break;
    }
  }

  /**
   * Setup witness protection configurations
   */
  async setupWitnessProtection(userId, organizationInfo) {
    // Enable additional security measures for witnesses
    await this.managementClient.updateUser(
      { id: userId },
      {
        app_metadata: {
          requires_mfa: true,
          session_timeout: 2 * 60 * 60, // 2 hours
          ip_restriction_enabled: true,
          anonymity_level: organizationInfo?.anonymityLevel || 'high'
        }
      }
    );

    // Create witness protection record in database
    // This would typically create additional security records
  }

  /**
   * Setup legal team access
   */
  async setupLegalTeamAccess(userId, organizationInfo) {
    await this.managementClient.updateUser(
      { id: userId },
      {
        app_metadata: {
          requires_mfa: true,
          document_access_level: 'secret',
          can_approve_users: true,
          audit_trail_enabled: true
        }
      }
    );
  }

  /**
   * Setup government entity access
   */
  async setupGovernmentAccess(userId, organizationInfo) {
    await this.managementClient.updateUser(
      { id: userId },
      {
        app_metadata: {
          requires_mfa: true,
          document_access_level: 'confidential',
          government_verification: 'pending',
          agency_clearance: organizationInfo?.clearanceLevel
        }
      }
    );
  }

  /**
   * Setup media contact verification
   */
  async setupMediaVerification(userId, organizationInfo) {
    await this.managementClient.updateUser(
      { id: userId },
      {
        app_metadata: {
          media_verification: 'pending',
          outlet_verification: 'pending',
          access_level: 'public_only',
          requires_approval: true
        }
      }
    );
  }

  /**
   * Validate registration data
   */
  async validateRegistration(data) {
    const { email, password, roleType, organizationInfo, invitationCode } = data;

    // Basic validation
    if (!email || !password || !roleType) {
      throw new Error('Missing required fields');
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    // Password policy validation
    if (!this.validatePassword(password)) {
      throw new Error('Password does not meet security requirements');
    }

    // Role validation
    if (!Object.values(ROLES).includes(roleType)) {
      throw new Error('Invalid role type');
    }

    // Check if role requires invitation
    if (this.requiresInvitation(roleType) && !invitationCode) {
      throw new Error('Invitation code required for this role');
    }

    // Role-specific validation
    await this.validateRoleSpecificData(roleType, organizationInfo);

    return true;
  }

  /**
   * Validate password against policy
   */
  validatePassword(password) {
    const policy = auth0Config.passwordPolicy;

    if (password.length < policy.length.min || password.length > policy.length.max) {
      return false;
    }

    if (policy.includeCharacters.lower && !/[a-z]/.test(password)) {
      return false;
    }

    if (policy.includeCharacters.upper && !/[A-Z]/.test(password)) {
      return false;
    }

    if (policy.includeCharacters.numbers && !/[0-9]/.test(password)) {
      return false;
    }

    if (policy.includeCharacters.symbols && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return false;
    }

    return true;
  }

  /**
   * Check if role requires invitation code
   */
  requiresInvitation(roleType) {
    return [ROLES.LEGAL_TEAM, ROLES.GOVERNMENT_ENTITY, ROLES.WITNESS].includes(roleType);
  }

  /**
   * Check if role requires manual approval
   */
  requiresApproval(roleType) {
    return [ROLES.GOVERNMENT_ENTITY, ROLES.MEDIA_CONTACT, ROLES.OPPOSITION].includes(roleType);
  }

  /**
   * Validate role-specific data
   */
  async validateRoleSpecificData(roleType, organizationInfo) {
    if (!organizationInfo) {
      throw new Error('Organization information required');
    }

    switch (roleType) {
      case ROLES.LEGAL_TEAM:
        if (!organizationInfo.barNumber || !organizationInfo.firm) {
          throw new Error('Bar number and firm required for legal team');
        }
        break;

      case ROLES.GOVERNMENT_ENTITY:
        if (!organizationInfo.agency || !organizationInfo.badgeNumber) {
          throw new Error('Agency and badge number required for government entity');
        }
        break;

      case ROLES.MEDIA_CONTACT:
        if (!organizationInfo.outlet) {
          throw new Error('Media outlet required for media contact');
        }
        break;
    }
  }

  /**
   * Send welcome email based on role
   */
  async sendWelcomeEmail(user, roleType) {
    try {
      // This would typically integrate with an email service
      const emailTemplate = this.getWelcomeEmailTemplate(roleType);
      
      console.log(`Sending welcome email to ${user.email} for role ${roleType}`);
      
      // In production, you would send the actual email here
      // await emailService.send({
      //   to: user.email,
      //   template: emailTemplate,
      //   data: { user: user, roleType: roleType }
      // });

    } catch (error) {
      console.error('Failed to send welcome email:', error);
      // Don't throw error - registration should still succeed
    }
  }

  /**
   * Get welcome email template for role
   */
  getWelcomeEmailTemplate(roleType) {
    const templates = {
      [ROLES.LEGAL_TEAM]: 'legal-team-welcome',
      [ROLES.GOVERNMENT_ENTITY]: 'government-welcome',
      [ROLES.ESOP_PARTICIPANT]: 'participant-welcome',
      [ROLES.WITNESS]: 'witness-welcome',
      [ROLES.MEDIA_CONTACT]: 'media-welcome',
      [ROLES.OPPOSITION]: 'opposition-welcome'
    };

    return templates[roleType] || 'default-welcome';
  }

  /**
   * Approve user registration (admin function)
   */
  async approveUser(userId, approvedBy) {
    try {
      // Update Auth0 user
      await this.managementClient.updateUser(
        { id: userId },
        {
          app_metadata: {
            approved: true,
            approved_by: approvedBy.sub,
            approved_at: new Date().toISOString()
          }
        }
      );

      // Update database user
      // await db.users.update({ auth0_id: userId }, { is_active: true });

      // Send approval notification
      const user = await this.managementClient.getUser({ id: userId });
      await this.sendApprovalEmail(user);

      await auditLogger.log({
        action: 'user_approved',
        userId: userId,
        approvedBy: approvedBy.sub,
        approvedByEmail: approvedBy.email,
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error('User approval failed:', error);
      throw error;
    }
  }

  /**
   * Reject user registration (admin function)
   */
  async rejectUser(userId, rejectedBy, reason) {
    try {
      const user = await this.managementClient.getUser({ id: userId });
      
      // Send rejection notification
      await this.sendRejectionEmail(user, reason);

      // Delete user
      await this.managementClient.deleteUser({ id: userId });

      await auditLogger.log({
        action: 'user_rejected',
        userId: userId,
        rejectedBy: rejectedBy.sub,
        rejectedByEmail: rejectedBy.email,
        reason: reason,
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error('User rejection failed:', error);
      throw error;
    }
  }

  /**
   * Send approval email
   */
  async sendApprovalEmail(user) {
    console.log(`Sending approval email to ${user.email}`);
    // In production, implement actual email sending
  }

  /**
   * Send rejection email
   */
  async sendRejectionEmail(user, reason) {
    console.log(`Sending rejection email to ${user.email}: ${reason}`);
    // In production, implement actual email sending
  }
}

// Create singleton instance
const userRegistrationService = new UserRegistrationService();

module.exports = {
  UserRegistrationService,
  userRegistrationService
};