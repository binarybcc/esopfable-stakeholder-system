/**
 * Secure File Transmission Service
 * End-to-end encryption for file transfers and secure communication channels
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const WebSocket = require('ws');
const { EventEmitter } = require('events');
const { auditLogger } = require('../../services/audit-service');
const { documentEncryption } = require('../encryption/document-encryption');

class SecureTransmission extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      algorithm: 'aes-256-gcm',
      keySize: 32,
      ivSize: 16,
      tagSize: 16,
      chunkSize: 64 * 1024, // 64KB chunks
      maxFileSize: 100 * 1024 * 1024, // 100MB
      connectionTimeout: 30000, // 30 seconds
      transferTimeout: 300000, // 5 minutes
      ...config
    };

    this.activeTransfers = new Map(); // transferId -> transfer state
    this.activeSessions = new Map(); // sessionId -> session data
  }

  /**
   * Initialize secure transmission session
   */
  async initializeSession(userId, recipientId, options = {}) {
    try {
      const sessionId = crypto.randomUUID();
      
      // Generate session key pair using Elliptic Curve Diffie-Hellman
      const ecdh = crypto.createECDH('secp256k1');
      const sessionPrivateKey = ecdh.generateKeys();
      const sessionPublicKey = ecdh.getPublicKey();

      // Create session
      const session = {
        id: sessionId,
        userId,
        recipientId,
        privateKey: sessionPrivateKey,
        publicKey: sessionPublicKey,
        sharedSecret: null, // Will be set after key exchange
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + (options.sessionTimeout || 3600000)), // 1 hour
        isActive: true,
        transferCount: 0,
        maxTransfers: options.maxTransfers || 100
      };

      this.activeSessions.set(sessionId, session);

      await auditLogger.log({
        action: 'secure_session_initialized',
        sessionId,
        userId,
        recipientId,
        expiresAt: session.expiresAt.toISOString(),
        timestamp: new Date().toISOString()
      });

      return {
        sessionId,
        publicKey: sessionPublicKey.toString('base64'),
        expiresAt: session.expiresAt.toISOString()
      };
    } catch (error) {
      console.error('Failed to initialize secure session:', error);
      throw new Error('Failed to initialize secure transmission session');
    }
  }

  /**
   * Complete key exchange with recipient's public key
   */
  async completeKeyExchange(sessionId, recipientPublicKey) {
    try {
      const session = this.activeSessions.get(sessionId);
      
      if (!session) {
        throw new Error('Session not found');
      }

      if (!session.isActive) {
        throw new Error('Session is not active');
      }

      // Create ECDH instance and compute shared secret
      const ecdh = crypto.createECDH('secp256k1');
      ecdh.setPrivateKey(session.privateKey);
      
      const recipientKey = Buffer.from(recipientPublicKey, 'base64');
      const sharedSecret = ecdh.computeSecret(recipientKey);

      // Derive encryption key from shared secret
      session.sharedSecret = crypto.pbkdf2Sync(sharedSecret, sessionId, 100000, 32, 'sha512');
      session.keyExchangeCompleted = true;

      await auditLogger.log({
        action: 'key_exchange_completed',
        sessionId,
        userId: session.userId,
        recipientId: session.recipientId,
        timestamp: new Date().toISOString()
      });

      return { success: true };
    } catch (error) {
      console.error('Key exchange failed:', error);
      throw new Error('Failed to complete key exchange');
    }
  }

  /**
   * Encrypt and transmit file securely
   */
  async transmitFile(sessionId, filePath, metadata = {}) {
    try {
      const session = this.activeSessions.get(sessionId);
      
      if (!session || !session.keyExchangeCompleted) {
        throw new Error('Session not ready for transmission');
      }

      if (session.transferCount >= session.maxTransfers) {
        throw new Error('Session transfer limit exceeded');
      }

      const transferId = crypto.randomUUID();
      const startTime = Date.now();

      // Read file
      const fileBuffer = await fs.readFile(filePath);
      const fileSize = fileBuffer.length;

      if (fileSize > this.config.maxFileSize) {
        throw new Error(`File size exceeds maximum allowed size of ${this.config.maxFileSize} bytes`);
      }

      // Create transfer state
      const transfer = {
        id: transferId,
        sessionId,
        filePath,
        fileName: metadata.fileName || require('path').basename(filePath),
        fileSize,
        classification: metadata.classification || 'internal',
        startTime,
        chunks: [],
        totalChunks: Math.ceil(fileSize / this.config.chunkSize),
        completedChunks: 0,
        status: 'encrypting'
      };

      this.activeTransfers.set(transferId, transfer);

      // Encrypt file with session key
      const encryptedFile = await this.encryptFileForTransmission(
        fileBuffer, 
        session.sharedSecret, 
        metadata
      );

      transfer.encryptedSize = encryptedFile.data.length;
      transfer.status = 'ready';

      // Split into chunks for transmission
      const chunks = this.splitIntoChunks(encryptedFile.data, this.config.chunkSize);
      transfer.chunks = chunks.map((chunk, index) => ({
        index,
        data: chunk,
        hash: crypto.createHash('sha256').update(chunk).digest('hex'),
        transmitted: false
      }));

      await auditLogger.log({
        action: 'file_transmission_prepared',
        transferId,
        sessionId,
        fileName: transfer.fileName,
        fileSize,
        encryptedSize: transfer.encryptedSize,
        totalChunks: transfer.totalChunks,
        classification: transfer.classification,
        timestamp: new Date().toISOString()
      });

      return {
        transferId,
        fileName: transfer.fileName,
        fileSize,
        encryptedSize: transfer.encryptedSize,
        totalChunks: transfer.totalChunks,
        metadata: encryptedFile.metadata
      };
    } catch (error) {
      console.error('File transmission preparation failed:', error);
      throw new Error(`Failed to prepare file transmission: ${error.message}`);
    }
  }

  /**
   * Get next chunk for transmission
   */
  async getNextChunk(transferId) {
    try {
      const transfer = this.activeTransfers.get(transferId);
      
      if (!transfer) {
        throw new Error('Transfer not found');
      }

      const nextChunk = transfer.chunks.find(chunk => !chunk.transmitted);
      
      if (!nextChunk) {
        transfer.status = 'completed';
        return null; // All chunks transmitted
      }

      nextChunk.transmitted = true;
      transfer.completedChunks++;

      // Calculate progress
      const progress = (transfer.completedChunks / transfer.totalChunks) * 100;

      return {
        transferId,
        chunkIndex: nextChunk.index,
        data: nextChunk.data.toString('base64'),
        hash: nextChunk.hash,
        isLastChunk: transfer.completedChunks === transfer.totalChunks,
        progress: Math.round(progress)
      };
    } catch (error) {
      console.error('Failed to get next chunk:', error);
      throw new Error('Failed to get transmission chunk');
    }
  }

  /**
   * Receive and decrypt transmitted file
   */
  async receiveFile(sessionId, transferMetadata, chunks) {
    try {
      const session = this.activeSessions.get(sessionId);
      
      if (!session || !session.keyExchangeCompleted) {
        throw new Error('Session not ready for reception');
      }

      const receiptId = crypto.randomUUID();
      const startTime = Date.now();

      // Validate chunks
      const sortedChunks = chunks.sort((a, b) => a.index - b.index);
      const reassembledData = Buffer.concat(
        sortedChunks.map(chunk => Buffer.from(chunk.data, 'base64'))
      );

      // Verify chunk integrity
      for (const chunk of sortedChunks) {
        const chunkData = Buffer.from(chunk.data, 'base64');
        const actualHash = crypto.createHash('sha256').update(chunkData).digest('hex');
        
        if (actualHash !== chunk.hash) {
          throw new Error(`Chunk ${chunk.index} integrity check failed`);
        }
      }

      // Decrypt file
      const decryptedFile = await this.decryptReceivedFile(
        reassembledData, 
        session.sharedSecret,
        transferMetadata
      );

      const completionTime = Date.now() - startTime;

      await auditLogger.log({
        action: 'file_reception_completed',
        receiptId,
        sessionId,
        fileName: transferMetadata.fileName,
        originalSize: decryptedFile.data.length,
        encryptedSize: reassembledData.length,
        chunks: chunks.length,
        receptionTime: completionTime,
        classification: transferMetadata.classification,
        timestamp: new Date().toISOString()
      });

      return {
        receiptId,
        fileName: transferMetadata.fileName,
        data: decryptedFile.data,
        metadata: decryptedFile.metadata,
        receptionTime: completionTime
      };
    } catch (error) {
      console.error('File reception failed:', error);
      throw new Error(`Failed to receive file: ${error.message}`);
    }
  }

  /**
   * Create secure WebSocket connection for real-time transmission
   */
  createSecureWebSocket(sessionId, options = {}) {
    const session = this.activeSessions.get(sessionId);
    
    if (!session || !session.keyExchangeCompleted) {
      throw new Error('Session not ready for WebSocket connection');
    }

    const wsOptions = {
      perMessageDeflate: false, // Disable compression for encrypted data
      maxPayload: this.config.chunkSize * 2, // Allow for base64 encoding overhead
      ...options
    };

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(options.url, wsOptions);
      
      ws.on('open', () => {
        // Send session authentication
        const authMessage = {
          type: 'auth',
          sessionId,
          timestamp: new Date().toISOString()
        };
        
        ws.send(JSON.stringify(authMessage));
        resolve(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      });

      ws.on('close', () => {
        console.log('WebSocket connection closed');
      });

      // Setup message encryption/decryption
      this.setupWebSocketEncryption(ws, session);
    });
  }

  /**
   * Setup WebSocket message encryption
   */
  setupWebSocketEncryption(ws, session) {
    const originalSend = ws.send.bind(ws);
    const self = this;

    // Override send method to encrypt messages
    ws.send = function(data) {
      try {
        const encrypted = self.encryptMessage(data, session.sharedSecret);
        return originalSend(JSON.stringify(encrypted));
      } catch (error) {
        console.error('Failed to encrypt WebSocket message:', error);
        throw error;
      }
    };

    // Setup message decryption
    ws.on('message', (data) => {
      try {
        const encrypted = JSON.parse(data.toString());
        const decrypted = self.decryptMessage(encrypted, session.sharedSecret);
        ws.emit('decrypted-message', decrypted);
      } catch (error) {
        console.error('Failed to decrypt WebSocket message:', error);
        ws.emit('error', new Error('Message decryption failed'));
      }
    });
  }

  /**
   * Encrypt message for WebSocket transmission
   */
  encryptMessage(message, sharedSecret) {
    const iv = crypto.randomBytes(this.config.ivSize);
    const cipher = crypto.createCipherGCM(this.config.algorithm, sharedSecret, iv);
    
    const messageBuffer = Buffer.from(typeof message === 'string' ? message : JSON.stringify(message));
    const encrypted = Buffer.concat([cipher.update(messageBuffer), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      iv: iv.toString('base64'),
      data: encrypted.toString('base64'),
      tag: tag.toString('base64'),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Decrypt WebSocket message
   */
  decryptMessage(encryptedMessage, sharedSecret) {
    const iv = Buffer.from(encryptedMessage.iv, 'base64');
    const data = Buffer.from(encryptedMessage.data, 'base64');
    const tag = Buffer.from(encryptedMessage.tag, 'base64');

    const decipher = crypto.createDecipherGCM(this.config.algorithm, sharedSecret, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    
    try {
      return JSON.parse(decrypted.toString());
    } catch {
      return decrypted.toString();
    }
  }

  /**
   * Encrypt file for transmission
   */
  async encryptFileForTransmission(fileBuffer, sessionKey, metadata) {
    const iv = crypto.randomBytes(this.config.ivSize);
    const cipher = crypto.createCipherGCM(this.config.algorithm, sessionKey, iv);

    // Add metadata as additional authenticated data
    const aad = Buffer.from(JSON.stringify({
      ...metadata,
      timestamp: new Date().toISOString(),
      originalSize: fileBuffer.length
    }));
    
    cipher.setAAD(aad);

    const encrypted = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      data: Buffer.concat([iv, tag, encrypted]),
      metadata: JSON.parse(aad.toString())
    };
  }

  /**
   * Decrypt received file
   */
  async decryptReceivedFile(encryptedBuffer, sessionKey, expectedMetadata) {
    const iv = encryptedBuffer.subarray(0, this.config.ivSize);
    const tag = encryptedBuffer.subarray(this.config.ivSize, this.config.ivSize + this.config.tagSize);
    const data = encryptedBuffer.subarray(this.config.ivSize + this.config.tagSize);

    const decipher = crypto.createDecipherGCM(this.config.algorithm, sessionKey, iv);
    decipher.setAuthTag(tag);

    // Set expected metadata as AAD
    const aad = Buffer.from(JSON.stringify(expectedMetadata));
    decipher.setAAD(aad);

    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);

    return {
      data: decrypted,
      metadata: expectedMetadata
    };
  }

  /**
   * Split data into chunks
   */
  splitIntoChunks(buffer, chunkSize) {
    const chunks = [];
    
    for (let i = 0; i < buffer.length; i += chunkSize) {
      chunks.push(buffer.subarray(i, i + chunkSize));
    }
    
    return chunks;
  }

  /**
   * Close session and cleanup
   */
  async closeSession(sessionId, reason = 'manual') {
    try {
      const session = this.activeSessions.get(sessionId);
      
      if (session) {
        session.isActive = false;
        session.closedAt = new Date();
        session.closeReason = reason;

        // Clear sensitive data
        if (session.privateKey) {
          session.privateKey.fill(0);
        }
        if (session.sharedSecret) {
          session.sharedSecret.fill(0);
        }

        // Remove active transfers for this session
        for (const [transferId, transfer] of this.activeTransfers.entries()) {
          if (transfer.sessionId === sessionId) {
            this.activeTransfers.delete(transferId);
          }
        }

        this.activeSessions.delete(sessionId);

        await auditLogger.log({
          action: 'secure_session_closed',
          sessionId,
          userId: session.userId,
          recipientId: session.recipientId,
          reason,
          transferCount: session.transferCount,
          duration: session.closedAt - session.createdAt,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Failed to close session:', error);
    }
  }

  /**
   * Get transmission statistics
   */
  getTransmissionStats() {
    const activeSessions = Array.from(this.activeSessions.values());
    const activeTransfers = Array.from(this.activeTransfers.values());

    return {
      activeSessions: activeSessions.length,
      activeTransfers: activeTransfers.length,
      totalTransfers: activeTransfers.reduce((sum, t) => sum + t.totalChunks, 0),
      completedTransfers: activeTransfers.filter(t => t.status === 'completed').length,
      averageFileSize: activeTransfers.length > 0 
        ? Math.round(activeTransfers.reduce((sum, t) => sum + t.fileSize, 0) / activeTransfers.length)
        : 0,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Cleanup expired sessions and transfers
   */
  async cleanup() {
    const now = new Date();
    let cleanedSessions = 0;
    let cleanedTransfers = 0;

    // Cleanup expired sessions
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now > session.expiresAt) {
        await this.closeSession(sessionId, 'expired');
        cleanedSessions++;
      }
    }

    // Cleanup old transfers (older than 1 hour)
    const transferCutoff = new Date(now.getTime() - 3600000);
    for (const [transferId, transfer] of this.activeTransfers.entries()) {
      if (transfer.startTime < transferCutoff.getTime()) {
        this.activeTransfers.delete(transferId);
        cleanedTransfers++;
      }
    }

    if (cleanedSessions > 0 || cleanedTransfers > 0) {
      console.log(`Cleaned up ${cleanedSessions} expired sessions and ${cleanedTransfers} old transfers`);
    }
  }
}

// Create singleton instance
const secureTransmission = new SecureTransmission();

// Setup cleanup interval
setInterval(() => {
  secureTransmission.cleanup();
}, 300000); // Every 5 minutes

module.exports = {
  SecureTransmission,
  secureTransmission
};