import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { body } from 'express-validator';
import { jwtConfig } from '../config/auth';
import database from '../config/database';
import { validateRequest } from '../middleware/validation';
import { APIResponse, User } from '../types';
import logger, { logSecurity } from '../utils/logger';

const router = express.Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate user and get JWT token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: Authentication failed
 */
router.post('/login', 
  validateRequest({
    body: body({
      email: body('email').isEmail().normalizeEmail(),
      password: body('password').isLength({ min: 6 }),
    })
  }),
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // Find user by email
      const user = await database('users')
        .select('*')
        .where({ email: email.toLowerCase() })
        .first();

      if (!user) {
        logSecurity('login_attempt_invalid_email', {
          email,
          ip: req.ip,
          userAgent: req.get('user-agent'),
        });

        const response: APIResponse = {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
          timestamp: new Date(),
        };
        return res.status(401).json(response);
      }

      // Check if account is active
      if (!user.isActive) {
        logSecurity('login_attempt_inactive_account', {
          userId: user.id,
          email,
          ip: req.ip,
          userAgent: req.get('user-agent'),
        });

        const response: APIResponse = {
          success: false,
          error: {
            code: 'ACCOUNT_INACTIVE',
            message: 'Account is inactive',
          },
          timestamp: new Date(),
        };
        return res.status(401).json(response);
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        logSecurity('login_attempt_invalid_password', {
          userId: user.id,
          email,
          ip: req.ip,
          userAgent: req.get('user-agent'),
        });

        const response: APIResponse = {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
          timestamp: new Date(),
        };
        return res.status(401).json(response);
      }

      // Generate JWT token
      const tokenPayload = {
        sub: user.id,
        email: user.email,
        roleType: user.roleType,
        iat: Math.floor(Date.now() / 1000),
      };

      const token = jwt.sign(tokenPayload, jwtConfig.secret, {
        expiresIn: jwtConfig.expiresIn,
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      });

      // Update last login
      await database('users')
        .where({ id: user.id })
        .update({ lastLogin: new Date() });

      // Log successful login
      logSecurity('login_successful', {
        userId: user.id,
        email,
        roleType: user.roleType,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      // Remove sensitive information from user object
      const { passwordHash, ...safeUser } = user;

      const response: APIResponse = {
        success: true,
        data: {
          token,
          user: safeUser,
          expiresIn: jwtConfig.expiresIn,
        },
        timestamp: new Date(),
      };

      res.json(response);
    } catch (error) {
      logger.error('Login error:', error);
      
      const response: APIResponse = {
        success: false,
        error: {
          code: 'LOGIN_ERROR',
          message: 'Authentication failed',
        },
        timestamp: new Date(),
      };
      
      res.status(500).json(response);
    }
  }
);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user (admin only)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - roleType
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               roleType:
 *                 type: string
 *                 enum: [legal_team, government_entity, esop_participant, witness, media_contact, opposition]
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 */
router.post('/register',
  validateRequest({
    body: body({
      email: body('email').isEmail().normalizeEmail(),
      password: body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
      roleType: body('roleType').isIn(['legal_team', 'government_entity', 'esop_participant', 'witness', 'media_contact', 'opposition']),
      firstName: body('firstName').optional().isLength({ min: 1, max: 100 }),
      lastName: body('lastName').optional().isLength({ min: 1, max: 100 }),
    })
  }),
  async (req, res) => {
    try {
      const { email, password, roleType, firstName, lastName } = req.body;

      // Check if user already exists
      const existingUser = await database('users')
        .select('id')
        .where({ email: email.toLowerCase() })
        .first();

      if (existingUser) {
        const response: APIResponse = {
          success: false,
          error: {
            code: 'USER_EXISTS',
            message: 'User with this email already exists',
          },
          timestamp: new Date(),
        };
        return res.status(409).json(response);
      }

      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create user
      const [userId] = await database('users').insert({
        email: email.toLowerCase(),
        passwordHash,
        roleType,
        firstName: firstName || null,
        lastName: lastName || null,
        isActive: true,
      }).returning('id');

      logSecurity('user_registered', {
        userId,
        email,
        roleType,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      const response: APIResponse = {
        success: true,
        data: {
          userId,
          message: 'User created successfully',
        },
        timestamp: new Date(),
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error('Registration error:', error);
      
      const response: APIResponse = {
        success: false,
        error: {
          code: 'REGISTRATION_ERROR',
          message: 'User registration failed',
        },
        timestamp: new Date(),
      };
      
      res.status(500).json(response);
    }
  }
);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh JWT token
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 */
router.post('/refresh', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      const response: APIResponse = {
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authorization header required',
        },
        timestamp: new Date(),
      };
      return res.status(401).json(response);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      const response: APIResponse = {
        success: false,
        error: {
          code: 'INVALID_TOKEN_FORMAT',
          message: 'Bearer token required',
        },
        timestamp: new Date(),
      };
      return res.status(401).json(response);
    }

    // Verify token (even if expired, for refresh)
    const decoded = jwt.verify(token, jwtConfig.secret, { ignoreExpiration: true }) as any;

    // Get current user data
    const user = await database('users')
      .select('*')
      .where({ id: decoded.sub })
      .first();

    if (!user || !user.isActive) {
      const response: APIResponse = {
        success: false,
        error: {
          code: 'INVALID_USER',
          message: 'User not found or inactive',
        },
        timestamp: new Date(),
      };
      return res.status(401).json(response);
    }

    // Generate new token
    const tokenPayload = {
      sub: user.id,
      email: user.email,
      roleType: user.roleType,
      iat: Math.floor(Date.now() / 1000),
    };

    const newToken = jwt.sign(tokenPayload, jwtConfig.secret, {
      expiresIn: jwtConfig.expiresIn,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
    });

    logSecurity('token_refreshed', {
      userId: user.id,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    const response: APIResponse = {
      success: true,
      data: {
        token: newToken,
        expiresIn: jwtConfig.expiresIn,
      },
      timestamp: new Date(),
    };

    res.json(response);
  } catch (error) {
    logger.error('Token refresh error:', error);
    
    const response: APIResponse = {
      success: false,
      error: {
        code: 'TOKEN_REFRESH_ERROR',
        message: 'Token refresh failed',
      },
      timestamp: new Date(),
    };
    
    res.status(401).json(response);
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user (token blacklisting would be implemented here)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', (req, res) => {
  // In a production environment, you would add the token to a blacklist
  // For now, we just log the logout event
  
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, jwtConfig.secret) as any;
      logSecurity('user_logout', {
        userId: decoded.sub,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
    } catch (error) {
      // Token invalid, but that's okay for logout
    }
  }

  const response: APIResponse = {
    success: true,
    data: {
      message: 'Logout successful',
    },
    timestamp: new Date(),
  };

  res.json(response);
});

export default router;