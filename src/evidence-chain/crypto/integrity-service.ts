import crypto from 'crypto';
import { DigitalFingerprint, IntegrityProof, DigitalSignature, BlockchainProof, TimestampAuthority, TamperCheck, TamperIndicator, VerificationRecord } from '../types';

export class IntegrityService {
  private readonly hashAlgorithms = ['sha256', 'sha1', 'md5', 'sha512'];
  private readonly signatureAlgorithm = 'RSA-SHA256';
  
  /**
   * Generate comprehensive digital fingerprint for evidence
   */
  async generateDigitalFingerprint(
    data: Buffer | string,
    metadata?: Record<string, any>
  ): Promise<DigitalFingerprint> {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    
    // Generate multiple hashes for redundancy
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const sha1 = crypto.createHash('sha1').update(buffer).digest('hex');
    const md5 = crypto.createHash('md5').update(buffer).digest('hex');
    const crc32 = this.calculateCRC32(buffer);
    
    // Custom hash combining all algorithms
    const customHash = crypto
      .createHash('sha256')
      .update(sha256 + sha1 + md5 + crc32.toString(16))
      .digest('hex');
    
    // Metadata fingerprint
    const metadataString = JSON.stringify(metadata || {});
    const metadataHash = crypto
      .createHash('sha256')
      .update(metadataString)
      .digest('hex');
    
    return {
      sha256,
      sha1,
      md5,
      crc32: crc32.toString(16),
      customHash,
      metadataHash,
      createdAt: new Date(),
      algorithm: 'SHA256+SHA1+MD5+CRC32+CUSTOM'
    };
  }
  
  /**
   * Create cryptographic integrity proof
   */
  async createIntegrityProof(
    evidenceId: string,
    data: Buffer,
    privateKey: string,
    signedBy: string
  ): Promise<IntegrityProof> {
    const fingerprint = await this.generateDigitalFingerprint(data);
    
    // Create digital signature
    const signature = await this.createDigitalSignature(
      fingerprint.sha256,
      privateKey,
      signedBy,
      'INTEGRITY_VERIFICATION'
    );
    
    // Get timestamp from authority
    const timestampAuthority = await this.getTimestampAuthority(fingerprint.sha256);
    
    // Create Merkle root for blockchain-style verification
    const merkleRoot = this.calculateMerkleRoot([
      fingerprint.sha256,
      fingerprint.sha1,
      fingerprint.md5,
      fingerprint.metadataHash
    ]);
    
    return {
      id: crypto.randomUUID(),
      evidenceId,
      proofType: 'CRYPTOGRAPHIC',
      digitalSignature: signature,
      timestampAuthority,
      merkleRoot,
      verificationHistory: [],
      lastVerified: new Date(),
      verificationStatus: 'VALID',
      createdAt: new Date()
    };
  }
  
  /**
   * Create digital signature
   */
  async createDigitalSignature(
    data: string,
    privateKey: string,
    signedBy: string,
    purpose: 'CUSTODY_TRANSFER' | 'INTEGRITY_VERIFICATION' | 'AUTHENTICATION' | 'NON_REPUDIATION' | 'APPROVAL'
  ): Promise<DigitalSignature> {
    const sign = crypto.createSign(this.signatureAlgorithm);
    sign.update(data);
    const signature = sign.sign(privateKey, 'hex');
    
    // Extract public key from private key for verification
    const keyObject = crypto.createPrivateKey(privateKey);
    const publicKey = crypto.createPublicKey(keyObject).export({
      type: 'spki',
      format: 'pem'
    }) as string;
    
    return {
      signature,
      algorithm: this.signatureAlgorithm,
      publicKey,
      signedBy,
      signedAt: new Date(),
      purpose,
      certificateChain: [] // Would be populated with actual certificates
    };
  }
  
  /**
   * Verify digital signature
   */
  async verifyDigitalSignature(
    data: string,
    signature: DigitalSignature
  ): Promise<boolean> {
    try {
      const verify = crypto.createVerify(signature.algorithm);
      verify.update(data);
      return verify.verify(signature.publicKey, signature.signature, 'hex');
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }
  
  /**
   * Verify integrity of evidence
   */
  async verifyIntegrity(
    evidenceId: string,
    currentData: Buffer,
    originalProof: IntegrityProof,
    verifiedBy: string
  ): Promise<VerificationRecord> {
    const currentFingerprint = await this.generateDigitalFingerprint(currentData);
    
    // Compare hashes
    const hashMatch = currentFingerprint.sha256 === originalProof.digitalSignature.signature;
    
    // Verify digital signature
    const signatureValid = await this.verifyDigitalSignature(
      currentFingerprint.sha256,
      originalProof.digitalSignature
    );
    
    // Check timestamp authority
    const timestampValid = await this.verifyTimestamp(originalProof.timestampAuthority);
    
    // Calculate confidence score
    let confidence = 0;
    if (hashMatch) confidence += 40;
    if (signatureValid) confidence += 30;
    if (timestampValid) confidence += 20;
    if (originalProof.merkleRoot) confidence += 10;
    
    const result = confidence >= 80 ? 'VERIFIED' : 
                  confidence >= 60 ? 'INCONCLUSIVE' : 'FAILED';
    
    return {
      id: crypto.randomUUID(),
      verifiedBy,
      verifiedAt: new Date(),
      verificationMethod: 'CRYPTOGRAPHIC_HASH_SIGNATURE_TIMESTAMP',
      result,
      confidence,
      notes: this.generateVerificationNotes(hashMatch, signatureValid, timestampValid),
      tools: ['SHA256', 'RSA-SHA256', 'TIMESTAMP_AUTHORITY']
    };
  }
  
  /**
   * Perform comprehensive tamper check
   */
  async performTamperCheck(
    evidenceId: string,
    currentData: Buffer,
    originalProof: IntegrityProof,
    checkedBy: string,
    checkType: 'ROUTINE' | 'TRIGGERED' | 'COURT_ORDERED' | 'INTEGRITY_VERIFICATION' | 'INCIDENT_RESPONSE'
  ): Promise<TamperCheck> {
    const indicators: TamperIndicator[] = [];
    const currentFingerprint = await this.generateDigitalFingerprint(currentData);
    
    // Hash comparison
    if (currentFingerprint.sha256 !== originalProof.digitalSignature.signature) {
      indicators.push({
        type: 'HASH_MISMATCH',
        severity: 'CRITICAL',
        description: 'SHA256 hash does not match original',
        evidence: `Original: ${originalProof.digitalSignature.signature}, Current: ${currentFingerprint.sha256}`,
        confidence: 95
      });
    }
    
    // Timestamp analysis
    const timestampDiff = Date.now() - originalProof.timestampAuthority.timestamp.getTime();
    if (timestampDiff < 0) {
      indicators.push({
        type: 'TIMESTAMP_ANOMALY',
        severity: 'HIGH',
        description: 'Timestamp is in the future',
        evidence: `Timestamp: ${originalProof.timestampAuthority.timestamp.toISOString()}`,
        confidence: 90
      });
    }
    
    // Signature verification
    const signatureValid = await this.verifyDigitalSignature(
      currentFingerprint.sha256,
      originalProof.digitalSignature
    );
    
    if (!signatureValid) {
      indicators.push({
        type: 'SIGNATURE_INVALID',
        severity: 'CRITICAL',
        description: 'Digital signature verification failed',
        evidence: 'Signature does not match public key',
        confidence: 98
      });
    }
    
    // Calculate integrity score
    const maxScore = 100;
    let deductions = 0;
    
    indicators.forEach(indicator => {
      switch (indicator.severity) {
        case 'CRITICAL': deductions += 40; break;
        case 'HIGH': deductions += 25; break;
        case 'MEDIUM': deductions += 15; break;
        case 'LOW': deductions += 5; break;
      }
    });
    
    const integrityScore = Math.max(0, maxScore - deductions);
    const tamperDetected = indicators.length > 0;
    
    return {
      id: crypto.randomUUID(),
      evidenceId,
      checkType,
      checkedBy,
      checkedAt: new Date(),
      tamperDetected,
      tamperIndicators: indicators,
      integrityScore,
      checkMethod: 'CRYPTOGRAPHIC_ANALYSIS',
      tools: ['SHA256', 'Digital_Signature', 'Timestamp_Verification'],
      notes: `Integrity check completed. Score: ${integrityScore}/100. ${tamperDetected ? 'Potential tampering detected.' : 'No tampering detected.'}`,
      actionTaken: tamperDetected ? 'FLAGGED_FOR_INVESTIGATION' : 'NONE',
      reportGenerated: tamperDetected,
      investigationId: tamperDetected ? crypto.randomUUID() : undefined
    };
  }
  
  /**
   * Create blockchain-style proof
   */
  async createBlockchainProof(
    data: string,
    networkId: string = 'evidence-chain'
  ): Promise<BlockchainProof> {
    // Simulate blockchain integration
    const blockHash = crypto.createHash('sha256')
      .update(data + Date.now().toString())
      .digest('hex');
    
    const transactionHash = crypto.createHash('sha256')
      .update(blockHash + data)
      .digest('hex');
    
    // Generate Merkle proof
    const merkleProof = this.generateMerkleProof(data, [blockHash, transactionHash]);
    
    return {
      blockHash,
      transactionHash,
      blockNumber: Math.floor(Date.now() / 1000), // Simplified block number
      networkId,
      confirmations: 6, // Simulated confirmations
      timestamp: new Date(),
      merkleProof
    };
  }
  
  /**
   * Calculate CRC32 checksum
   */
  private calculateCRC32(buffer: Buffer): number {
    let crc = 0xFFFFFFFF;
    const table: number[] = [];
    
    // Generate CRC32 table
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    
    // Calculate CRC32
    for (let i = 0; i < buffer.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buffer[i]) & 0xFF];
    }
    
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  
  /**
   * Calculate Merkle root
   */
  private calculateMerkleRoot(hashes: string[]): string {
    if (hashes.length === 0) return '';
    if (hashes.length === 1) return hashes[0];
    
    const nextLevel: string[] = [];
    
    for (let i = 0; i < hashes.length; i += 2) {
      const left = hashes[i];
      const right = i + 1 < hashes.length ? hashes[i + 1] : left;
      
      const combined = crypto.createHash('sha256')
        .update(left + right)
        .digest('hex');
      
      nextLevel.push(combined);
    }
    
    return this.calculateMerkleRoot(nextLevel);
  }
  
  /**
   * Generate Merkle proof
   */
  private generateMerkleProof(data: string, siblings: string[]): string[] {
    const proof: string[] = [];
    
    siblings.forEach(sibling => {
      const combined = crypto.createHash('sha256')
        .update(data + sibling)
        .digest('hex');
      proof.push(combined);
    });
    
    return proof;
  }
  
  /**
   * Get timestamp from authority (simulated)
   */
  private async getTimestampAuthority(data: string): Promise<TimestampAuthority> {
    // In production, this would connect to a real timestamp authority
    const token = crypto.createHash('sha256')
      .update(data + Date.now().toString())
      .digest('hex');
    
    const certificate = 'MOCK_CERTIFICATE_' + crypto.randomUUID();
    
    return {
      authority: 'RFC3161_TIMESTAMP_AUTHORITY',
      timestamp: new Date(),
      token,
      certificate,
      verified: true
    };
  }
  
  /**
   * Verify timestamp authority
   */
  private async verifyTimestamp(authority: TimestampAuthority): Promise<boolean> {
    // In production, this would verify against the actual timestamp authority
    const now = Date.now();
    const timestampTime = authority.timestamp.getTime();
    
    // Check if timestamp is reasonable (not too far in past/future)
    const maxAge = 365 * 24 * 60 * 60 * 1000; // 1 year
    const maxFuture = 5 * 60 * 1000; // 5 minutes
    
    return (
      authority.verified &&
      timestampTime <= (now + maxFuture) &&
      timestampTime >= (now - maxAge)
    );
  }
  
  /**
   * Generate verification notes
   */
  private generateVerificationNotes(
    hashMatch: boolean,
    signatureValid: boolean,
    timestampValid: boolean
  ): string {
    const notes = [];
    
    if (hashMatch) {
      notes.push('✓ Hash verification passed');
    } else {
      notes.push('✗ Hash verification failed');
    }
    
    if (signatureValid) {
      notes.push('✓ Digital signature valid');
    } else {
      notes.push('✗ Digital signature invalid');
    }
    
    if (timestampValid) {
      notes.push('✓ Timestamp verified');
    } else {
      notes.push('✗ Timestamp verification failed');
    }
    
    return notes.join('; ');
  }
  
  /**
   * Generate secure random ID
   */
  generateSecureId(): string {
    return crypto.randomUUID();
  }
  
  /**
   * Encrypt sensitive data
   */
  async encryptData(data: string, key: string): Promise<string> {
    const cipher = crypto.createCipher('aes-256-cbc', key);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }
  
  /**
   * Decrypt sensitive data
   */
  async decryptData(encryptedData: string, key: string): Promise<string> {
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}