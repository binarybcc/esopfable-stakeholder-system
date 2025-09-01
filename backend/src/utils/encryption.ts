import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // For GCM mode
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

// Get encryption key from environment variable
const getEncryptionKey = (): Buffer => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  return Buffer.from(key, 'hex');
};

// Derive key from password using PBKDF2
const deriveKey = (password: string, salt: Buffer): Buffer => {
  return crypto.pbkdf2Sync(password, salt, 100000, KEY_LENGTH, 'sha256');
};

/**
 * Encrypt text data
 */
export const encryptText = (text: string, password?: string): string => {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);
    
    let key: Buffer;
    if (password) {
      key = deriveKey(password, salt);
    } else {
      key = getEncryptionKey();
    }

    const cipher = crypto.createCipherGCM(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();

    // Combine salt + iv + tag + encrypted data
    const result = Buffer.concat([
      salt,
      iv,
      tag,
      Buffer.from(encrypted, 'hex')
    ]);

    return result.toString('base64');
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
};

/**
 * Decrypt text data
 */
export const decryptText = (encryptedData: string, password?: string): string => {
  try {
    const data = Buffer.from(encryptedData, 'base64');
    
    // Extract components
    const salt = data.slice(0, SALT_LENGTH);
    const iv = data.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = data.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = data.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    let key: Buffer;
    if (password) {
      key = deriveKey(password, salt);
    } else {
      key = getEncryptionKey();
    }

    const decipher = crypto.createDecipherGCM(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
};

/**
 * Encrypt file
 */
export const encryptFile = async (filePath: string, password?: string): Promise<string> => {
  try {
    const data = await fs.readFile(filePath);
    
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);
    
    let key: Buffer;
    if (password) {
      key = deriveKey(password, salt);
    } else {
      key = getEncryptionKey();
    }

    const cipher = crypto.createCipherGCM(ALGORITHM, key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final()
    ]);
    
    const tag = cipher.getAuthTag();

    // Create encrypted file with metadata
    const encryptedData = Buffer.concat([
      salt,
      iv,
      tag,
      encrypted
    ]);

    // Write to new file with .enc extension
    const encryptedPath = `${filePath}.enc`;
    await fs.writeFile(encryptedPath, encryptedData);
    
    return encryptedPath;
  } catch (error) {
    throw new Error(`File encryption failed: ${error.message}`);
  }
};

/**
 * Decrypt file
 */
export const decryptFile = async (encryptedFilePath: string, outputPath: string, password?: string): Promise<void> => {
  try {
    const encryptedData = await fs.readFile(encryptedFilePath);
    
    // Extract components
    const salt = encryptedData.slice(0, SALT_LENGTH);
    const iv = encryptedData.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = encryptedData.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = encryptedData.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    let key: Buffer;
    if (password) {
      key = deriveKey(password, salt);
    } else {
      key = getEncryptionKey();
    }

    const decipher = crypto.createDecipherGCM(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    await fs.writeFile(outputPath, decrypted);
  } catch (error) {
    throw new Error(`File decryption failed: ${error.message}`);
  }
};

/**
 * Generate secure hash
 */
export const generateHash = (data: string, salt?: string): string => {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256');
  hash.update(data + actualSalt);
  return hash.digest('hex');
};

/**
 * Generate secure random token
 */
export const generateSecureToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Calculate file checksum
 */
export const calculateFileChecksum = async (filePath: string): Promise<string> => {
  try {
    const data = await fs.readFile(filePath);
    const hash = crypto.createHash('sha256');
    hash.update(data);
    return hash.digest('hex');
  } catch (error) {
    throw new Error(`Checksum calculation failed: ${error.message}`);
  }
};

/**
 * Verify file integrity
 */
export const verifyFileIntegrity = async (filePath: string, expectedChecksum: string): Promise<boolean> => {
  try {
    const actualChecksum = await calculateFileChecksum(filePath);
    return actualChecksum === expectedChecksum;
  } catch (error) {
    return false;
  }
};

/**
 * Secure data for database storage
 */
export const encryptForDatabase = (data: any): { encryptedData: string; metadata: any } => {
  const jsonString = JSON.stringify(data);
  const encryptedData = encryptText(jsonString);
  
  return {
    encryptedData,
    metadata: {
      algorithm: ALGORITHM,
      encrypted_at: new Date().toISOString(),
      data_type: typeof data
    }
  };
};

/**
 * Decrypt data from database
 */
export const decryptFromDatabase = (encryptedData: string, metadata: any): any => {
  const decryptedString = decryptText(encryptedData);
  return JSON.parse(decryptedString);
};

/**
 * Create encrypted backup of file
 */
export const createEncryptedBackup = async (filePath: string, backupDir: string): Promise<string> => {
  try {
    const fileName = path.basename(filePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `${timestamp}-${fileName}.backup.enc`;
    const backupPath = path.join(backupDir, backupFileName);
    
    // Ensure backup directory exists
    await fs.mkdir(backupDir, { recursive: true });
    
    // Encrypt and copy file
    const data = await fs.readFile(filePath);
    const encryptedData = encryptText(data.toString('base64'));
    
    await fs.writeFile(backupPath, encryptedData);
    
    return backupPath;
  } catch (error) {
    throw new Error(`Backup creation failed: ${error.message}`);
  }
};

/**
 * Key rotation utility
 */
export const rotateEncryptionKey = async (oldKey: string, newKey: string, dataPath: string): Promise<void> => {
  try {
    // This is a utility for key rotation - decrypt with old key, encrypt with new key
    const oldKeyBuffer = Buffer.from(oldKey, 'hex');
    const newKeyBuffer = Buffer.from(newKey, 'hex');
    
    // Read encrypted data
    const encryptedData = await fs.readFile(dataPath);
    
    // Extract components using old key structure
    const salt = encryptedData.slice(0, SALT_LENGTH);
    const iv = encryptedData.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = encryptedData.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = encryptedData.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    // Decrypt with old key
    const decipher = crypto.createDecipherGCM(ALGORITHM, oldKeyBuffer, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    // Re-encrypt with new key
    const newIv = crypto.randomBytes(IV_LENGTH);
    const newSalt = crypto.randomBytes(SALT_LENGTH);
    
    const cipher = crypto.createCipherGCM(ALGORITHM, newKeyBuffer, newIv);
    const reEncrypted = Buffer.concat([
      cipher.update(decrypted),
      cipher.final()
    ]);
    const newTag = cipher.getAuthTag();

    // Write back with new encryption
    const newEncryptedData = Buffer.concat([
      newSalt,
      newIv,
      newTag,
      reEncrypted
    ]);

    await fs.writeFile(dataPath, newEncryptedData);
  } catch (error) {
    throw new Error(`Key rotation failed: ${error.message}`);
  }
};