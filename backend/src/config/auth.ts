import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { promisify } from 'util';
import dotenv from 'dotenv';

dotenv.config();

// Auth0 Configuration
export const auth0Config = {
  domain: process.env.AUTH0_DOMAIN!,
  audience: process.env.AUTH0_AUDIENCE!,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
  issuer: `https://${process.env.AUTH0_DOMAIN}/`,
  algorithms: ['RS256'] as jwt.Algorithm[]
};

// JWKS Client for Auth0 public key verification
export const jwksClient = jwksClient({
  jwksUri: `https://${auth0Config.domain}/.well-known/jwks.json`,
  requestHeaders: {},
  timeout: 30000,
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5,
  cacheMaxAge: 600000 // 10 minutes
});

// Get signing key for JWT verification
export const getKey = (header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) => {
  jwksClient.getSigningKey(header.kid!, (err, key) => {
    if (err) {
      return callback(err);
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
};

// JWT Configuration
export const jwtConfig = {
  secret: process.env.JWT_SECRET!,
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET!,
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  algorithm: 'HS256' as jwt.Algorithm
};

// Verify Auth0 JWT token
export const verifyAuth0Token = async (token: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        audience: auth0Config.audience,
        issuer: auth0Config.issuer,
        algorithms: auth0Config.algorithms
      },
      (err, decoded) => {
        if (err) {
          reject(err);
        } else {
          resolve(decoded);
        }
      }
    );
  });
};

// Generate internal JWT token
export const generateToken = (payload: object): string => {
  return jwt.sign(payload, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
    algorithm: jwtConfig.algorithm
  });
};

// Generate refresh token
export const generateRefreshToken = (payload: object): string => {
  return jwt.sign(payload, jwtConfig.refreshTokenSecret, {
    expiresIn: jwtConfig.refreshTokenExpiresIn,
    algorithm: jwtConfig.algorithm
  });
};

// Verify internal JWT token
export const verifyToken = (token: string): Promise<any> => {
  return promisify(jwt.verify)(token, jwtConfig.secret);
};

// Verify refresh token
export const verifyRefreshToken = (token: string): Promise<any> => {
  return promisify(jwt.verify)(token, jwtConfig.refreshTokenSecret);
};

// Role permissions mapping
export const rolePermissions = {
  legal_team: [
    'users:read',
    'users:write',
    'stakeholders:read',
    'stakeholders:write',
    'documents:read',
    'documents:write',
    'documents:delete',
    'evidence:read',
    'evidence:write',
    'communications:read',
    'communications:write',
    'tasks:read',
    'tasks:write',
    'risk:read',
    'risk:write',
    'pr:read',
    'pr:write',
    'reports:read',
    'audit:read'
  ],
  government_entity: [
    'users:read_limited',
    'stakeholders:read',
    'stakeholders:write_limited',
    'documents:read',
    'documents:write',
    'evidence:read',
    'evidence:write',
    'communications:read',
    'communications:write',
    'tasks:read',
    'tasks:write',
    'risk:read',
    'reports:read_limited'
  ],
  esop_participant: [
    'stakeholders:read_limited',
    'documents:read_limited',
    'communications:read_limited',
    'tasks:read_limited',
    'reports:read_limited'
  ],
  witness: [
    'documents:read_limited',
    'communications:read_own',
    'evidence:read_own',
    'tasks:read_own'
  ],
  media_contact: [
    'pr:read',
    'communications:read_limited',
    'reports:read_public'
  ],
  opposition: [
    // Minimal permissions - mainly for audit trail
    'communications:read_own'
  ]
};

// Check if user has permission
export const hasPermission = (userRole: string, permission: string): boolean => {
  const permissions = rolePermissions[userRole as keyof typeof rolePermissions];
  return permissions ? permissions.includes(permission) : false;
};

// Get all permissions for a role
export const getRolePermissions = (role: string): string[] => {
  return rolePermissions[role as keyof typeof rolePermissions] || [];
};