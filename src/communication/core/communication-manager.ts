import { EventEmitter } from 'events';
import { CommunicationChannel } from './types';
import { PrivilegeManager } from '../security/privilege-manager';
import { DiscoveryEngine } from '../discovery/discovery-engine';
import { MonitoringService } from '../monitoring/monitoring-service';
import { Database } from '../storage/database';

/**
 * Core Communication Manager
 * Handles all communication tracking and coordination across channels
 */
export class CommunicationManager extends EventEmitter {
  private channels: Map<string, CommunicationChannel> = new Map();
  private privilegeManager: PrivilegeManager;
  private discoveryEngine: DiscoveryEngine;
  private monitoringService: MonitoringService;
  private database: Database;

  constructor(config: CommunicationManagerConfig) {
    super();
    this.privilegeManager = new PrivilegeManager(config.privilege);
    this.discoveryEngine = new DiscoveryEngine(config.discovery);
    this.monitoringService = new MonitoringService(config.monitoring);
    this.database = new Database(config.database);
    
    this.initializeChannels();
    this.setupEventHandlers();
  }

  /**
   * Register a communication channel
   */
  registerChannel(type: string, channel: CommunicationChannel): void {
    this.channels.set(type, channel);
    channel.on('communication', this.handleCommunication.bind(this));
    channel.on('error', this.handleChannelError.bind(this));
  }

  /**
   * Log communication from any channel
   */
  async logCommunication(communication: CommunicationRecord): Promise<string> {
    try {
      // Apply privilege protection
      const protectedComm = await this.privilegeManager.applyProtection(communication);
      
      // Store in database
      const commId = await this.database.storeCommunication(protectedComm);
      
      // Index for discovery
      await this.discoveryEngine.indexCommunication(protectedComm, commId);
      
      // Check for monitoring alerts
      await this.monitoringService.processCommunication(protectedComm);
      
      // Emit event for real-time updates
      this.emit('communication-logged', { id: commId, communication: protectedComm });
      
      return commId;
    } catch (error) {
      this.handleError('Failed to log communication', error);
      throw error;
    }
  }

  /**
   * Search communications across all channels
   */
  async searchCommunications(query: SearchQuery): Promise<SearchResults> {
    return await this.discoveryEngine.search(query);
  }

  /**
   * Get communication timeline for case
   */
  async getCommunicationTimeline(caseId: string, options?: TimelineOptions): Promise<TimelineEntry[]> {
    return await this.discoveryEngine.getTimeline(caseId, options);
  }

  /**
   * Export communications for legal discovery
   */
  async exportForDiscovery(request: DiscoveryRequest): Promise<ExportResult> {
    return await this.discoveryEngine.exportForDiscovery(request);
  }

  /**
   * Start real-time monitoring
   */
  startMonitoring(caseId: string, rules: MonitoringRules): void {
    this.monitoringService.startMonitoring(caseId, rules);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(caseId: string): void {
    this.monitoringService.stopMonitoring(caseId);
  }

  private async handleCommunication(data: CommunicationData): Promise<void> {
    try {
      const communication: CommunicationRecord = {
        id: this.generateId(),
        type: data.type,
        timestamp: new Date(),
        caseId: data.caseId,
        participants: data.participants,
        content: data.content,
        metadata: data.metadata,
        attachments: data.attachments || [],
        classification: await this.classifyCommunication(data),
        privilegeStatus: 'pending'
      };

      await this.logCommunication(communication);
    } catch (error) {
      this.handleError('Error handling communication', error);
    }
  }

  private async classifyCommunication(data: CommunicationData): Promise<CommunicationClassification> {
    // AI-powered classification logic
    return {
      sensitivity: 'medium',
      category: data.type,
      requiresReview: this.requiresLegalReview(data),
      tags: await this.extractTags(data)
    };
  }

  private requiresLegalReview(data: CommunicationData): boolean {
    // Check for attorney-client privilege indicators
    const sensitiveKeywords = ['attorney', 'lawyer', 'confidential', 'privileged'];
    const content = data.content.toLowerCase();
    return sensitiveKeywords.some(keyword => content.includes(keyword));
  }

  private async extractTags(data: CommunicationData): Promise<string[]> {
    // Extract relevant tags from communication content
    return [];
  }

  private generateId(): string {
    return `comm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeChannels(): void {
    // Initialize all communication channels
  }

  private setupEventHandlers(): void {
    this.on('communication-logged', this.handleCommunicationLogged.bind(this));
  }

  private handleCommunicationLogged(event: any): void {
    // Handle post-logging activities
  }

  private handleChannelError(error: Error): void {
    this.handleError('Channel error', error);
  }

  private handleError(message: string, error: any): void {
    console.error(`Communication Manager: ${message}`, error);
    this.emit('error', { message, error });
  }
}

export interface CommunicationManagerConfig {
  privilege: PrivilegeManagerConfig;
  discovery: DiscoveryEngineConfig;
  monitoring: MonitoringServiceConfig;
  database: DatabaseConfig;
}

export interface CommunicationRecord {
  id: string;
  type: CommunicationType;
  timestamp: Date;
  caseId: string;
  participants: Participant[];
  content: CommunicationContent;
  metadata: CommunicationMetadata;
  attachments: Attachment[];
  classification: CommunicationClassification;
  privilegeStatus: PrivilegeStatus;
}

export interface CommunicationData {
  type: CommunicationType;
  caseId: string;
  participants: Participant[];
  content: CommunicationContent;
  metadata: CommunicationMetadata;
  attachments?: Attachment[];
}

export interface CommunicationContent {
  subject?: string;
  body: string;
  format: ContentFormat;
  language?: string;
}

export interface CommunicationMetadata {
  channel: string;
  direction: 'inbound' | 'outbound' | 'internal';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'draft' | 'sent' | 'delivered' | 'read' | 'failed';
  threadId?: string;
  replyTo?: string;
  forwardedFrom?: string;
  location?: string;
  device?: string;
  ipAddress?: string;
}

export interface Participant {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: ParticipantRole;
  organization?: string;
  relationship: StakeholderRelationship;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  path: string;
  hash: string;
  scanResult?: SecurityScanResult;
}

export interface CommunicationClassification {
  sensitivity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  requiresReview: boolean;
  tags: string[];
  confidentialityLevel?: number;
}

export type CommunicationType = 'email' | 'call' | 'meeting' | 'letter' | 'sms' | 'chat' | 'video_call' | 'court_filing';
export type ContentFormat = 'text' | 'html' | 'markdown' | 'rtf' | 'pdf';
export type ParticipantRole = 'client' | 'attorney' | 'witness' | 'expert' | 'court' | 'opposing_counsel' | 'third_party';
export type StakeholderRelationship = 'attorney_client' | 'work_product' | 'expert_witness' | 'opposing_party' | 'court' | 'vendor';
export type PrivilegeStatus = 'privileged' | 'work_product' | 'public' | 'confidential' | 'pending';

export interface SearchQuery {
  terms?: string;
  caseId?: string;
  participants?: string[];
  dateRange?: DateRange;
  communicationType?: CommunicationType[];
  privilegeStatus?: PrivilegeStatus[];
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface SearchResults {
  communications: CommunicationRecord[];
  total: number;
  facets: SearchFacets;
}

export interface TimelineEntry {
  communication: CommunicationRecord;
  relatedCommunications: string[];
  context: TimelineContext;
}

export interface DiscoveryRequest {
  caseId: string;
  dateRange: DateRange;
  participants?: string[];
  keywords?: string[];
  privilegeFilter: 'include_privileged' | 'exclude_privileged' | 'privileged_only';
  format: 'native' | 'pdf' | 'load_file';
}

export interface ExportResult {
  exportId: string;
  files: string[];
  metadata: ExportMetadata;
}