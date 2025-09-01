import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { expressjwt } from 'express-jwt';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { Server } from 'socket.io';
import { createServer } from 'http';
import dotenv from 'dotenv';

// Import configuration and utilities
import database from './config/database';
import { jwtConfig } from './config/auth';
import logger from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { auditLogger } from './middleware/auditLogger';
import { validateRequest } from './middleware/validation';
import { sanitizeInput } from './middleware/sanitization';

// Import routes
import authRoutes from './routes/auth';
import stakeholderRoutes from './routes/stakeholders';
import documentRoutes from './routes/documents';
import evidenceRoutes from './routes/evidence';
import communicationRoutes from './routes/communications';
import taskRoutes from './routes/tasks';
import riskRoutes from './routes/risk';
import prMessageRoutes from './routes/prMessages';
import healthRoutes from './routes/health';
import adminRoutes from './routes/admin';

// Import socket handlers
import { initializeSocketIO } from './sockets/socketManager';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Initialize Socket.IO
initializeSocketIO(io);

// Rate limiting configuration
const createRateLimit = (windowMs: number, max: number, message: string) => 
  rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
  });

const createSlowDown = (windowMs: number, delayAfter: number, delayMs: number) =>
  slowDown({
    windowMs,
    delayAfter,
    delayMs,
    maxDelayMs: 5000,
  });

// Global rate limits
const globalRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  1000, // limit each IP to 1000 requests per windowMs
  'Too many requests from this IP, please try again later.'
);

const authRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // limit each IP to 5 login attempts per windowMs
  'Too many authentication attempts, please try again later.'
);

const uploadRateLimit = createRateLimit(
  60 * 60 * 1000, // 1 hour
  50, // limit each IP to 50 uploads per hour
  'Too many file uploads, please try again later.'
);

const speedLimiter = createSlowDown(
  15 * 60 * 1000, // 15 minutes
  100, // allow first 100 requests at normal speed
  250 // slow down subsequent requests by 250ms
);

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Case Management API',
      version: '1.0.0',
      description: 'Secure API for complex case management with stakeholder coordination, document management, and evidence tracking',
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'http://localhost:8000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/models/*.ts'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middleware stack
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    process.env.ADMIN_URL || 'http://localhost:3001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Custom middleware
app.use(requestLogger);
app.use(sanitizeInput);

// Rate limiting
app.use(globalRateLimit);
app.use(speedLimiter);

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
}

// JWT Authentication middleware (applied selectively)
const jwtMiddleware = expressjwt({
  secret: jwtConfig.secret,
  algorithms: ['HS256'],
  credentialsRequired: false,
  getToken: (req) => {
    if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
      return req.headers.authorization.split(' ')[1];
    }
    return null;
  }
});

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check (public)
app.use('/api/health', healthRoutes);

// Authentication routes (with auth rate limiting)
app.use('/api/auth', authRateLimit, authRoutes);

// Protected API routes
app.use('/api/stakeholders', jwtMiddleware, auditLogger, stakeholderRoutes);
app.use('/api/documents', jwtMiddleware, uploadRateLimit, auditLogger, documentRoutes);
app.use('/api/evidence', jwtMiddleware, auditLogger, evidenceRoutes);
app.use('/api/communications', jwtMiddleware, auditLogger, communicationRoutes);
app.use('/api/tasks', jwtMiddleware, auditLogger, taskRoutes);
app.use('/api/risk', jwtMiddleware, auditLogger, riskRoutes);
app.use('/api/pr-messages', jwtMiddleware, auditLogger, prMessageRoutes);
app.use('/api/admin', jwtMiddleware, auditLogger, adminRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
    timestamp: new Date(),
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = () => {
  logger.info('Starting graceful shutdown...');
  
  server.close((err) => {
    if (err) {
      logger.error('Error during server shutdown:', err);
      process.exit(1);
    }
    
    database.destroy(() => {
      logger.info('Database connections closed');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const PORT = process.env.PORT || 8000;

server.listen(PORT, () => {
  logger.info(`Case Management API Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`API Documentation available at: http://localhost:${PORT}/api-docs`);
  
  // Test database connection
  database.raw('SELECT 1')
    .then(() => {
      logger.info('Database connection successful');
    })
    .catch((error: Error) => {
      logger.error('Database connection failed:', error);
      process.exit(1);
    });
});

export default app;
export { io };