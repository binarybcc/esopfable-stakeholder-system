// Stakeholder types and role definitions for external portal
export enum StakeholderRole {
  ESOP_PARTICIPANT = 'esop_participant',
  GOVERNMENT_ENTITY = 'government_entity', 
  MEDIA_CONTACT = 'media_contact',
  KEY_WITNESS = 'key_witness',
  OPPOSITION = 'opposition',
  PUBLIC = 'public'
}

export interface StakeholderUser {
  id: string;
  email: string;
  name: string;
  role: StakeholderRole;
  organization?: string;
  permissions: Permission[];
  isActive: boolean;
  lastLogin?: Date;
  preferredLanguage: string;
  accessRestrictions?: AccessRestriction[];
  securityClearance?: SecurityClearance;
}

export interface Permission {
  resource: string;
  actions: string[];
  conditions?: Record<string, any>;
}

export interface AccessRestriction {
  type: 'field' | 'document' | 'feature';
  target: string;
  reason: string;
  expiresAt?: Date;
}

export interface SecurityClearance {
  level: 'public' | 'restricted' | 'confidential' | 'secret';
  grantedBy: string;
  grantedAt: Date;
  expiresAt?: Date;
}

export interface StakeholderDashboard {
  role: StakeholderRole;
  allowedSections: DashboardSection[];
  restrictions: string[];
  customizations?: Record<string, any>;
}

export enum DashboardSection {
  CASE_UPDATES = 'case_updates',
  COMMUNICATIONS = 'communications', 
  DOCUMENT_ACCESS = 'document_access',
  EVIDENCE_SUBMISSION = 'evidence_submission',
  PROGRESS_TRACKING = 'progress_tracking',
  COORDINATION = 'coordination',
  PRESS_RELEASES = 'press_releases',
  PROTECTION_STATUS = 'protection_status',
  PUBLIC_INFO = 'public_info',
  GROUP_MESSAGING = 'group_messaging'
}

// Content filtering types
export interface ContentFilter {
  role: StakeholderRole;
  allowedFields: string[];
  hiddenFields: string[];
  maskedFields: MaskedField[];
  watermarkRequired: boolean;
}

export interface MaskedField {
  field: string;
  maskType: 'partial' | 'redacted' | 'summarized';
  maskPattern?: string;
}

// Communication types
export interface SecureMessage {
  id: string;
  fromUserId: string;
  toUserIds: string[];
  subject: string;
  content: string;
  encryptionLevel: 'standard' | 'high' | 'maximum';
  readReceipts: ReadReceipt[];
  attachments?: SecureAttachment[];
  createdAt: Date;
  expiresAt?: Date;
}

export interface ReadReceipt {
  userId: string;
  readAt: Date;
  ipAddress?: string;
}

export interface SecureAttachment {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  encryptionKey: string;
  watermarkApplied: boolean;
  accessLog: AccessLogEntry[];
}

export interface AccessLogEntry {
  userId: string;
  action: 'view' | 'download' | 'print' | 'share';
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  failureReason?: string;
}

// Task and progress tracking
export interface StakeholderTask {
  id: string;
  title: string;
  description: string;
  assignedTo: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: Date;
  createdAt: Date;
  completedAt?: Date;
  visibleToRoles: StakeholderRole[];
  tags: string[];
}

export interface ProgressUpdate {
  id: string;
  caseId: string;
  title: string;
  summary: string;
  details: string;
  visibilityLevel: SecurityClearance['level'];
  visibleToRoles: StakeholderRole[];
  createdAt: Date;
  createdBy: string;
  attachments?: string[];
}