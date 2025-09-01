import { Request } from 'express';

// User & Authentication Types
export interface User {
  id: string;
  auth0Id: string;
  email: string;
  roleType: 'legal_team' | 'government_entity' | 'esop_participant' | 'witness' | 'media_contact' | 'opposition';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
}

export interface UserPermission {
  id: string;
  userId: string;
  permissionType: string;
  resourceId?: string;
  grantedAt: Date;
  grantedBy?: string;
  expiresAt?: Date;
}

// Extended Request interface with user information
export interface AuthenticatedRequest extends Request {
  user: User;
  permissions?: UserPermission[];
}

// Stakeholder Types
export interface Stakeholder {
  id: string;
  userId?: string;
  category: string;
  subcategory?: string;
  name: string;
  organization?: string;
  title?: string;
  contactInfo: Record<string, any>; // Encrypted JSONB
  metadata: Record<string, any>; // Category-specific fields
  securityLevel: 'standard' | 'restricted' | 'high';
  createdAt: Date;
  updatedAt: Date;
}

// Document Types
export interface Document {
  id: string;
  title: string;
  description?: string;
  filePath?: string;
  fileHash?: string;
  fileSize?: number;
  mimeType?: string;
  classification: 'public' | 'internal' | 'confidential' | 'secret';
  uploadedBy: string;
  versionNumber: number;
  parentDocumentId?: string;
  encryptionKeyId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentAccessLog {
  id: string;
  documentId: string;
  userId: string;
  action: 'view' | 'download' | 'edit' | 'delete';
  ipAddress?: string;
  userAgent?: string;
  accessedAt: Date;
}

// Evidence Types
export interface EvidenceItem {
  id: string;
  documentId?: string;
  evidenceType: string;
  sourceStakeholderId?: string;
  chainOfCustody: ChainOfCustodyEntry[];
  integrityHash?: string;
  authenticityVerified: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;
  significanceLevel?: number; // 1-10
  notes?: string;
  createdAt: Date;
}

export interface ChainOfCustodyEntry {
  fromUser: string;
  toUser: string;
  transferredAt: Date;
  reason: string;
  location: string;
}

// Communication Types
export interface Communication {
  id: string;
  communicationType: 'email' | 'call' | 'meeting' | 'letter';
  subject?: string;
  summary?: string;
  participants: string[]; // Array of stakeholder IDs
  initiatedBy?: string;
  occurredAt: Date;
  durationMinutes?: number;
  location?: string;
  outcome?: string;
  followUpRequired: boolean;
  followUpDate?: Date;
  sensitiveContent: boolean;
  createdBy: string;
  createdAt: Date;
}

export interface CommunicationAttachment {
  id: string;
  communicationId: string;
  documentId: string;
  attachmentType?: string;
}

// Task Types
export interface Task {
  id: string;
  title: string;
  description?: string;
  taskType?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
  assignedTo?: string;
  createdBy: string;
  dueDate?: Date;
  completedAt?: Date;
  dependsOn: string[]; // Array of task IDs
  stakeholderIds: string[];
  phase?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskUpdate {
  id: string;
  taskId: string;
  userId: string;
  updateType: 'status_change' | 'comment' | 'assignment';
  oldValue?: string;
  newValue?: string;
  comment?: string;
  createdAt: Date;
}

// Risk Types
export interface RiskEvent {
  id: string;
  eventType: string;
  severityLevel: number; // 1-10
  description: string;
  affectedStakeholders: string[];
  reportedBy: string;
  verified: boolean;
  verifiedBy?: string;
  mitigationActions: string[];
  status: 'open' | 'investigating' | 'mitigated' | 'closed';
  occurredAt?: Date;
  reportedAt: Date;
  resolvedAt?: Date;
}

export interface RiskAssessment {
  id: string;
  stakeholderId: string;
  riskCategory: string;
  riskLevel: number; // 1-10
  assessmentNotes?: string;
  protectiveMeasures: string[];
  assessedBy: string;
  assessmentDate: Date;
  nextReviewDate?: Date;
}

// PR Message Types
export interface PRMessage {
  id: string;
  messageType?: string;
  title: string;
  content: string;
  targetAudience: string[];
  approvalStatus: 'draft' | 'review' | 'approved' | 'published' | 'archived';
  createdBy: string;
  approvedBy?: string;
  publishedAt?: Date;
  versionNumber: number;
  parentMessageId?: string;
  stakeholderCoordination: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Audit Types
export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  timestamp: Date;
}

export interface SystemEvent {
  id: string;
  eventType: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  metadata?: Record<string, any>;
  source: string;
  timestamp: Date;
}

// API Response Types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  timestamp: Date;
}

// File Upload Types
export interface FileUploadResult {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  hash: string;
  encryptionKeyId?: string;
  virusCheckPassed: boolean;
}

// WebSocket Event Types
export interface WebSocketEvent {
  type: string;
  data: any;
  userId?: string;
  room?: string;
  timestamp: Date;
}

// Database Query Options
export interface QueryOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
  search?: string;
  include?: string[];
}

// Background Job Types
export interface BackgroundJob {
  id: string;
  type: string;
  data: any;
  priority?: number;
  delay?: number;
  attempts?: number;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  createdAt: Date;
  processedAt?: Date;
  failedAt?: Date;
  error?: string;
}

// Rate Limiting Types
export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

// Validation Types
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// Encryption Types
export interface EncryptionResult {
  encryptedData: string;
  keyId: string;
  algorithm: string;
  iv: string;
}

export interface DecryptionOptions {
  keyId: string;
  algorithm: string;
  iv: string;
}

// Health Check Types
export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  services: {
    database: 'healthy' | 'unhealthy';
    redis: 'healthy' | 'unhealthy';
    filesystem: 'healthy' | 'unhealthy';
    clamav: 'healthy' | 'unhealthy';
  };
  uptime: number;
  memory: {
    used: number;
    free: number;
    total: number;
  };
}