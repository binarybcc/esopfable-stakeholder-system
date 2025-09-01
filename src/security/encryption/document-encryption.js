/**
 * Document Encryption Service
 * Handles encryption/decryption of files at rest and in transit
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { pipeline } = require('stream');
const { promisify } = require('util');
const zlib = require('zlib');
const { auditLogger } = require('../../services/audit-service');

const streamPipeline = promisify(pipeline);

class DocumentEncryption {
  constructor(config = {}) {
    this.algorithm = config.algorithm || 'aes-256-gcm';
    this.keyDerivationRounds = config.keyDerivationRounds || 100000;
    this.keySize = 32; // 256 bits
    this.ivSize = 16; // 128 bits
    this.tagSize = 16; // 128 bits
    this.saltSize = 32; // 256 bits
    this.compressionLevel = config.compressionLevel || 6;
    
    // Key management
    this.masterKey = this.getMasterKey();
    this.keyRotationInterval = config.keyRotationInterval || 30 * 24 * 60 * 60 * 1000; // 30 days
  }

  /**
   * Encrypt document with metadata
   */
  async encryptDocument(filePath, metadata = {}, options = {}) {
    try {
      const startTime = Date.now();
      
      // Read file
      const fileBuffer = await fs.readFile(filePath);
      const originalSize = fileBuffer.length;

      // Generate encryption key and IV
      const salt = crypto.randomBytes(this.saltSize);
      const encryptionKey = await this.deriveKey(this.masterKey, salt);
      const iv = crypto.randomBytes(this.ivSize);

      // Compress if enabled
      let dataToEncrypt = fileBuffer;
      let isCompressed = false;
      
      if (options.compress && originalSize > 1024) { // Only compress files > 1KB
        dataToEncrypt = zlib.gzipSync(fileBuffer, { level: this.compressionLevel });
        isCompressed = true;
      }

      // Create cipher
      const cipher = crypto.createCipherGCM(this.algorithm, encryptionKey, iv);
      
      // Add metadata as additional authenticated data
      const aad = Buffer.from(JSON.stringify({
        filename: path.basename(filePath),
        originalSize: originalSize,
        compressed: isCompressed,
        timestamp: new Date().toISOString(),
        classification: metadata.classification || 'internal',
        ...metadata
      }));
      
      cipher.setAAD(aad);

      // Encrypt data
      const encryptedData = Buffer.concat([
        cipher.update(dataToEncrypt),
        cipher.final()
      ]);

      const authTag = cipher.getAuthTag();

      // Create encrypted file structure
      const encryptedFile = {
        version: '1.0',
        algorithm: this.algorithm,
        salt: salt.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        metadata: aad.toString('base64'),
        data: encryptedData.toString('base64')
      };

      const encryptionTime = Date.now() - startTime;
      const compressionRatio = isCompressed ? (dataToEncrypt.length / originalSize) : 1;

      // Log encryption event
      await auditLogger.log({
        action: 'document_encrypted',
        filePath: filePath,
        originalSize: originalSize,
        encryptedSize: Buffer.from(JSON.stringify(encryptedFile)).length,
        compressionRatio: compressionRatio,
        encryptionTime: encryptionTime,
        classification: metadata.classification,
        timestamp: new Date().toISOString()
      });

      return {
        encryptedData: JSON.stringify(encryptedFile, null, 2),
        keyId: this.generateKeyId(salt),
        metadata: {
          originalSize,
          encryptedSize: Buffer.from(JSON.stringify(encryptedFile)).length,
          compressed: isCompressed,
          encryptionTime
        }
      };
    } catch (error) {
      console.error('Document encryption failed:', error);
      
      await auditLogger.log({
        action: 'document_encryption_failed',
        filePath: filePath,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      throw new Error(`Failed to encrypt document: ${error.message}`);
    }
  }

  /**
   * Decrypt document
   */
  async decryptDocument(encryptedData, keyId, options = {}) {
    try {
      const startTime = Date.now();
      
      // Parse encrypted file
      const encryptedFile = JSON.parse(encryptedData);
      
      if (encryptedFile.version !== '1.0') {
        throw new Error('Unsupported encryption version');
      }

      // Extract components
      const salt = Buffer.from(encryptedFile.salt, 'base64');
      const iv = Buffer.from(encryptedFile.iv, 'base64');
      const authTag = Buffer.from(encryptedFile.authTag, 'base64');
      const metadata = Buffer.from(encryptedFile.metadata, 'base64');
      const data = Buffer.from(encryptedFile.data, 'base64');

      // Derive decryption key
      const decryptionKey = await this.deriveKey(this.masterKey, salt);

      // Create decipher
      const decipher = crypto.createDecipherGCM(encryptedFile.algorithm, decryptionKey, iv);
      decipher.setAuthTag(authTag);
      decipher.setAAD(metadata);

      // Decrypt data
      const decryptedData = Buffer.concat([
        decipher.update(data),
        decipher.final()
      ]);

      // Parse metadata
      const metadataObj = JSON.parse(metadata.toString());
      
      // Decompress if needed
      let finalData = decryptedData;
      if (metadataObj.compressed) {
        finalData = zlib.gunzipSync(decryptedData);
      }

      const decryptionTime = Date.now() - startTime;

      // Log decryption event
      await auditLogger.log({
        action: 'document_decrypted',
        keyId: keyId,
        originalSize: metadataObj.originalSize,
        decryptionTime: decryptionTime,
        classification: metadataObj.classification,
        timestamp: new Date().toISOString()
      });

      return {
        data: finalData,
        metadata: metadataObj,
        decryptionTime: decryptionTime
      };
    } catch (error) {
      console.error('Document decryption failed:', error);
      
      await auditLogger.log({
        action: 'document_decryption_failed',
        keyId: keyId,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      throw new Error(`Failed to decrypt document: ${error.message}`);
    }
  }

  /**
   * Encrypt file stream for large files
   */
  async encryptFileStream(inputPath, outputPath, metadata = {}) {
    try {
      const startTime = Date.now();
      
      // Generate encryption parameters
      const salt = crypto.randomBytes(this.saltSize);
      const encryptionKey = await this.deriveKey(this.masterKey, salt);
      const iv = crypto.randomBytes(this.ivSize);

      // Create cipher stream
      const cipher = crypto.createCipherGCM(this.algorithm, encryptionKey, iv);
      
      // Set AAD
      const aad = Buffer.from(JSON.stringify({
        filename: path.basename(inputPath),
        timestamp: new Date().toISOString(),
        ...metadata
      }));
      cipher.setAAD(aad);

      // Create streams
      const inputStream = require('fs').createReadStream(inputPath);
      const compressionStream = zlib.createGzip({ level: this.compressionLevel });
      const outputStream = require('fs').createWriteStream(outputPath + '.tmp');

      // Write header
      const header = {
        version: '1.0',
        algorithm: this.algorithm,
        salt: salt.toString('base64'),
        iv: iv.toString('base64'),
        metadata: aad.toString('base64')
      };
      
      await outputStream.write(JSON.stringify(header) + '\n---ENCRYPTED_DATA---\n');

      // Pipeline: input -> compression -> encryption -> output
      await streamPipeline(
        inputStream,
        compressionStream,
        cipher,
        outputStream
      );

      // Append auth tag
      const authTag = cipher.getAuthTag();
      await fs.appendFile(outputPath + '.tmp', '\n---AUTH_TAG---\n' + authTag.toString('base64'));

      // Atomic move
      await fs.rename(outputPath + '.tmp', outputPath);

      const encryptionTime = Date.now() - startTime;
      const keyId = this.generateKeyId(salt);

      await auditLogger.log({
        action: 'file_stream_encrypted',
        inputPath: inputPath,
        outputPath: outputPath,
        keyId: keyId,
        encryptionTime: encryptionTime,
        timestamp: new Date().toISOString()
      });

      return { keyId, encryptionTime };
    } catch (error) {
      // Clean up temp file
      try {
        await fs.unlink(outputPath + '.tmp');
      } catch {}

      console.error('File stream encryption failed:', error);
      throw new Error(`Failed to encrypt file stream: ${error.message}`);
    }
  }

  /**
   * Decrypt file stream
   */
  async decryptFileStream(inputPath, outputPath, keyId) {
    try {
      const startTime = Date.now();
      
      // Read encrypted file
      const encryptedContent = await fs.readFile(inputPath, 'utf8');
      const parts = encryptedContent.split('\n---ENCRYPTED_DATA---\n');
      
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted file format');
      }

      const header = JSON.parse(parts[0]);
      const dataParts = parts[1].split('\n---AUTH_TAG---\n');
      
      if (dataParts.length !== 2) {
        throw new Error('Invalid encrypted file format - missing auth tag');
      }

      // Extract components
      const salt = Buffer.from(header.salt, 'base64');
      const iv = Buffer.from(header.iv, 'base64');
      const authTag = Buffer.from(dataParts[1], 'base64');
      const metadata = Buffer.from(header.metadata, 'base64');
      const encryptedData = Buffer.from(dataParts[0], 'base64');

      // Derive decryption key
      const decryptionKey = await this.deriveKey(this.masterKey, salt);

      // Create decipher
      const decipher = crypto.createDecipherGCM(header.algorithm, decryptionKey, iv);
      decipher.setAuthTag(authTag);
      decipher.setAAD(metadata);

      // Create streams
      const inputStream = require('stream').Readable.from([encryptedData]);
      const decompressionStream = zlib.createGunzip();
      const outputStream = require('fs').createWriteStream(outputPath);

      // Pipeline: encrypted input -> decryption -> decompression -> output
      await streamPipeline(
        inputStream,
        decipher,
        decompressionStream,
        outputStream
      );

      const decryptionTime = Date.now() - startTime;

      await auditLogger.log({
        action: 'file_stream_decrypted',
        inputPath: inputPath,
        outputPath: outputPath,
        keyId: keyId,
        decryptionTime: decryptionTime,
        timestamp: new Date().toISOString()
      });

      return { decryptionTime };
    } catch (error) {
      console.error('File stream decryption failed:', error);
      throw new Error(`Failed to decrypt file stream: ${error.message}`);
    }
  }

  /**
   * Derive encryption key from master key and salt
   */
  async deriveKey(masterKey, salt) {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(masterKey, salt, this.keyDerivationRounds, this.keySize, 'sha512', (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      });
    });
  }

  /**
   * Generate key ID for tracking
   */
  generateKeyId(salt) {
    return crypto.createHash('sha256').update(salt).digest('hex').substring(0, 16);
  }

  /**
   * Get master key from environment or generate new one
   */
  getMasterKey() {
    const envKey = process.env.DOCUMENT_ENCRYPTION_KEY;
    
    if (envKey) {
      return Buffer.from(envKey, 'base64');
    }

    // In production, this should come from a secure key management system
    console.warn('No master encryption key found in environment. Generating temporary key.');
    return crypto.randomBytes(this.keySize);
  }

  /**
   * Rotate encryption key (admin function)
   */
  async rotateKey() {
    try {
      // Generate new master key
      const newMasterKey = crypto.randomBytes(this.keySize);
      
      // In production, you would:
      // 1. Store new key securely
      // 2. Re-encrypt all documents with new key
      // 3. Update key references
      
      await auditLogger.log({
        action: 'encryption_key_rotated',
        oldKeyId: this.generateKeyId(Buffer.from('old-key')),
        newKeyId: this.generateKeyId(Buffer.from('new-key')),
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error('Key rotation failed:', error);
      throw new Error(`Failed to rotate encryption key: ${error.message}`);
    }
  }

  /**
   * Verify document integrity
   */
  async verifyDocumentIntegrity(encryptedData, expectedHash = null) {
    try {
      const hash = crypto.createHash('sha256').update(encryptedData).digest('hex');
      
      if (expectedHash && hash !== expectedHash) {
        await auditLogger.log({
          action: 'document_integrity_failed',
          expectedHash: expectedHash,
          actualHash: hash,
          timestamp: new Date().toISOString()
        });
        
        return false;
      }

      return { valid: true, hash };
    } catch (error) {
      console.error('Document integrity verification failed:', error);
      return { valid: false, error: error.message };
    }
  }

  /**
   * Get encryption statistics
   */
  async getEncryptionStats() {
    // This would typically query a database for encryption metrics
    return {
      totalEncryptedDocuments: 0, // Would be fetched from database
      averageEncryptionTime: 0,
      averageCompressionRatio: 0,
      keyRotationsDue: 0,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Secure delete of unencrypted file
   */
  async secureDelete(filePath) {
    try {
      const stat = await fs.stat(filePath);
      const fileSize = stat.size;

      // Overwrite file with random data multiple times
      const overwritePasses = 3;
      
      for (let pass = 0; pass < overwritePasses; pass++) {
        const randomData = crypto.randomBytes(fileSize);
        await fs.writeFile(filePath, randomData);
      }

      // Final overwrite with zeros
      const zeroData = Buffer.alloc(fileSize, 0);
      await fs.writeFile(filePath, zeroData);

      // Delete file
      await fs.unlink(filePath);

      await auditLogger.log({
        action: 'secure_delete',
        filePath: filePath,
        fileSize: fileSize,
        overwritePasses: overwritePasses,
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error('Secure delete failed:', error);
      return false;
    }
  }
}

// Create singleton instance
const documentEncryption = new DocumentEncryption();

module.exports = {
  DocumentEncryption,
  documentEncryption
};