import crypto from 'crypto';
import { EncryptionResult, DecryptionOptions } from '../types';
import logger, { logSecurity } from './logger';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const KEY_SIZE = 32; // 256 bits
const IV_SIZE = 16; // 128 bits
const TAG_SIZE = 16; // 128 bits

// Master key management (in production, use proper key management service)
class KeyManager {
  private masterKey: Buffer;
  private keyRotationInterval: number = 30 * 24 * 60 * 60 * 1000; // 30 days
  private keys: Map<string, { key: Buffer, createdAt: Date }> = new Map();

  constructor() {
    // Initialize master key from environment or generate one
    const masterKeyHex = process.env.ENCRYPTION_MASTER_KEY;
    if (masterKeyHex) {
      this.masterKey = Buffer.from(masterKeyHex, 'hex');
    } else {
      this.masterKey = crypto.randomBytes(KEY_SIZE);
      logger.warn('No ENCRYPTION_MASTER_KEY found, generated temporary key. This should not happen in production!');
    }
    
    this.generateInitialKey();
  }

  private generateInitialKey() {
    const keyId = this.generateKeyId();
    const key = crypto.randomBytes(KEY_SIZE);
    this.keys.set(keyId, { key, createdAt: new Date() });
    logSecurity('encryption_key_generated', { keyId, purpose: 'initial' });
  }

  private generateKeyId(): string {
    return `key_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  public getCurrentKeyId(): string {
    // Get the most recent key
    const sortedKeys = Array.from(this.keys.entries())
      .sort(([, a], [, b]) => b.createdAt.getTime() - a.createdAt.getTime());
    
    if (sortedKeys.length === 0) {
      this.generateInitialKey();
      return this.getCurrentKeyId();
    }
    
    const [keyId, keyData] = sortedKeys[0];
    
    // Check if key needs rotation
    const keyAge = Date.now() - keyData.createdAt.getTime();
    if (keyAge > this.keyRotationInterval) {
      return this.rotateKey();
    }
    
    return keyId;
  }

  public getKey(keyId: string): Buffer | null {
    const keyData = this.keys.get(keyId);
    return keyData ? keyData.key : null;
  }

  private rotateKey(): string {
    const newKeyId = this.generateKeyId();
    const newKey = crypto.randomBytes(KEY_SIZE);
    this.keys.set(newKeyId, { key: newKey, createdAt: new Date() });
    
    logSecurity('encryption_key_rotated', { newKeyId });
    
    // Clean up old keys (keep last 5 for decryption of old data)
    const sortedKeys = Array.from(this.keys.entries())
      .sort(([, a], [, b]) => b.createdAt.getTime() - a.createdAt.getTime());
    
    if (sortedKeys.length > 5) {
      for (let i = 5; i < sortedKeys.length; i++) {
        const [oldKeyId] = sortedKeys[i];
        this.keys.delete(oldKeyId);
        logSecurity('encryption_key_deleted', { keyId: oldKeyId });
      }
    }
    
    return newKeyId;
  }
}

const keyManager = new KeyManager();

/**
 * Encrypt data using AES-256-GCM
 */
export function encryptData(data: string): EncryptionResult {
  try {
    const keyId = keyManager.getCurrentKeyId();
    const key = keyManager.getKey(keyId);
    
    if (!key) {
      throw new Error('Encryption key not available');
    }
    
    const iv = crypto.randomBytes(IV_SIZE);
    const cipher = crypto.createCipher(ALGORITHM, key);
    cipher.setAutoPadding(true);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    // Combine IV, tag, and encrypted data
    const combined = Buffer.concat([iv, tag, Buffer.from(encrypted, 'hex')]);
    
    return {
      encryptedData: combined.toString('base64'),
      keyId,
      algorithm: ALGORITHM,
      iv: iv.toString('hex'),
    };
  } catch (error) {
    logSecurity('encryption_failed', { error: (error as Error).message });
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt data using AES-256-GCM
 */
export function decryptData(encryptedData: string, options: DecryptionOptions): string {
  try {
    const { keyId } = options;
    const key = keyManager.getKey(keyId);
    
    if (!key) {
      throw new Error('Decryption key not available');
    }
    
    const combined = Buffer.from(encryptedData, 'base64');
    
    // Extract IV, tag, and encrypted data
    const iv = combined.slice(0, IV_SIZE);
    const tag = combined.slice(IV_SIZE, IV_SIZE + TAG_SIZE);
    const encrypted = combined.slice(IV_SIZE + TAG_SIZE);
    
    const decipher = crypto.createDecipher(ALGORITHM, key);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logSecurity('decryption_failed', { 
      error: (error as Error).message, 
      keyId: options.keyId 
    });
    throw new Error('Decryption failed');
  }
}

/**
 * Hash sensitive data for search/comparison purposes
 */
export function hashSensitiveData(data: string, salt?: string): string {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256');
  hash.update(data + actualSalt);
  return hash.digest('hex');
}

/**
 * Generate file hash for integrity verification
 */
export function generateFileHash(buffer: Buffer): string {
  const hash = crypto.createHash('sha256');
  hash.update(buffer);
  return hash.digest('hex');
}

/**
 * Verify file integrity
 */
export function verifyFileIntegrity(buffer: Buffer, expectedHash: string): boolean {
  const actualHash = generateFileHash(buffer);
  return actualHash === expectedHash;
}

/**
 * Generate secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Encrypt file buffer
 */
export function encryptFile(buffer: Buffer): EncryptionResult {
  const data = buffer.toString('base64');
  return encryptData(data);
}

/**
 * Decrypt file buffer
 */
export function decryptFile(encryptedData: string, options: DecryptionOptions): Buffer {
  const data = decryptData(encryptedData, options);
  return Buffer.from(data, 'base64');
}

/**
 * Generate encryption key for external systems
 */
export function generateExternalKey(): string {
  return crypto.randomBytes(KEY_SIZE).toString('hex');
}

/**
 * PBKDF2 key derivation for passwords
 */
export function deriveKeyFromPassword(password: string, salt: string, iterations: number = 100000): Buffer {
  return crypto.pbkdf2Sync(password, salt, iterations, KEY_SIZE, 'sha256');
}

/**
 * Generate cryptographically secure password
 */
export function generateSecurePassword(length: number = 16): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    password += charset[randomIndex];
  }
  
  return password;
}

export { keyManager };