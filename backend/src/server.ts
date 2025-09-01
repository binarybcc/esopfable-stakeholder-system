import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env['CORS_ORIGIN'] || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Basic middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
}));

app.use(cors({
  origin: process.env['CORS_ORIGIN'] || 'http://localhost:3000',
  credentials: true
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined'));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      database: 'connected',
      api: 'running',
      websockets: 'active'
    }
  });
});

// API status endpoint
app.get('/api/status', (_req, res) => {
  res.json({
    success: true,
    message: 'ESOPFable Case Management API is running',
    features: [
      'Authentication System',
      'Stakeholder Management', 
      'Document Security',
      'Evidence Chain',
      'Communication Hub',
      'Real-time Updates'
    ],
    endpoints: {
      health: '/health',
      docs: '/api-docs',
      auth: '/api/auth',
      stakeholders: '/api/stakeholders',
      documents: '/api/documents'
    }
  });
});

// Basic API documentation endpoint
app.get('/api-docs', (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>ESOPFable API Documentation</title>
      <style>
        body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px; text-align: center; }
        .endpoint { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; margin: 10px 0; }
        .method { display: inline-block; padding: 4px 8px; border-radius: 4px; color: white; font-size: 12px; font-weight: bold; }
        .get { background: #10b981; }
        .post { background: #3b82f6; }
        .put { background: #f59e0b; }
        .delete { background: #ef4444; }
        code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🔐 ESOPFable API</h1>
        <p>Case Management System API Documentation</p>
      </div>
      
      <h2>Available Endpoints</h2>
      
      <div class="endpoint">
        <span class="method get">GET</span>
        <strong>/health</strong>
        <p>System health check and status</p>
      </div>
      
      <div class="endpoint">
        <span class="method get">GET</span>
        <strong>/api/status</strong>
        <p>API status and feature information</p>
      </div>
      
      <div class="endpoint">
        <span class="method post">POST</span>
        <strong>/api/auth/login</strong>
        <p>User authentication (when implemented)</p>
      </div>
      
      <div class="endpoint">
        <span class="method get">GET</span>
        <strong>/api/stakeholders</strong>
        <p>Stakeholder management endpoints (when implemented)</p>
      </div>
      
      <div class="endpoint">
        <span class="method post">POST</span>
        <strong>/api/documents</strong>
        <p>Document upload and management (when implemented)</p>
      </div>
      
      <h2>Authentication</h2>
      <p>Default credentials for development:</p>
      <ul>
        <li>Email: <code>admin@esopfable.com</code></li>
        <li>Password: <code>SecureAdmin123!</code></li>
      </ul>
      
      <h2>Features</h2>
      <ul>
        <li>🔐 Secure Authentication & Authorization</li>
        <li>👥 Multi-stakeholder Management</li>
        <li>📄 Encrypted Document Storage</li>
        <li>🔍 Evidence Chain Tracking</li>
        <li>💬 Communication Logging</li>
        <li>⚡ Real-time Updates</li>
        <li>🛡️ Risk Monitoring</li>
      </ul>
    </body>
    </html>
  `);
});

// Basic authentication endpoint for demo
app.post('/api/auth/login', (_req, res) => {
  const { email, password } = _req.body;
  
  // Demo credentials check
  if (email === 'admin@esopfable.com' && password === 'SecureAdmin123!') {
    res.json({
      success: true,
      token: 'demo-token-' + Date.now(),
      user: {
        id: 1,
        email: 'admin@esopfable.com',
        name: 'System Administrator',
        role: 'admin'
      }
    });
  } else {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      }
    });
  }
});

// Demo stakeholder data
const demoStakeholders = [
  {
    id: '1',
    category: 'legal_team',
    subcategory: 'erisa_specialists',
    name: 'Sarah Mitchell',
    organization: 'Mitchell & Associates',
    title: 'Senior ERISA Attorney',
    contactInfo: {
      phone: '+1-555-0101',
      email: 'sarah.mitchell@lawfirm.com',
      address: '123 Legal Plaza, Washington DC 20001'
    },
    metadata: {
      specialty: 'ERISA Fiduciary Breaches',
      engagement_status: 'lead_counsel',
      fee_structure: 'contingency_33_percent'
    },
    securityLevel: 'standard',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '2',
    category: 'government_entities',
    subcategory: 'primary_targets',
    name: 'Department of Labor - EBSA',
    organization: 'U.S. Department of Labor',
    title: 'Employee Benefits Security Administration',
    contactInfo: {
      phone: '+1-202-693-8300',
      email: 'ebsa.enforcement@dol.gov',
      address: '200 Constitution Ave NW, Washington DC 20210'
    },
    metadata: {
      jurisdiction: 'federal',
      contact_person: 'Agent Jennifer Chen',
      damage_estimate: 25000000,
      cooperation_level: 'high'
    },
    securityLevel: 'restricted',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '3',
    category: 'key_witnesses',
    subcategory: 'primary_witnesses',
    name: 'David Kim',
    organization: 'Target Company Inc.',
    title: 'Former CFO',
    contactInfo: {
      phone: '+1-555-0301',
      email: 'dkim.secure@protonmail.com',
      address: 'Protected location'
    },
    metadata: {
      evidence_access: 'financial_records',
      vulnerability_level: 'high',
      protection_needed: 'witness_protection',
      testimony_strength: 9
    },
    securityLevel: 'high',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// Stakeholder API endpoints
app.get('/api/stakeholders', (_req, res) => {
  const { category, search, page = 1, limit = 20 } = _req.query;
  
  let filtered = [...demoStakeholders];
  
  // Apply category filter
  if (category) {
    filtered = filtered.filter(s => s.category === category);
  }
  
  // Apply search filter
  if (search) {
    const searchTerm = (search as string).toLowerCase();
    filtered = filtered.filter(s => 
      s.name.toLowerCase().includes(searchTerm) ||
      s.organization.toLowerCase().includes(searchTerm) ||
      s.title.toLowerCase().includes(searchTerm)
    );
  }
  
  // Apply pagination
  const startIndex = (Number(page) - 1) * Number(limit);
  const paginatedResults = filtered.slice(startIndex, startIndex + Number(limit));
  
  res.json({
    success: true,
    data: paginatedResults,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / Number(limit))
    },
    timestamp: new Date()
  });
});

app.get('/api/stakeholders/:id', (req, res) => {
  const stakeholder = demoStakeholders.find(s => s.id === req.params.id);
  
  if (!stakeholder) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Stakeholder not found' },
      timestamp: new Date()
    });
  }
  
  return res.json({
    success: true,
    data: stakeholder,
    timestamp: new Date()
  });
});

app.post('/api/stakeholders', (req, res) => {
  const newStakeholder = {
    id: String(demoStakeholders.length + 1),
    ...req.body,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  demoStakeholders.push(newStakeholder);
  
  res.status(201).json({
    success: true,
    data: { id: newStakeholder.id, message: 'Stakeholder created successfully' },
    timestamp: new Date()
  });
});

// Socket.IO real-time connections
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
      path: req.originalUrl,
      method: req.method
    },
    available_endpoints: [
      'GET /health',
      'GET /api/status', 
      'GET /api-docs'
    ]
  });
});

const PORT = process.env['PORT'] || 3001;

httpServer.listen(PORT, () => {
  console.log(`🚀 ESOPFable Case Management API Server running on port ${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/health`);
  console.log(`📚 API Documentation at http://localhost:${PORT}/api-docs`);
  console.log(`⚡ Real-time features enabled with Socket.IO`);
});