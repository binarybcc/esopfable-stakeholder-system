import { EventEmitter } from 'events';

/**
 * Base interface for all communication channels
 */
export interface CommunicationChannel extends EventEmitter {
  readonly type: string;
  readonly name: string;
  
  initialize(config: ChannelConfig): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  isActive(): boolean;
  
  // Channel-specific methods
  sendCommunication?(communication: OutboundCommunication): Promise<string>;
  retrieveCommunications?(query: ChannelQuery): Promise<CommunicationData[]>;
}

export interface ChannelConfig {
  enabled: boolean;
  settings: Record<string, any>;
  security: SecurityConfig;
  monitoring: boolean;
}

export interface SecurityConfig {
  encryption: boolean;
  authentication: AuthConfig;
  accessControl: AccessControlConfig;
}

export interface AuthConfig {
  type: 'oauth2' | 'basic' | 'api_key' | 'certificate';
  credentials: Record<string, string>;
}

export interface AccessControlConfig {
  allowedUsers: string[];
  blockedUsers: string[];
  permissions: Permission[];
}

export interface Permission {
  action: 'read' | 'write' | 'delete' | 'admin';
  resource: string;
  conditions?: Record<string, any>;
}

export interface OutboundCommunication {
  recipients: Recipient[];
  subject?: string;
  content: CommunicationContent;
  attachments?: Attachment[];
  priority: Priority;
  scheduledFor?: Date;
  metadata: OutboundMetadata;
}

export interface Recipient {
  address: string; // email, phone, etc.
  name?: string;
  type: RecipientType;
}

export interface OutboundMetadata {
  caseId: string;
  templateId?: string;
  tracking: boolean;
  requireDeliveryReceipt: boolean;
  requireReadReceipt: boolean;
}

export interface ChannelQuery {
  dateRange?: DateRange;
  senders?: string[];
  recipients?: string[];
  keywords?: string[];
  limit?: number;
  offset?: number;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface CommunicationData {
  id?: string;
  type: CommunicationType;
  caseId: string;
  participants: Participant[];
  content: CommunicationContent;
  metadata: CommunicationMetadata;
  attachments?: Attachment[];
  rawData?: any; // Original data from the channel
}

export interface SecurityScanResult {
  safe: boolean;
  threats: ThreatInfo[];
  scanDate: Date;
  scanEngine: string;
}

export interface ThreatInfo {
  type: 'virus' | 'malware' | 'phishing' | 'suspicious';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  action: 'quarantine' | 'block' | 'warn' | 'allow';
}

export interface SearchFacets {
  types: FacetCount[];
  participants: FacetCount[];
  dates: DateFacet[];
  tags: FacetCount[];
  privilegeStatus: FacetCount[];
}

export interface FacetCount {
  value: string;
  count: number;
}

export interface DateFacet {
  period: string; // 'day', 'week', 'month', 'year'
  date: Date;
  count: number;
}

export interface TimelineContext {
  summary: string;
  keyParticipants: string[];
  relatedEvents: string[];
  importance: 'low' | 'medium' | 'high' | 'critical';
}

export interface ExportMetadata {
  totalCommunications: number;
  dateRange: DateRange;
  exportDate: Date;
  format: string;
  hash: string;
  privilegeLog: PrivilegeLogEntry[];
}

export interface PrivilegeLogEntry {
  communicationId: string;
  status: PrivilegeStatus;
  reason: string;
  reviewedBy: string;
  reviewDate: Date;
}

export interface MonitoringRules {
  keywords: KeywordRule[];
  participants: ParticipantRule[];
  patterns: PatternRule[];
  volume: VolumeRule[];
  sentiment: SentimentRule[];
}

export interface KeywordRule {
  keywords: string[];
  severity: AlertSeverity;
  action: AlertAction;
  context?: string;
}

export interface ParticipantRule {
  participants: string[];
  action: AlertAction;
  condition: 'any' | 'all' | 'exclude';
}

export interface PatternRule {
  pattern: RegExp;
  description: string;
  severity: AlertSeverity;
  action: AlertAction;
}

export interface VolumeRule {
  threshold: number;
  timeWindow: number; // minutes
  action: AlertAction;
}

export interface SentimentRule {
  threshold: number; // -1 to 1
  direction: 'positive' | 'negative';
  action: AlertAction;
}

export interface MonitoringAlert {
  id: string;
  timestamp: Date;
  caseId: string;
  communicationId: string;
  rule: string;
  severity: AlertSeverity;
  message: string;
  participants: string[];
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export type CommunicationType = 'email' | 'call' | 'meeting' | 'letter' | 'sms' | 'chat' | 'video_call' | 'court_filing' | 'voicemail' | 'fax';
export type RecipientType = 'to' | 'cc' | 'bcc';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
export type AlertAction = 'log' | 'notify' | 'block' | 'escalate';

// Database interfaces
export interface DatabaseConfig {
  connection: DatabaseConnection;
  encryption: EncryptionConfig;
  backup: BackupConfig;
}

export interface DatabaseConnection {
  type: 'postgresql' | 'mysql' | 'mongodb' | 'sqlite';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  pool?: PoolConfig;
}

export interface PoolConfig {
  min: number;
  max: number;
  idleTimeoutMillis: number;
}

export interface EncryptionConfig {
  enabled: boolean;
  algorithm: string;
  keyRotation: boolean;
  keyRotationInterval: number; // days
}

export interface BackupConfig {
  enabled: boolean;
  schedule: string; // cron expression
  retention: number; // days
  compression: boolean;
}

// Discovery and search interfaces
export interface DiscoveryEngineConfig {
  indexing: IndexingConfig;
  search: SearchConfig;
  export: ExportConfig;
}

export interface IndexingConfig {
  enabled: boolean;
  realTime: boolean;
  batchSize: number;
  contentExtraction: boolean;
  ocrEnabled: boolean;
}

export interface SearchConfig {
  maxResults: number;
  highlightEnabled: boolean;
  fuzzySearch: boolean;
  stemming: boolean;
  synonyms: boolean;
}

export interface ExportConfig {
  formats: string[];
  maxFileSize: number; // MB
  compressionEnabled: boolean;
  watermarking: boolean;
}

// Monitoring interfaces
export interface MonitoringServiceConfig {
  enabled: boolean;
  realTime: boolean;
  alerting: AlertingConfig;
  reporting: ReportingConfig;
}

export interface AlertingConfig {
  channels: AlertChannel[];
  escalation: EscalationConfig;
  throttling: ThrottlingConfig;
}

export interface AlertChannel {
  type: 'email' | 'sms' | 'webhook' | 'dashboard';
  config: Record<string, any>;
  severity: AlertSeverity[];
}

export interface EscalationConfig {
  enabled: boolean;
  timeouts: EscalationTimeout[];
}

export interface EscalationTimeout {
  severity: AlertSeverity;
  timeout: number; // minutes
  escalateTo: string[];
}

export interface ThrottlingConfig {
  enabled: boolean;
  maxAlerts: number;
  timeWindow: number; // minutes
}

export interface ReportingConfig {
  enabled: boolean;
  schedule: string; // cron expression
  recipients: string[];
  format: 'html' | 'pdf' | 'json';
}

// Privilege management interfaces
export interface PrivilegeManagerConfig {
  rules: PrivilegeRule[];
  reviewWorkflow: ReviewWorkflowConfig;
  redaction: RedactionConfig;
}

export interface PrivilegeRule {
  id: string;
  name: string;
  conditions: PrivilegeCondition[];
  action: PrivilegeAction;
  priority: number;
}

export interface PrivilegeCondition {
  type: 'participant' | 'content' | 'metadata';
  field: string;
  operator: 'equals' | 'contains' | 'matches' | 'exists';
  value: any;
}

export interface PrivilegeAction {
  status: PrivilegeStatus;
  requiresReview: boolean;
  redact: boolean;
  log: boolean;
}

export interface ReviewWorkflowConfig {
  enabled: boolean;
  reviewers: string[];
  timeout: number; // hours
  escalation: boolean;
}

export interface RedactionConfig {
  enabled: boolean;
  marker: string;
  preserveFormat: boolean;
  logRedactions: boolean;
}

export interface TimelineOptions {
  groupBy?: 'day' | 'week' | 'month';
  includeContext?: boolean;
  maxEntries?: number;
  participantFilter?: string[];
}