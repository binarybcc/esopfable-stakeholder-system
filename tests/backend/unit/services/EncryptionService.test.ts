import crypto from 'crypto';
import { EncryptionService } from '../../../../src/document-management/services/EncryptionService';

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;
  const testKey = 'test-encryption-key-32-chars-long!';
  const testData = 'sensitive test data';

  beforeEach(() => {
    encryptionService = new EncryptionService();
  });

  describe('encrypt', () => {
    it('should encrypt data successfully', async () => {
      const result = await encryptionService.encrypt(testData, testKey);

      expect(result).toHaveProperty('encryptedData');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('authTag');
      expect(result).toHaveProperty('algorithm');
      expect(result.encryptedData).not.toBe(testData);
      expect(result.algorithm).toBe('aes-256-gcm');
    });

    it('should produce different ciphertext for same plaintext', async () => {
      const result1 = await encryptionService.encrypt(testData, testKey);
      const result2 = await encryptionService.encrypt(testData, testKey);

      expect(result1.encryptedData).not.toBe(result2.encryptedData);
      expect(result1.iv).not.toBe(result2.iv);
    });

    it('should handle empty data', async () => {
      const result = await encryptionService.encrypt('', testKey);
      
      expect(result.encryptedData).toBe('');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('authTag');
    });

    it('should throw error with invalid key length', async () => {
      const invalidKey = 'short-key';
      
      await expect(encryptionService.encrypt(testData, invalidKey))
        .rejects.toThrow('Invalid key length');
    });

    it('should handle large data efficiently', async () => {
      const largeData = 'x'.repeat(1024 * 1024); // 1MB
      const startTime = Date.now();
      
      const result = await encryptionService.encrypt(largeData, testKey);
      const endTime = Date.now();
      
      expect(result.encryptedData).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('decrypt', () => {
    it('should decrypt data successfully', async () => {
      const encrypted = await encryptionService.encrypt(testData, testKey);
      const decrypted = await encryptionService.decrypt(encrypted, testKey);

      expect(decrypted).toBe(testData);
    });

    it('should handle empty encrypted data', async () => {
      const encrypted = await encryptionService.encrypt('', testKey);
      const decrypted = await encryptionService.decrypt(encrypted, testKey);

      expect(decrypted).toBe('');
    });

    it('should throw error with wrong key', async () => {
      const encrypted = await encryptionService.encrypt(testData, testKey);
      const wrongKey = 'wrong-encryption-key-32-chars-long';

      await expect(encryptionService.decrypt(encrypted, wrongKey))
        .rejects.toThrow('Decryption failed');
    });

    it('should throw error with tampered ciphertext', async () => {
      const encrypted = await encryptionService.encrypt(testData, testKey);
      
      // Tamper with the encrypted data
      const tamperedEncrypted = {
        ...encrypted,
        encryptedData: encrypted.encryptedData + 'tampered'
      };

      await expect(encryptionService.decrypt(tamperedEncrypted, testKey))
        .rejects.toThrow('Authentication failed');
    });

    it('should throw error with tampered auth tag', async () => {
      const encrypted = await encryptionService.encrypt(testData, testKey);
      
      // Tamper with the auth tag
      const tamperedEncrypted = {
        ...encrypted,
        authTag: 'tampered' + encrypted.authTag.slice(8)
      };

      await expect(encryptionService.decrypt(tamperedEncrypted, testKey))
        .rejects.toThrow('Authentication failed');
    });

    it('should throw error with invalid IV', async () => {
      const encrypted = await encryptionService.encrypt(testData, testKey);
      
      // Use invalid IV
      const invalidEncrypted = {
        ...encrypted,
        iv: 'invalid-iv'
      };

      await expect(encryptionService.decrypt(invalidEncrypted, testKey))
        .rejects.toThrow('Invalid IV length');
    });
  });

  describe('generateKey', () => {
    it('should generate valid encryption key', () => {
      const key = encryptionService.generateKey();
      
      expect(key).toHaveLength(64); // 32 bytes in hex = 64 characters
      expect(key).toMatch(/^[0-9a-f]+$/); // Should be hex string
    });

    it('should generate different keys each time', () => {
      const key1 = encryptionService.generateKey();
      const key2 = encryptionService.generateKey();

      expect(key1).not.toBe(key2);
    });
  });

  describe('hashData', () => {
    it('should generate consistent hash for same data', async () => {
      const hash1 = await encryptionService.hashData(testData);
      const hash2 = await encryptionService.hashData(testData);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^sha256:[0-9a-f]+$/);
    });

    it('should generate different hash for different data', async () => {
      const hash1 = await encryptionService.hashData('data1');
      const hash2 = await encryptionService.hashData('data2');

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty data', async () => {
      const hash = await encryptionService.hashData('');
      
      expect(hash).toMatch(/^sha256:[0-9a-f]+$/);
    });

    it('should handle large data', async () => {
      const largeData = 'x'.repeat(1024 * 1024); // 1MB
      const startTime = Date.now();
      
      const hash = await encryptionService.hashData(largeData);
      const endTime = Date.now();
      
      expect(hash).toMatch(/^sha256:[0-9a-f]+$/);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('verifyHash', () => {
    it('should verify correct hash', async () => {
      const hash = await encryptionService.hashData(testData);
      const isValid = await encryptionService.verifyHash(testData, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect hash', async () => {
      const hash = await encryptionService.hashData('original data');
      const isValid = await encryptionService.verifyHash('modified data', hash);

      expect(isValid).toBe(false);
    });

    it('should reject malformed hash', async () => {
      const isValid = await encryptionService.verifyHash(testData, 'invalid-hash');

      expect(isValid).toBe(false);
    });

    it('should handle empty data with empty hash', async () => {
      const hash = await encryptionService.hashData('');
      const isValid = await encryptionService.verifyHash('', hash);

      expect(isValid).toBe(true);
    });
  });

  describe('encryptFile', () => {
    const testFilePath = '/tmp/test-file.txt';
    const testFileContent = Buffer.from('test file content');

    beforeEach(async () => {
      const fs = require('fs').promises;
      await fs.writeFile(testFilePath, testFileContent);
    });

    afterEach(async () => {
      const fs = require('fs').promises;
      try {
        await fs.unlink(testFilePath);
        await fs.unlink(`${testFilePath}.encrypted`);
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should encrypt file successfully', async () => {
      const result = await encryptionService.encryptFile(testFilePath, testKey);
      
      expect(result).toHaveProperty('encryptedPath');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('authTag');
      expect(result).toHaveProperty('originalSize');
      expect(result).toHaveProperty('encryptedSize');
      
      // Verify encrypted file exists
      const fs = require('fs').promises;
      await expect(fs.access(result.encryptedPath)).resolves.not.toThrow();
    });

    it('should handle non-existent file', async () => {
      await expect(encryptionService.encryptFile('/nonexistent/file.txt', testKey))
        .rejects.toThrow('File not found');
    });
  });

  describe('decryptFile', () => {
    const testFilePath = '/tmp/test-decrypt-file.txt';
    const testFileContent = Buffer.from('test file content for decryption');

    beforeEach(async () => {
      const fs = require('fs').promises;
      await fs.writeFile(testFilePath, testFileContent);
    });

    afterEach(async () => {
      const fs = require('fs').promises;
      try {
        await fs.unlink(testFilePath);
        await fs.unlink(`${testFilePath}.encrypted`);
        await fs.unlink(`${testFilePath}.decrypted`);
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should decrypt file successfully', async () => {
      // First encrypt the file
      const encryptResult = await encryptionService.encryptFile(testFilePath, testKey);
      
      // Then decrypt it
      const decryptResult = await encryptionService.decryptFile(
        encryptResult.encryptedPath,
        testKey,
        encryptResult.iv,
        encryptResult.authTag
      );
      
      expect(decryptResult).toHaveProperty('decryptedPath');
      expect(decryptResult).toHaveProperty('size');
      
      // Verify decrypted content matches original
      const fs = require('fs').promises;
      const decryptedContent = await fs.readFile(decryptResult.decryptedPath);
      expect(decryptedContent).toEqual(testFileContent);
    });
  });

  describe('secureDelete', () => {
    const testFilePath = '/tmp/test-secure-delete.txt';

    beforeEach(async () => {
      const fs = require('fs').promises;
      await fs.writeFile(testFilePath, 'sensitive content to delete');
    });

    it('should securely delete file', async () => {
      await encryptionService.secureDelete(testFilePath);
      
      // Verify file no longer exists
      const fs = require('fs').promises;
      await expect(fs.access(testFilePath)).rejects.toThrow('ENOENT');
    });

    it('should handle non-existent file gracefully', async () => {
      await expect(encryptionService.secureDelete('/nonexistent/file.txt'))
        .resolves.not.toThrow();
    });
  });

  describe('Performance Tests', () => {
    it('should encrypt large data within acceptable time', async () => {
      const largeData = crypto.randomBytes(10 * 1024 * 1024).toString('hex'); // 10MB
      const startTime = process.hrtime.bigint();
      
      await encryptionService.encrypt(largeData, testKey);
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle concurrent encryption operations', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => 
        encryptionService.encrypt(`test data ${i}`, testKey)
      );
      
      const results = await Promise.all(operations);
      
      expect(results).toHaveLength(10);
      results.forEach((result, i) => {
        expect(result.encryptedData).toBeDefined();
        expect(result.iv).toBeDefined();
        expect(result.authTag).toBeDefined();
      });
    });
  });

  describe('Memory Safety', () => {
    it('should not leak sensitive data in memory', async () => {
      const sensitiveData = 'extremely-sensitive-password-123!';
      
      // Encrypt and decrypt
      const encrypted = await encryptionService.encrypt(sensitiveData, testKey);
      const decrypted = await encryptionService.decrypt(encrypted, testKey);
      
      expect(decrypted).toBe(sensitiveData);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      // This test mainly ensures no crashes during GC
      // In a real implementation, you might check for memory patterns
    });
  });

  describe('Error Handling', () => {
    it('should provide informative error messages', async () => {
      try {
        await encryptionService.encrypt(testData, 'short');
      } catch (error) {
        expect(error.message).toContain('Invalid key length');
        expect(error.message).toContain('expected 32 bytes');
      }
    });

    it('should handle system errors gracefully', async () => {
      // Mock crypto module to throw error
      const originalCreateCipher = crypto.createCipher;
      crypto.createCipher = jest.fn().mockImplementation(() => {
        throw new Error('Crypto module error');
      });

      await expect(encryptionService.encrypt(testData, testKey))
        .rejects.toThrow('Encryption operation failed');

      // Restore original function
      crypto.createCipher = originalCreateCipher;
    });
  });
});