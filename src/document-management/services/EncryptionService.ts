import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  tagLength: number;
  masterKeyPath: string;
}

export interface EncryptionResult {
  encryptedData: Buffer;
  key: string;
  iv: string;
  tag: string;
}

export interface DecryptionParams {
  encryptedData: Buffer;
  key: string;
  iv: string;
  tag: string;
}

export class EncryptionService {
  private config: EncryptionConfig;
  private masterKey: Buffer;

  constructor(config: Partial<EncryptionConfig> = {}) {
    this.config = {
      algorithm: 'aes-256-gcm',
      keyLength: 32, // 256 bits
      ivLength: 16,  // 128 bits
      tagLength: 16, // 128 bits
      masterKeyPath: process.env.MASTER_KEY_PATH || './keys/master.key',
      ...config
    };
  }

  async initialize(): Promise<void> {
    await this.loadOrCreateMasterKey();
  }

  private async loadOrCreateMasterKey(): Promise<void> {
    try {
      const keyData = await fs.readFile(this.config.masterKeyPath);
      this.masterKey = keyData;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Create master key if it doesn't exist
        this.masterKey = crypto.randomBytes(this.config.keyLength);
        
        // Ensure directory exists
        const keyDir = path.dirname(this.config.masterKeyPath);
        await fs.mkdir(keyDir, { recursive: true });
        
        // Write master key securely
        await fs.writeFile(this.config.masterKeyPath, this.masterKey, { mode: 0o600 });
        console.log('Generated new master key');
      } else {
        throw new Error(`Failed to load master key: ${error}`);
      }
    }
  }

  /**
   * Generate a new encryption key using PBKDF2
   */
  generateKey(password?: string): Buffer {
    if (password) {
      const salt = crypto.randomBytes(32);
      return crypto.pbkdf2Sync(password, salt, 100000, this.config.keyLength, 'sha256');
    }
    return crypto.randomBytes(this.config.keyLength);
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  encrypt(data: Buffer, key?: Buffer): EncryptionResult {
    const encryptionKey = key || this.generateKey();
    const iv = crypto.randomBytes(this.config.ivLength);
    
    const cipher = crypto.createCipher(this.config.algorithm, encryptionKey);
    cipher.setAAD(Buffer.from('document-management', 'utf8'));
    
    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final()
    ]);
    
    const tag = cipher.getAuthTag();
    
    return {
      encryptedData: encrypted,
      key: encryptionKey.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64')
    };
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  decrypt(params: DecryptionParams): Buffer {
    const key = Buffer.from(params.key, 'base64');
    const iv = Buffer.from(params.iv, 'base64');
    const tag = Buffer.from(params.tag, 'base64');
    
    const decipher = crypto.createDecipher(this.config.algorithm, key);
    decipher.setAuthTag(tag);
    decipher.setAAD(Buffer.from('document-management', 'utf8'));
    
    const decrypted = Buffer.concat([
      decipher.update(params.encryptedData),
      decipher.final()
    ]);
    
    return decrypted;
  }

  /**
   * Encrypt a file and save it to disk
   */
  async encryptFile(inputPath: string, outputPath: string, key?: Buffer): Promise<EncryptionResult> {
    const data = await fs.readFile(inputPath);
    const result = this.encrypt(data, key);
    
    // Store encrypted file with metadata
    const fileData = {
      data: result.encryptedData.toString('base64'),
      iv: result.iv,
      tag: result.tag,
      timestamp: new Date().toISOString(),
      checksum: crypto.createHash('sha256').update(data).digest('hex')
    };
    
    await fs.writeFile(outputPath, JSON.stringify(fileData), { mode: 0o600 });
    
    return result;
  }

  /**
   * Decrypt a file from disk
   */
  async decryptFile(inputPath: string, outputPath: string, key: string): Promise<void> {
    const fileContent = await fs.readFile(inputPath, 'utf8');
    const fileData = JSON.parse(fileContent);
    
    const decrypted = this.decrypt({
      encryptedData: Buffer.from(fileData.data, 'base64'),
      key,
      iv: fileData.iv,
      tag: fileData.tag
    });
    
    await fs.writeFile(outputPath, decrypted);
  }

  /**
   * Encrypt file in-place with streaming for large files
   */
  async encryptFileStream(inputPath: string, outputPath: string, key?: Buffer): Promise<EncryptionResult> {
    const encryptionKey = key || this.generateKey();
    const iv = crypto.randomBytes(this.config.ivLength);
    
    return new Promise((resolve, reject) => {
      const cipher = crypto.createCipher(this.config.algorithm, encryptionKey);
      cipher.setAAD(Buffer.from('document-management', 'utf8'));
      
      const input = require('fs').createReadStream(inputPath);
      const output = require('fs').createWriteStream(outputPath, { mode: 0o600 });
      
      let encryptedSize = 0;
      
      input.pipe(cipher).pipe(output);
      
      output.on('finish', () => {
        const tag = cipher.getAuthTag();
        
        resolve({
          encryptedData: Buffer.alloc(0), // Not applicable for streaming
          key: encryptionKey.toString('base64'),
          iv: iv.toString('base64'),
          tag: tag.toString('base64')
        });
      });
      
      output.on('error', reject);
      input.on('error', reject);
    });
  }

  /**
   * Generate secure random filename
   */
  generateSecureFilename(originalName: string): string {
    const ext = path.extname(originalName);
    const random = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    return `${timestamp}_${random}${ext}`;
  }

  /**
   * Calculate file checksums
   */
  async calculateChecksums(filePath: string): Promise<{ sha256: string; md5: string }> {
    const data = await fs.readFile(filePath);
    
    return {
      sha256: crypto.createHash('sha256').update(data).digest('hex'),
      md5: crypto.createHash('md5').update(data).digest('hex')
    };
  }

  /**
   * Verify file integrity
   */
  async verifyIntegrity(filePath: string, expectedSha256: string): Promise<boolean> {
    const { sha256 } = await this.calculateChecksums(filePath);
    return sha256 === expectedSha256;
  }

  /**
   * Secure file deletion (overwrite with random data)
   */
  async secureDelete(filePath: string): Promise<void> {
    try {
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;
      
      // Overwrite with random data multiple times
      for (let i = 0; i < 3; i++) {
        const randomData = crypto.randomBytes(fileSize);
        await fs.writeFile(filePath, randomData);
        await fs.fsync((await fs.open(filePath, 'r+')).fd);
      }
      
      // Finally delete the file
      await fs.unlink(filePath);
    } catch (error) {
      throw new Error(`Secure deletion failed: ${error}`);
    }
  }

  /**
   * Encrypt metadata/configuration data
   */
  encryptMetadata(data: any): string {
    const jsonData = JSON.stringify(data);
    const result = this.encrypt(Buffer.from(jsonData, 'utf8'));
    
    return JSON.stringify({
      data: result.encryptedData.toString('base64'),
      iv: result.iv,
      tag: result.tag
    });
  }

  /**
   * Decrypt metadata/configuration data
   */
  decryptMetadata(encryptedData: string, key: string): any {
    const parsed = JSON.parse(encryptedData);
    
    const decrypted = this.decrypt({
      encryptedData: Buffer.from(parsed.data, 'base64'),
      key,
      iv: parsed.iv,
      tag: parsed.tag
    });
    
    return JSON.parse(decrypted.toString('utf8'));
  }

  /**
   * Generate key derivation function for user passwords
   */
  deriveKeyFromPassword(password: string, salt?: Buffer): { key: Buffer; salt: Buffer } {
    const keySalt = salt || crypto.randomBytes(32);
    const derivedKey = crypto.pbkdf2Sync(password, keySalt, 100000, this.config.keyLength, 'sha256');
    
    return {
      key: derivedKey,
      salt: keySalt
    };
  }

  /**
   * Create encrypted backup of file with metadata
   */
  async createEncryptedBackup(filePath: string, backupPath: string, metadata: any): Promise<string> {
    const data = await fs.readFile(filePath);
    const checksums = await this.calculateChecksums(filePath);
    
    const backupData = {
      originalPath: filePath,
      data: data.toString('base64'),
      metadata,
      checksums,
      timestamp: new Date().toISOString(),
      version: '1.0'
    };
    
    const encryptionResult = this.encrypt(Buffer.from(JSON.stringify(backupData), 'utf8'));
    
    const finalBackup = {
      encrypted: encryptionResult.encryptedData.toString('base64'),
      iv: encryptionResult.iv,
      tag: encryptionResult.tag,
      algorithm: this.config.algorithm,
      created: new Date().toISOString()
    };
    
    await fs.writeFile(backupPath, JSON.stringify(finalBackup, null, 2), { mode: 0o600 });
    
    return encryptionResult.key;
  }

  /**
   * Restore from encrypted backup
   */
  async restoreFromBackup(backupPath: string, restorePath: string, key: string): Promise<any> {
    const backupContent = await fs.readFile(backupPath, 'utf8');
    const backup = JSON.parse(backupContent);
    
    const decrypted = this.decrypt({
      encryptedData: Buffer.from(backup.encrypted, 'base64'),
      key,
      iv: backup.iv,
      tag: backup.tag
    });
    
    const backupData = JSON.parse(decrypted.toString('utf8'));
    const originalData = Buffer.from(backupData.data, 'base64');
    
    await fs.writeFile(restorePath, originalData);
    
    // Verify integrity
    const checksums = await this.calculateChecksums(restorePath);
    if (checksums.sha256 !== backupData.checksums.sha256) {
      throw new Error('Backup integrity verification failed');
    }
    
    return backupData.metadata;
  }
}