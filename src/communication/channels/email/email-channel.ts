import { CommunicationChannel, ChannelConfig, CommunicationData, OutboundCommunication, ChannelQuery } from '../../core/types';
import { EmailParser } from './email-parser';
import { EmailProvider } from './providers/email-provider';
import { ImapProvider } from './providers/imap-provider';
import { ExchangeProvider } from './providers/exchange-provider';
import { GmailProvider } from './providers/gmail-provider';
import { EventEmitter } from 'events';

/**
 * Email Communication Channel
 * Handles email integration, parsing, and monitoring
 */
export class EmailChannel extends EventEmitter implements CommunicationChannel {
  readonly type = 'email';
  readonly name = 'Email Channel';
  
  private config: ChannelConfig;
  private parser: EmailParser;
  private providers: Map<string, EmailProvider> = new Map();
  private activeProvider: EmailProvider | null = null;
  private isRunning = false;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.parser = new EmailParser();
  }

  async initialize(config: ChannelConfig): Promise<void> {
    this.config = config;
    
    // Initialize email providers based on configuration
    if (config.settings.imap) {
      this.providers.set('imap', new ImapProvider(config.settings.imap));
    }
    
    if (config.settings.exchange) {
      this.providers.set('exchange', new ExchangeProvider(config.settings.exchange));
    }
    
    if (config.settings.gmail) {
      this.providers.set('gmail', new GmailProvider(config.settings.gmail));
    }

    // Select active provider
    const primaryProvider = config.settings.primaryProvider || 'imap';
    this.activeProvider = this.providers.get(primaryProvider) || null;
    
    if (!this.activeProvider) {
      throw new Error(`No email provider configured for type: ${primaryProvider}`);
    }

    await this.activeProvider.initialize();
    this.setupEventHandlers();
  }

  async start(): Promise<void> {
    if (this.isRunning || !this.activeProvider) {
      return;
    }

    try {
      await this.activeProvider.connect();
      this.isRunning = true;
      
      // Start real-time monitoring if supported
      if (this.activeProvider.supportsRealTime()) {
        await this.startRealTimeMonitoring();
      } else {
        // Fallback to polling
        this.startPolling();
      }
      
      this.emit('started');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = null;
      }

      if (this.activeProvider) {
        await this.activeProvider.disconnect();
      }

      this.isRunning = false;
      this.emit('stopped');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  isActive(): boolean {
    return this.isRunning;
  }

  async sendCommunication(communication: OutboundCommunication): Promise<string> {
    if (!this.activeProvider) {
      throw new Error('No active email provider');
    }

    return await this.activeProvider.sendEmail(communication);
  }

  async retrieveCommunications(query: ChannelQuery): Promise<CommunicationData[]> {
    if (!this.activeProvider) {
      throw new Error('No active email provider');
    }

    const emails = await this.activeProvider.retrieveEmails(query);
    const communications: CommunicationData[] = [];

    for (const email of emails) {
      try {
        const parsedEmail = await this.parser.parseEmail(email);
        const communication = this.convertToComminicationData(parsedEmail);
        communications.push(communication);
      } catch (error) {
        console.error('Error parsing email:', error);
        this.emit('parse-error', { email, error });
      }
    }

    return communications;
  }

  /**
   * Sync emails from a specific date range
   */
  async syncEmails(startDate: Date, endDate?: Date): Promise<void> {
    const query: ChannelQuery = {
      dateRange: {
        start: startDate,
        end: endDate || new Date()
      }
    };

    try {
      const communications = await this.retrieveCommunications(query);
      
      for (const communication of communications) {
        this.emit('communication', communication);
      }
    } catch (error) {
      console.error('Error syncing emails:', error);
      this.emit('error', error);
    }
  }

  /**
   * Get email thread by thread ID
   */
  async getEmailThread(threadId: string): Promise<CommunicationData[]> {
    if (!this.activeProvider) {
      throw new Error('No active email provider');
    }

    const emails = await this.activeProvider.getEmailThread(threadId);
    const communications: CommunicationData[] = [];

    for (const email of emails) {
      try {
        const parsedEmail = await this.parser.parseEmail(email);
        const communication = this.convertToComminicationData(parsedEmail);
        communications.push(communication);
      } catch (error) {
        console.error('Error parsing thread email:', error);
        this.emit('parse-error', { email, error });
      }
    }

    return communications.sort((a, b) => 
      new Date(a.metadata.timestamp).getTime() - new Date(b.metadata.timestamp).getTime()
    );
  }

  private async startRealTimeMonitoring(): Promise<void> {
    if (!this.activeProvider) return;

    this.activeProvider.on('new-email', async (email) => {
      try {
        const parsedEmail = await this.parser.parseEmail(email);
        const communication = this.convertToComminicationData(parsedEmail);
        this.emit('communication', communication);
      } catch (error) {
        console.error('Error processing new email:', error);
        this.emit('parse-error', { email, error });
      }
    });

    await this.activeProvider.startRealTimeMonitoring();
  }

  private startPolling(): void {
    const pollInterval = this.config.settings.pollInterval || 60000; // 1 minute default
    
    this.syncInterval = setInterval(async () => {
      try {
        // Sync emails from the last poll interval
        const startDate = new Date(Date.now() - pollInterval * 2); // Small overlap
        await this.syncEmails(startDate);
      } catch (error) {
        console.error('Error during email polling:', error);
        this.emit('error', error);
      }
    }, pollInterval);
  }

  private convertToComminicationData(parsedEmail: ParsedEmail): CommunicationData {
    return {
      type: 'email',
      caseId: this.extractCaseId(parsedEmail),
      participants: parsedEmail.participants,
      content: {
        subject: parsedEmail.subject,
        body: parsedEmail.body.text,
        format: parsedEmail.body.html ? 'html' : 'text'
      },
      metadata: {
        channel: 'email',
        direction: this.determineDirection(parsedEmail),
        priority: this.mapPriority(parsedEmail.priority),
        status: 'delivered',
        threadId: parsedEmail.threadId,
        replyTo: parsedEmail.replyTo,
        forwardedFrom: parsedEmail.forwardedFrom,
        timestamp: parsedEmail.date,
        messageId: parsedEmail.messageId,
        headers: parsedEmail.headers
      },
      attachments: parsedEmail.attachments,
      rawData: parsedEmail.raw
    };
  }

  private extractCaseId(parsedEmail: ParsedEmail): string {
    // Try to extract case ID from subject, body, or custom headers
    const subjectMatch = parsedEmail.subject?.match(/\[CASE[:-]\s*([^\]]+)\]/i);
    if (subjectMatch) {
      return subjectMatch[1].trim();
    }

    // Check custom headers
    const caseHeader = parsedEmail.headers['X-Case-ID'] || parsedEmail.headers['x-case-id'];
    if (caseHeader) {
      return caseHeader;
    }

    // Default fallback - this would need to be handled by the application
    return 'unknown';
  }

  private determineDirection(parsedEmail: ParsedEmail): 'inbound' | 'outbound' | 'internal' {
    const configuredDomains = this.config.settings.internalDomains || [];
    const senderDomain = parsedEmail.from.email.split('@')[1];
    
    if (configuredDomains.includes(senderDomain)) {
      return 'outbound';
    }
    
    return 'inbound';
  }

  private mapPriority(emailPriority?: string): 'low' | 'normal' | 'high' | 'urgent' {
    if (!emailPriority) return 'normal';
    
    const priority = emailPriority.toLowerCase();
    if (priority.includes('high') || priority.includes('urgent')) return 'urgent';
    if (priority.includes('low')) return 'low';
    return 'normal';
  }

  private setupEventHandlers(): void {
    if (this.activeProvider) {
      this.activeProvider.on('error', (error) => {
        this.emit('error', error);
      });

      this.activeProvider.on('connected', () => {
        this.emit('provider-connected');
      });

      this.activeProvider.on('disconnected', () => {
        this.emit('provider-disconnected');
      });
    }
  }
}

export interface ParsedEmail {
  messageId: string;
  threadId?: string;
  subject?: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  replyTo?: string;
  forwardedFrom?: string;
  date: Date;
  body: EmailBody;
  attachments: EmailAttachment[];
  headers: Record<string, string>;
  priority?: string;
  participants: EmailParticipant[];
  raw?: any;
}

export interface EmailAddress {
  name?: string;
  email: string;
}

export interface EmailBody {
  text: string;
  html?: string;
}

export interface EmailAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  path: string;
  hash: string;
}

export interface EmailParticipant {
  id: string;
  name: string;
  email: string;
  role: 'sender' | 'recipient' | 'cc' | 'bcc';
  organization?: string;
  relationship: string;
}