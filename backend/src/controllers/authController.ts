import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import database from '../config/database';
import logger from '../utils/logger';
import { User, LoginRequest, RegisterRequest, AuthResponse } from '../types';

export class AuthController {
  /**
   * Register new user
   */
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: errors.array()
          }
        });
      }

      const { email, password, name, role = 'stakeholder' }: RegisterRequest = req.body;

      // Check if user already exists
      const existingUser = await database('users')
        .where('email', email.toLowerCase())
        .first();

      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'USER_EXISTS',
            message: 'User with this email already exists'
          }
        });
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const trx = await database.transaction();
      
      try {
        // Create user
        const [user] = await trx('users')
          .insert({
            email: email.toLowerCase(),
            password: hashedPassword,
            name,
            role,
            status: 'active',
            created_at: new Date(),
            updated_at: new Date()
          })
          .returning(['id', 'email', 'name', 'role', 'status', 'created_at']);

        // Create user permissions based on role
        const permissions = this.getDefaultPermissions(role);
        for (const permission of permissions) {
          await trx('user_permissions').insert({
            user_id: user.id,
            permission,
            granted_at: new Date()
          });
        }

        // Log registration
        await trx('audit_logs').insert({
          table_name: 'users',
          record_id: user.id,
          action: 'CREATE',
          old_values: null,
          new_values: JSON.stringify({ email: user.email, role, status: 'active' }),
          user_id: user.id,
          timestamp: new Date(),
          ip_address: req.ip
        });

        await trx.commit();

        // Generate JWT token
        const token = this.generateToken(user);

        // Remove sensitive data
        const userResponse = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          created_at: user.created_at
        };

        const response: AuthResponse = {
          success: true,
          data: {
            user: userResponse,
            token,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
          },
          message: 'User registered successfully'
        };

        res.status(201).json(response);
      } catch (innerError) {
        await trx.rollback();
        throw innerError;
      }
    } catch (error) {
      logger.error('Error registering user:', error);
      next(error);
    }
  }

  /**
   * Login user
   */
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: errors.array()
          }
        });
      }

      const { email, password }: LoginRequest = req.body;

      // Find user
      const user = await database('users')
        .where('email', email.toLowerCase())
        .whereNull('deleted_at')
        .first();

      if (!user) {
        // Log failed login attempt
        logger.warn('Failed login attempt', { email, ip: req.ip });
        
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password'
          }
        });
      }

      // Check if user is active
      if (user.status !== 'active') {
        logger.warn('Login attempt by inactive user', { 
          userId: user.id, 
          email, 
          status: user.status,
          ip: req.ip 
        });

        return res.status(401).json({
          success: false,
          error: {
            code: 'ACCOUNT_INACTIVE',
            message: 'Account is inactive. Please contact administrator.'
          }
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        logger.warn('Failed login attempt - invalid password', { 
          userId: user.id, 
          email,
          ip: req.ip 
        });

        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password'
          }
        });
      }

      // Update last login
      await database('users')
        .where('id', user.id)
        .update({ 
          last_login: new Date(),
          updated_at: new Date()
        });

      // Generate JWT token
      const token = this.generateToken(user);

      // Get user permissions
      const permissions = await database('user_permissions')
        .where('user_id', user.id)
        .pluck('permission');

      // Remove sensitive data
      const userResponse = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        permissions,
        last_login: user.last_login,
        created_at: user.created_at
      };

      // Log successful login
      logger.info('Successful login', { 
        userId: user.id, 
        email, 
        role: user.role,
        ip: req.ip 
      });

      const response: AuthResponse = {
        success: true,
        data: {
          user: userResponse,
          token,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        },
        message: 'Login successful'
      };

      res.json(response);
    } catch (error) {
      logger.error('Error logging in user:', error);
      next(error);
    }
  }

  /**
   * Refresh JWT token
   */
  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      // Get fresh user data
      const user = await database('users')
        .where('id', userId)
        .whereNull('deleted_at')
        .first();

      if (!user || user.status !== 'active') {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_USER',
            message: 'User not found or inactive'
          }
        });
      }

      // Generate new token
      const token = this.generateToken(user);

      // Get user permissions
      const permissions = await database('user_permissions')
        .where('user_id', user.id)
        .pluck('permission');

      const userResponse = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        permissions,
        last_login: user.last_login,
        created_at: user.created_at
      };

      const response: AuthResponse = {
        success: true,
        data: {
          user: userResponse,
          token,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
        },
        message: 'Token refreshed successfully'
      };

      res.json(response);
    } catch (error) {
      logger.error('Error refreshing token:', error);
      next(error);
    }
  }

  /**
   * Logout user
   */
  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;

      if (userId) {
        // Log logout
        logger.info('User logout', { userId, ip: req.ip });
      }

      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      logger.error('Error logging out user:', error);
      next(error);
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      const user = await database('users')
        .select(['id', 'email', 'name', 'role', 'status', 'last_login', 'created_at', 'updated_at'])
        .where('id', userId)
        .whereNull('deleted_at')
        .first();

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          }
        });
      }

      // Get user permissions
      const permissions = await database('user_permissions')
        .where('user_id', userId)
        .pluck('permission');

      const userResponse = {
        ...user,
        permissions
      };

      res.json({
        success: true,
        data: { user: userResponse }
      });
    } catch (error) {
      logger.error('Error fetching user profile:', error);
      next(error);
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: errors.array()
          }
        });
      }

      const userId = req.user?.id;
      const { name, email } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      // Check if email is already taken by another user
      if (email) {
        const existingUser = await database('users')
          .where('email', email.toLowerCase())
          .whereNot('id', userId)
          .first();

        if (existingUser) {
          return res.status(409).json({
            success: false,
            error: {
              code: 'EMAIL_TAKEN',
              message: 'Email is already in use'
            }
          });
        }
      }

      // Update user
      const updateData: any = { updated_at: new Date() };
      if (name) updateData.name = name;
      if (email) updateData.email = email.toLowerCase();

      await database('users')
        .where('id', userId)
        .update(updateData);

      // Log profile update
      logger.info('User profile updated', { 
        userId, 
        changes: Object.keys(updateData).filter(key => key !== 'updated_at'),
        ip: req.ip 
      });

      res.json({
        success: true,
        message: 'Profile updated successfully'
      });
    } catch (error) {
      logger.error('Error updating user profile:', error);
      next(error);
    }
  }

  /**
   * Change user password
   */
  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: errors.array()
          }
        });
      }

      const userId = req.user?.id;
      const { currentPassword, newPassword } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      // Get current user
      const user = await database('users')
        .where('id', userId)
        .first();

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          }
        });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PASSWORD',
            message: 'Current password is incorrect'
          }
        });
      }

      // Hash new password
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await database('users')
        .where('id', userId)
        .update({
          password: hashedNewPassword,
          updated_at: new Date()
        });

      // Log password change
      logger.info('User password changed', { userId, ip: req.ip });

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      logger.error('Error changing password:', error);
      next(error);
    }
  }

  /**
   * Generate JWT token
   */
  private generateToken(user: User): string {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status
    };

    return jwt.sign(payload, process.env.JWT_SECRET || 'default-secret', {
      expiresIn: '24h',
      issuer: 'case-management-api',
      audience: 'case-management-client'
    });
  }

  /**
   * Get default permissions for role
   */
  private getDefaultPermissions(role: string): string[] {
    const permissionMap: Record<string, string[]> = {
      admin: [
        'users:read', 'users:create', 'users:update', 'users:delete',
        'stakeholders:read', 'stakeholders:create', 'stakeholders:update', 'stakeholders:delete',
        'documents:read', 'documents:create', 'documents:update', 'documents:delete',
        'evidence:read', 'evidence:create', 'evidence:update', 'evidence:delete',
        'communications:read', 'communications:create', 'communications:update', 'communications:delete',
        'tasks:read', 'tasks:create', 'tasks:update', 'tasks:delete',
        'reports:read', 'reports:create'
      ],
      case_manager: [
        'stakeholders:read', 'stakeholders:create', 'stakeholders:update',
        'documents:read', 'documents:create', 'documents:update',
        'evidence:read', 'evidence:create', 'evidence:update',
        'communications:read', 'communications:create', 'communications:update',
        'tasks:read', 'tasks:create', 'tasks:update',
        'reports:read'
      ],
      legal_team: [
        'stakeholders:read', 'stakeholders:create', 'stakeholders:update',
        'documents:read', 'documents:create', 'documents:update',
        'evidence:read', 'evidence:create', 'evidence:update',
        'communications:read', 'communications:create', 'communications:update',
        'tasks:read', 'tasks:create', 'tasks:update'
      ],
      investigator: [
        'stakeholders:read',
        'documents:read', 'documents:create',
        'evidence:read', 'evidence:create', 'evidence:update',
        'communications:read', 'communications:create',
        'tasks:read', 'tasks:update'
      ],
      stakeholder: [
        'documents:read',
        'communications:read', 'communications:create',
        'tasks:read'
      ]
    };

    return permissionMap[role] || permissionMap['stakeholder'];
  }
}