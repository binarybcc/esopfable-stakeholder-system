// Core entity types based on database schema
export interface User {
  id: string;
  auth0Id: string;
  email: string;
  roleType: 'legal_team' | 'government_entity' | 'esop_participant' | 'witness' | 'media_contact' | 'opposition';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

export interface Stakeholder {
  id: string;
  userId?: string;
  category: string;
  subcategory?: string;
  name: string;
  organization?: string;
  title?: string;
  contactInfo: any; // Encrypted JSON
  metadata: any; // Category-specific fields
  securityLevel: 'standard' | 'restricted' | 'high';
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  title: string;
  description?: string;
  filePath: string;
  fileHash: string;
  fileSize: number;
  mimeType: string;
  classification: 'public' | 'internal' | 'confidential' | 'secret';
  uploadedBy: string;
  versionNumber: number;
  parentDocumentId?: string;
  encryptionKeyId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceItem {
  id: string;
  documentId?: string;
  evidenceType: string;
  sourceStakeholderId?: string;
  chainOfCustody: ChainOfCustodyEntry[];
  integrityHash: string;
  authenticityVerified: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  significanceLevel: number;
  notes?: string;
  createdAt: string;
}

export interface ChainOfCustodyEntry {
  fromUser: string;
  toUser: string;
  transferredAt: string;
  reason: string;
  location: string;
}

export interface Communication {
  id: string;
  communicationType: 'email' | 'call' | 'meeting' | 'letter';
  subject?: string;
  summary?: string;
  participants: string[]; // Stakeholder IDs
  initiatedBy?: string;
  occurredAt: string;
  durationMinutes?: number;
  location?: string;
  outcome?: string;
  followUpRequired: boolean;
  followUpDate?: string;
  sensitiveContent: boolean;
  createdBy: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  taskType?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
  assignedTo?: string;
  createdBy: string;
  dueDate?: string;
  completedAt?: string;
  dependsOn: string[]; // Task IDs
  stakeholderIds: string[];
  phase?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RiskEvent {
  id: string;
  eventType: string;
  severityLevel: number;
  description: string;
  affectedStakeholders: string[];
  reportedBy: string;
  verified: boolean;
  verifiedBy?: string;
  mitigationActions: string[];
  status: 'open' | 'investigating' | 'mitigated' | 'closed';
  occurredAt?: string;
  reportedAt: string;
  resolvedAt?: string;
}

export interface PRMessage {
  id: string;
  messageType: 'press_release' | 'statement' | 'talking_points';
  title: string;
  content: string;
  targetAudience: string[];
  approvalStatus: 'draft' | 'review' | 'approved' | 'published' | 'archived';
  createdBy: string;
  approvedBy?: string;
  publishedAt?: string;
  versionNumber: number;
  parentMessageId?: string;
  stakeholderCoordination: string[];
  createdAt: string;
  updatedAt: string;
}

// UI-specific types
export interface DashboardStats {
  totalStakeholders: number;
  activeDocuments: number;
  pendingTasks: number;
  openRiskEvents: number;
  recentCommunications: number;
}

export interface FilterOptions {
  category?: string[];
  status?: string[];
  priority?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  assignedTo?: string[];
  classification?: string[];
}

export interface SortOption {
  field: string;
  direction: 'asc' | 'desc';
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export interface SearchState {
  query: string;
  filters: FilterOptions;
  sort: SortOption;
  pagination: PaginationState;
}

export interface NotificationItem {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

export interface ThemeConfig {
  mode: 'light' | 'dark';
  primaryColor: string;
  accentColor: string;
}

export interface UserPreferences {
  theme: ThemeConfig;
  notifications: {
    email: boolean;
    push: boolean;
    inApp: boolean;
  };
  dashboard: {
    layout: string;
    widgets: string[];
  };
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// Chart and visualization types
export interface ChartDataPoint {
  x: string | number;
  y: number;
  label?: string;
  category?: string;
}

export interface RiskVisualizationData {
  stakeholderId: string;
  stakeholderName: string;
  riskLevel: number;
  category: string;
  lastAssessment: string;
  trends: ChartDataPoint[];
}

export interface TimelineEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  type: 'task' | 'communication' | 'document' | 'risk_event';
  status: string;
  stakeholders: string[];
  priority?: string;
}