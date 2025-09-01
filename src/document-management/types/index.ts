export interface User {
  id: string;
  username: string;
  email: string;
  roles: string[];
  clearanceLevel: ClassificationLevel;
  createdAt: Date;
  updatedAt: Date;
}

export enum ClassificationLevel {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
  CONFIDENTIAL = 'CONFIDENTIAL',
  SECRET = 'SECRET'
}

export enum DocumentStatus {
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  SCANNING = 'SCANNING',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
  ERROR = 'ERROR'
}

export enum ProcessingStage {
  UPLOAD = 'UPLOAD',
  VIRUS_SCAN = 'VIRUS_SCAN',
  CLASSIFICATION = 'CLASSIFICATION',
  ENCRYPTION = 'ENCRYPTION',
  OCR = 'OCR',
  PREVIEW = 'PREVIEW',
  INDEXING = 'INDEXING',
  COMPLETE = 'COMPLETE'
}

export interface Document {
  id: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  classification: ClassificationLevel;
  status: DocumentStatus;
  encryptionKey: string; // Encrypted key reference
  checksumSHA256: string;
  checksumMD5: string;
  
  // Metadata
  title?: string;
  description?: string;
  tags: string[];
  category?: string;
  author: string; // User ID
  
  // Processing
  virusScanStatus: 'PENDING' | 'CLEAN' | 'INFECTED' | 'ERROR';
  ocrStatus: 'PENDING' | 'COMPLETE' | 'ERROR' | 'NOT_APPLICABLE';
  previewStatus: 'PENDING' | 'COMPLETE' | 'ERROR' | 'NOT_APPLICABLE';
  
  // File paths (encrypted)
  storagePath: string;
  previewPath?: string;
  thumbnailPath?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  accessedAt: Date;
  
  // Relationships
  parentId?: string; // For versions
  currentVersionId?: string;
  versions: DocumentVersion[];
  shares: DocumentShare[];
  activities: DocumentActivity[];
  permissions: DocumentPermission[];
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  version: number;
  filename: string;
  size: number;
  checksumSHA256: string;
  storagePath: string;
  changes?: string; // Description of changes
  createdBy: string; // User ID
  createdAt: Date;
  isActive: boolean;
}

export interface DocumentShare {
  id: string;
  documentId: string;
  shareToken: string;
  expiresAt: Date;
  maxDownloads?: number;
  downloadCount: number;
  requiresPassword: boolean;
  password?: string; // Hashed
  allowedIPs?: string[];
  createdBy: string; // User ID
  createdAt: Date;
  isActive: boolean;
  lastAccessedAt?: Date;
}

export interface DocumentPermission {
  id: string;
  documentId: string;
  userId?: string;
  roleId?: string;
  permissions: Permission[];
  grantedBy: string; // User ID
  grantedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export enum Permission {
  READ = 'READ',
  WRITE = 'WRITE',
  DELETE = 'DELETE',
  SHARE = 'SHARE',
  DOWNLOAD = 'DOWNLOAD',
  COMMENT = 'COMMENT',
  ANNOTATE = 'ANNOTATE',
  VERSION = 'VERSION'
}

export interface DocumentActivity {
  id: string;
  documentId: string;
  userId: string;
  action: ActivityAction;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

export enum ActivityAction {
  UPLOAD = 'UPLOAD',
  VIEW = 'VIEW',
  DOWNLOAD = 'DOWNLOAD',
  EDIT = 'EDIT',
  DELETE = 'DELETE',
  SHARE = 'SHARE',
  COMMENT = 'COMMENT',
  ANNOTATE = 'ANNOTATE',
  VERSION_CREATE = 'VERSION_CREATE',
  PERMISSION_GRANT = 'PERMISSION_GRANT',
  PERMISSION_REVOKE = 'PERMISSION_REVOKE'
}

export interface DocumentComment {
  id: string;
  documentId: string;
  userId: string;
  content: string;
  position?: {
    page: number;
    x: number;
    y: number;
  };
  parentId?: string; // For replies
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface DocumentAnnotation {
  id: string;
  documentId: string;
  userId: string;
  type: AnnotationType;
  content: string;
  position: {
    page: number;
    coordinates: number[];
  };
  style: {
    color: string;
    opacity: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export enum AnnotationType {
  HIGHLIGHT = 'HIGHLIGHT',
  NOTE = 'NOTE',
  DRAWING = 'DRAWING',
  STAMP = 'STAMP'
}

export interface ProcessingJob {
  id: string;
  documentId: string;
  stage: ProcessingStage;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  progress: number; // 0-100
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  maxRetries: number;
  metadata: Record<string, any>;
}

export interface SearchResult {
  documentId: string;
  document: Document;
  score: number;
  highlights: string[];
  snippet?: string;
}

export interface SearchQuery {
  query: string;
  filters: {
    classification?: ClassificationLevel[];
    category?: string[];
    tags?: string[];
    author?: string[];
    dateRange?: {
      from: Date;
      to: Date;
    };
    mimeType?: string[];
    size?: {
      min?: number;
      max?: number;
    };
  };
  sort?: {
    field: string;
    direction: 'ASC' | 'DESC';
  };
  pagination: {
    page: number;
    limit: number;
  };
}

export interface WatermarkConfig {
  text: string;
  opacity: number;
  fontSize: number;
  color: string;
  position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  angle: number;
}

export interface DLPResult {
  documentId: string;
  scanDate: Date;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  findings: DLPFinding[];
  recommendedClassification?: ClassificationLevel;
  autoClassified: boolean;
}

export interface DLPFinding {
  type: string;
  description: string;
  confidence: number;
  location: {
    page?: number;
    line?: number;
    column?: number;
  };
  text: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface BackupConfig {
  documentId: string;
  schedule: string; // Cron expression
  retentionDays: number;
  encryptionKey: string;
  destination: string;
  isActive: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  error?: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UploadResponse {
  documentId: string;
  filename: string;
  size: number;
  checksumSHA256: string;
  uploadUrl?: string; // For direct uploads
  processingJobId: string;
}

export interface BatchOperation {
  id: string;
  type: 'DELETE' | 'MOVE' | 'CLASSIFY' | 'SHARE' | 'PERMISSION';
  documentIds: string[];
  parameters: Record<string, any>;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  progress: number;
  results: BatchOperationResult[];
  createdBy: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface BatchOperationResult {
  documentId: string;
  success: boolean;
  error?: string;
}