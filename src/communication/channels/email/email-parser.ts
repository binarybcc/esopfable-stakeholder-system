import * as mailparser from 'mailparser';
import { ParsedEmail, EmailAddress, EmailBody, EmailAttachment, EmailParticipant } from './email-channel';
import { createHash } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

/**
 * Email Parser
 * Parses raw email data into structured format
 */
export class EmailParser {
  private attachmentStoragePath: string;

  constructor(attachmentStoragePath = './storage/attachments') {
    this.attachmentStoragePath = attachmentStoragePath;
    this.ensureStorageDirectory();
  }

  /**
   * Parse raw email data into ParsedEmail structure
   */
  async parseEmail(rawEmail: any): Promise<ParsedEmail> {
    try {
      let parsed: mailparser.ParsedMail;

      if (typeof rawEmail === 'string') {
        parsed = await mailparser.simpleParser(rawEmail);
      } else if (Buffer.isBuffer(rawEmail)) {
        parsed = await mailparser.simpleParser(rawEmail);
      } else if (rawEmail.raw) {
        parsed = await mailparser.simpleParser(rawEmail.raw);
      } else {
        // Assume it's already parsed or in a structured format
        parsed = rawEmail as mailparser.ParsedMail;
      }

      const messageId = this.extractMessageId(parsed);
      const threadId = this.extractThreadId(parsed);
      const attachments = await this.processAttachments(parsed.attachments || [], messageId);
      const participants = this.extractParticipants(parsed);

      const parsedEmail: ParsedEmail = {
        messageId,
        threadId,
        subject: parsed.subject,
        from: this.parseAddress(parsed.from as mailparser.AddressObject),
        to: this.parseAddresses(parsed.to as mailparser.AddressObject | mailparser.AddressObject[]),
        cc: this.parseAddresses(parsed.cc as mailparser.AddressObject | mailparser.AddressObject[]),
        bcc: this.parseAddresses(parsed.bcc as mailparser.AddressObject | mailparser.AddressObject[]),
        replyTo: this.extractReplyTo(parsed),
        forwardedFrom: this.extractForwardedFrom(parsed),
        date: parsed.date || new Date(),
        body: this.extractBody(parsed),
        attachments,
        headers: this.extractHeaders(parsed),
        priority: this.extractPriority(parsed),
        participants,
        raw: rawEmail
      };

      return parsedEmail;
    } catch (error) {
      console.error('Error parsing email:', error);
      throw new Error(`Failed to parse email: ${error.message}`);
    }
  }

  private extractMessageId(parsed: mailparser.ParsedMail): string {
    return parsed.messageId || `generated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractThreadId(parsed: mailparser.ParsedMail): string | undefined {
    // Try various thread identification methods
    const headers = parsed.headers as Map<string, any>;
    
    // Microsoft Exchange thread ID
    let threadId = headers.get('thread-id') || headers.get('thread-index');
    
    // Gmail thread ID
    if (!threadId) {
      threadId = headers.get('x-gm-thrid');
    }
    
    // References header (standard)
    if (!threadId) {
      const references = headers.get('references');
      if (references) {
        // Use the first message ID from references as thread ID
        const refIds = references.split(/\s+/).filter(id => id.trim());
        threadId = refIds[0];
      }
    }
    
    // In-Reply-To header
    if (!threadId) {
      threadId = headers.get('in-reply-to');
    }
    
    // Fallback to subject-based threading
    if (!threadId && parsed.subject) {
      const cleanSubject = parsed.subject.replace(/^(re:|fwd?:|fw:)\s*/i, '').trim();
      threadId = `subject_${this.generateHash(cleanSubject)}`;
    }

    return threadId;
  }

  private parseAddress(address: mailparser.AddressObject | undefined): EmailAddress {
    if (!address) {
      return { email: 'unknown@unknown.com' };
    }

    if (Array.isArray(address.value)) {
      const firstAddress = address.value[0];
      return {
        name: firstAddress.name,
        email: firstAddress.address
      };
    }

    return {
      name: address.name,
      email: address.address || 'unknown@unknown.com'
    };
  }

  private parseAddresses(addresses: mailparser.AddressObject | mailparser.AddressObject[] | undefined): EmailAddress[] {
    if (!addresses) return [];

    const addressList: mailparser.AddressObject[] = Array.isArray(addresses) ? addresses : [addresses];
    const result: EmailAddress[] = [];

    for (const addr of addressList) {
      if (Array.isArray(addr.value)) {
        for (const value of addr.value) {
          result.push({
            name: value.name,
            email: value.address
          });
        }
      } else {
        result.push({
          name: addr.name,
          email: addr.address || 'unknown@unknown.com'
        });
      }
    }

    return result;
  }

  private extractBody(parsed: mailparser.ParsedMail): EmailBody {
    return {
      text: parsed.text || '',
      html: parsed.html as string
    };
  }

  private extractHeaders(parsed: mailparser.ParsedMail): Record<string, string> {
    const headers: Record<string, string> = {};
    const headerMap = parsed.headers as Map<string, any>;

    for (const [key, value] of headerMap.entries()) {
      headers[key] = String(value);
    }

    return headers;
  }

  private extractPriority(parsed: mailparser.ParsedMail): string | undefined {
    const headers = parsed.headers as Map<string, any>;
    
    // Check various priority headers
    const priority = headers.get('x-priority') || 
                    headers.get('priority') || 
                    headers.get('importance') ||
                    headers.get('x-msmail-priority');

    return priority ? String(priority) : undefined;
  }

  private extractReplyTo(parsed: mailparser.ParsedMail): string | undefined {
    const headers = parsed.headers as Map<string, any>;
    return headers.get('in-reply-to');
  }

  private extractForwardedFrom(parsed: mailparser.ParsedMail): string | undefined {
    // Check for forwarded indicators in subject or headers
    if (parsed.subject && /^fwd?:/i.test(parsed.subject)) {
      // Try to extract original message ID from forwarded content
      const text = parsed.text || '';
      const forwardedMatch = text.match(/message-id:\s*([^\s\n]+)/i);
      return forwardedMatch ? forwardedMatch[1] : 'forwarded';
    }
    return undefined;
  }

  private async processAttachments(
    attachments: mailparser.Attachment[], 
    messageId: string
  ): Promise<EmailAttachment[]> {
    const processedAttachments: EmailAttachment[] = [];

    for (let i = 0; i < attachments.length; i++) {
      const attachment = attachments[i];
      
      try {
        const attachmentId = `${messageId}_att_${i}`;
        const hash = this.generateHash(attachment.content);
        const sanitizedFilename = this.sanitizeFilename(attachment.filename || `attachment_${i}`);
        const storagePath = path.join(this.attachmentStoragePath, attachmentId, sanitizedFilename);

        // Ensure directory exists
        await mkdir(path.dirname(storagePath), { recursive: true });
        
        // Save attachment to secure storage
        await writeFile(storagePath, attachment.content);

        processedAttachments.push({
          id: attachmentId,
          name: sanitizedFilename,
          type: attachment.contentType || 'application/octet-stream',
          size: attachment.size || attachment.content.length,
          path: storagePath,
          hash
        });
      } catch (error) {
        console.error(`Error processing attachment ${i} for message ${messageId}:`, error);
        // Continue with other attachments
      }
    }

    return processedAttachments;
  }

  private extractParticipants(parsed: mailparser.ParsedMail): EmailParticipant[] {
    const participants: EmailParticipant[] = [];

    // Add sender
    const from = this.parseAddress(parsed.from as mailparser.AddressObject);
    participants.push({
      id: this.generateParticipantId(from.email),
      name: from.name || from.email.split('@')[0],
      email: from.email,
      role: 'sender',
      relationship: 'unknown' // This would be determined by the system
    });

    // Add recipients
    const toAddresses = this.parseAddresses(parsed.to as mailparser.AddressObject | mailparser.AddressObject[]);
    for (const address of toAddresses) {
      participants.push({
        id: this.generateParticipantId(address.email),
        name: address.name || address.email.split('@')[0],
        email: address.email,
        role: 'recipient',
        relationship: 'unknown'
      });
    }

    // Add CC recipients
    const ccAddresses = this.parseAddresses(parsed.cc as mailparser.AddressObject | mailparser.AddressObject[]);
    for (const address of ccAddresses) {
      participants.push({
        id: this.generateParticipantId(address.email),
        name: address.name || address.email.split('@')[0],
        email: address.email,
        role: 'cc',
        relationship: 'unknown'
      });
    }

    // Add BCC recipients
    const bccAddresses = this.parseAddresses(parsed.bcc as mailparser.AddressObject | mailparser.AddressObject[]);
    for (const address of bccAddresses) {
      participants.push({
        id: this.generateParticipantId(address.email),
        name: address.name || address.email.split('@')[0],
        email: address.email,
        role: 'bcc',
        relationship: 'unknown'
      });
    }

    return participants;
  }

  private generateHash(content: Buffer | string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private generateParticipantId(email: string): string {
    return this.generateHash(email.toLowerCase());
  }

  private sanitizeFilename(filename: string): string {
    // Remove or replace dangerous characters
    return filename
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 255); // Limit length
  }

  private async ensureStorageDirectory(): Promise<void> {
    try {
      await mkdir(this.attachmentStoragePath, { recursive: true });
    } catch (error) {
      console.error('Error creating attachment storage directory:', error);
    }
  }

  /**
   * Extract plain text from HTML content
   */
  extractTextFromHtml(html: string): string {
    // Basic HTML to text conversion
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Validate email structure
   */
  validateEmail(parsedEmail: ParsedEmail): boolean {
    if (!parsedEmail.messageId) return false;
    if (!parsedEmail.from || !parsedEmail.from.email) return false;
    if (!parsedEmail.date) return false;
    
    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(parsedEmail.from.email)) return false;
    
    for (const participant of parsedEmail.participants) {
      if (!emailRegex.test(participant.email)) return false;
    }

    return true;
  }
}