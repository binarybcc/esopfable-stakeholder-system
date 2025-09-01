import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import NodeClam from 'clamscan';
import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import { Document, ProcessingJob, ProcessingStage, DLPResult, DLPFinding } from '../types';
import { EncryptionService } from './EncryptionService';

const execAsync = promisify(exec);

export interface ProcessingConfig {
  virusScanEnabled: boolean;
  ocrEnabled: boolean;
  previewEnabled: boolean;
  dlpEnabled: boolean;
  watermarkEnabled: boolean;
  maxFileSize: number;
  allowedMimeTypes: string[];
  quarantinePath: string;
  previewPath: string;
  thumbnailPath: string;
  tempPath: string;
}

export interface VirusScanResult {
  isInfected: boolean;
  virus?: string;
  scanTime: number;
}

export interface OCRResult {
  text: string;
  confidence: number;
  language: string;
  pages: OCRPage[];
}

export interface OCRPage {
  pageNumber: number;
  text: string;
  confidence: number;
  words: OCRWord[];
}

export interface OCRWord {
  text: string;
  confidence: number;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

export interface PreviewResult {
  previewPath: string;
  thumbnailPath: string;
  pages: number;
  dimensions?: {
    width: number;
    height: number;
  };
}

export class FileProcessingService {
  private config: ProcessingConfig;
  private encryptionService: EncryptionService;
  private clamScan: any;

  constructor(
    config: Partial<ProcessingConfig> = {},
    encryptionService: EncryptionService
  ) {
    this.config = {
      virusScanEnabled: true,
      ocrEnabled: true,
      previewEnabled: true,
      dlpEnabled: true,
      watermarkEnabled: false,
      maxFileSize: 500 * 1024 * 1024, // 500MB
      allowedMimeTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/csv',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/bmp',
        'image/tiff',
        'image/webp'
      ],
      quarantinePath: './storage/quarantine',
      previewPath: './storage/previews',
      thumbnailPath: './storage/thumbnails',
      tempPath: './storage/temp',
      ...config
    };

    this.encryptionService = encryptionService;
  }

  async initialize(): Promise<void> {
    // Initialize ClamAV scanner
    if (this.config.virusScanEnabled) {
      this.clamScan = await new NodeClam().init({
        removeInfected: false,
        quarantineInfected: this.config.quarantinePath,
        scanLog: './logs/clamscan.log',
        debugMode: process.env.NODE_ENV === 'development',
        clamscan: {
          path: '/usr/bin/clamscan',
          scanArchives: true,
          active: true
        },
        clamdscan: {
          path: '/usr/bin/clamdscan',
          config: '/etc/clamav/clamd.conf',
          multiscan: true,
          reloadDb: false,
          active: true,
          bypassTest: false
        }
      });
    }

    // Ensure directories exist
    await this.ensureDirectories();
  }

  private async ensureDirectories(): Promise<void> {
    const dirs = [
      this.config.quarantinePath,
      this.config.previewPath,
      this.config.thumbnailPath,
      this.config.tempPath
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async processFile(
    filePath: string,
    document: Partial<Document>,
    jobId: string
  ): Promise<ProcessingJob> {
    const job: ProcessingJob = {
      id: jobId,
      documentId: document.id!,
      stage: ProcessingStage.UPLOAD,
      status: 'IN_PROGRESS',
      progress: 0,
      startedAt: new Date(),
      retryCount: 0,
      maxRetries: 3,
      metadata: {}
    };

    try {
      // Stage 1: File validation
      job.stage = ProcessingStage.UPLOAD;
      await this.validateFile(filePath, document);
      job.progress = 10;

      // Stage 2: Virus scanning
      if (this.config.virusScanEnabled) {
        job.stage = ProcessingStage.VIRUS_SCAN;
        const virusScanResult = await this.scanForViruses(filePath);
        job.metadata.virusScan = virusScanResult;
        
        if (virusScanResult.isInfected) {
          await this.quarantineFile(filePath, document.id!, virusScanResult.virus!);
          throw new Error(`File infected with virus: ${virusScanResult.virus}`);
        }
        job.progress = 30;
      }

      // Stage 3: DLP and classification
      if (this.config.dlpEnabled) {
        job.stage = ProcessingStage.CLASSIFICATION;
        const dlpResult = await this.performDLPScan(filePath, document);
        job.metadata.dlp = dlpResult;
        
        // Auto-classify based on DLP findings
        if (dlpResult.autoClassified) {
          document.classification = dlpResult.recommendedClassification;
        }
        job.progress = 50;
      }

      // Stage 4: Encryption
      job.stage = ProcessingStage.ENCRYPTION;
      const encryptionResult = await this.encryptionService.encryptFile(
        filePath,
        `${document.storagePath}.encrypted`
      );
      job.metadata.encryption = {
        key: encryptionResult.key,
        iv: encryptionResult.iv,
        tag: encryptionResult.tag
      };
      job.progress = 60;

      // Stage 5: OCR (if applicable)
      if (this.config.ocrEnabled && this.isOCRApplicable(document.mimeType!)) {
        job.stage = ProcessingStage.OCR;
        const ocrResult = await this.performOCR(filePath, document);
        job.metadata.ocr = ocrResult;
        job.progress = 75;
      }

      // Stage 6: Preview generation
      if (this.config.previewEnabled && this.isPreviewSupported(document.mimeType!)) {
        job.stage = ProcessingStage.PREVIEW;
        const previewResult = await this.generatePreview(filePath, document);
        job.metadata.preview = previewResult;
        job.progress = 90;
      }

      // Stage 7: Search indexing
      job.stage = ProcessingStage.INDEXING;
      await this.indexForSearch(document, job.metadata);
      job.progress = 100;

      // Complete processing
      job.stage = ProcessingStage.COMPLETE;
      job.status = 'COMPLETED';
      job.completedAt = new Date();

      // Clean up temp file
      await fs.unlink(filePath);

    } catch (error) {
      job.status = 'FAILED';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.completedAt = new Date();
      
      // Log error and potentially retry
      console.error(`File processing failed for ${document.id}:`, error);
      
      if (job.retryCount < job.maxRetries) {
        job.retryCount++;
        job.status = 'PENDING';
        // Schedule retry (implementation depends on job queue system)
      }
    }

    return job;
  }

  private async validateFile(filePath: string, document: Partial<Document>): Promise<void> {
    const stats = await fs.stat(filePath);
    
    // Check file size
    if (stats.size > this.config.maxFileSize) {
      throw new Error(`File too large: ${stats.size} bytes (max: ${this.config.maxFileSize})`);
    }

    // Check MIME type
    if (!this.config.allowedMimeTypes.includes(document.mimeType!)) {
      throw new Error(`MIME type not allowed: ${document.mimeType}`);
    }

    // Verify file integrity
    const calculatedChecksum = await this.encryptionService.calculateChecksums(filePath);
    if (document.checksumSHA256 && document.checksumSHA256 !== calculatedChecksum.sha256) {
      throw new Error('File integrity check failed: checksum mismatch');
    }
  }

  private async scanForViruses(filePath: string): Promise<VirusScanResult> {
    const startTime = Date.now();
    
    try {
      const result = await this.clamScan.scanFile(filePath);
      
      return {
        isInfected: result.isInfected,
        virus: result.viruses?.[0],
        scanTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Virus scan failed:', error);
      throw new Error('Virus scan failed');
    }
  }

  private async quarantineFile(filePath: string, documentId: string, virus: string): Promise<void> {
    const quarantinePath = path.join(
      this.config.quarantinePath,
      `${documentId}_${Date.now()}.quarantine`
    );
    
    await fs.rename(filePath, quarantinePath);
    
    // Log quarantine action
    const logEntry = {
      timestamp: new Date().toISOString(),
      documentId,
      originalPath: filePath,
      quarantinePath,
      virus,
      action: 'QUARANTINED'
    };
    
    await fs.appendFile(
      path.join(this.config.quarantinePath, 'quarantine.log'),
      JSON.stringify(logEntry) + '\n'
    );
  }

  private async performDLPScan(filePath: string, document: Partial<Document>): Promise<DLPResult> {
    // Basic DLP patterns - in production, use specialized DLP tools
    const patterns = {
      ssn: /\b\d{3}-?\d{2}-?\d{4}\b/g,
      creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
      ip: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g
    };

    const findings: DLPFinding[] = [];
    let content = '';

    try {
      // Extract text content based on file type
      if (document.mimeType?.includes('text/')) {
        content = await fs.readFile(filePath, 'utf8');
      } else if (document.mimeType?.includes('pdf')) {
        content = await this.extractTextFromPDF(filePath);
      } else {
        // For other types, try OCR if available
        const ocrResult = await this.performOCR(filePath, document);
        content = ocrResult.text;
      }

      // Scan for sensitive patterns
      for (const [type, pattern] of Object.entries(patterns)) {
        const matches = content.match(pattern);
        if (matches) {
          matches.forEach(match => {
            findings.push({
              type,
              description: `Found ${type.toUpperCase()}`,
              confidence: 0.8,
              location: { line: 1 }, // Simplified location
              text: match,
              severity: this.getSeverityForType(type)
            });
          });
        }
      }

    } catch (error) {
      console.error('DLP scan failed:', error);
    }

    // Determine risk level and recommended classification
    const riskLevel = this.calculateRiskLevel(findings);
    const recommendedClassification = this.getRecommendedClassification(riskLevel, findings);

    return {
      documentId: document.id!,
      scanDate: new Date(),
      riskLevel,
      findings,
      recommendedClassification,
      autoClassified: findings.length > 0
    };
  }

  private getSeverityForType(type: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const severityMap: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
      email: 'LOW',
      phone: 'LOW',
      ip: 'MEDIUM',
      creditCard: 'HIGH',
      ssn: 'CRITICAL'
    };
    
    return severityMap[type] || 'MEDIUM';
  }

  private calculateRiskLevel(findings: DLPFinding[]): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (findings.some(f => f.severity === 'CRITICAL')) return 'CRITICAL';
    if (findings.some(f => f.severity === 'HIGH')) return 'HIGH';
    if (findings.some(f => f.severity === 'MEDIUM')) return 'MEDIUM';
    if (findings.length > 0) return 'LOW';
    return 'LOW';
  }

  private getRecommendedClassification(riskLevel: string, findings: DLPFinding[]) {
    switch (riskLevel) {
      case 'CRITICAL': return 'SECRET';
      case 'HIGH': return 'CONFIDENTIAL';
      case 'MEDIUM': return 'INTERNAL';
      default: return 'PUBLIC';
    }
  }

  private async performOCR(filePath: string, document: Partial<Document>): Promise<OCRResult> {
    if (!this.isOCRApplicable(document.mimeType!)) {
      throw new Error('OCR not applicable for this file type');
    }

    try {
      let imagePath = filePath;
      
      // Convert PDF to images if needed
      if (document.mimeType === 'application/pdf') {
        imagePath = await this.convertPDFToImage(filePath);
      }

      const { data } = await Tesseract.recognize(imagePath, 'eng', {
        logger: m => console.log(m)
      });

      const result: OCRResult = {
        text: data.text,
        confidence: data.confidence,
        language: 'eng',
        pages: [{
          pageNumber: 1,
          text: data.text,
          confidence: data.confidence,
          words: data.words.map(word => ({
            text: word.text,
            confidence: word.confidence,
            bbox: word.bbox
          }))
        }]
      };

      // Clean up temporary image if created
      if (imagePath !== filePath) {
        await fs.unlink(imagePath);
      }

      return result;
    } catch (error) {
      console.error('OCR failed:', error);
      throw new Error('OCR processing failed');
    }
  }

  private async generatePreview(filePath: string, document: Partial<Document>): Promise<PreviewResult> {
    const previewDir = path.join(this.config.previewPath, document.id!);
    await fs.mkdir(previewDir, { recursive: true });

    const previewPath = path.join(previewDir, 'preview.pdf');
    const thumbnailPath = path.join(previewDir, 'thumbnail.jpg');

    try {
      if (document.mimeType?.includes('image/')) {
        // For images, create thumbnail and use original as preview
        await sharp(filePath)
          .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toFile(thumbnailPath);

        await fs.copyFile(filePath, previewPath);

        const metadata = await sharp(filePath).metadata();
        return {
          previewPath,
          thumbnailPath,
          pages: 1,
          dimensions: {
            width: metadata.width || 0,
            height: metadata.height || 0
          }
        };
      } else if (document.mimeType === 'application/pdf') {
        // Generate PDF preview and thumbnail
        return await this.generatePDFPreview(filePath, previewPath, thumbnailPath);
      } else {
        // For office documents, convert to PDF first
        const convertedPDF = await this.convertToPDF(filePath, document.mimeType!);
        const result = await this.generatePDFPreview(convertedPDF, previewPath, thumbnailPath);
        await fs.unlink(convertedPDF);
        return result;
      }
    } catch (error) {
      console.error('Preview generation failed:', error);
      throw new Error('Preview generation failed');
    }
  }

  private async generatePDFPreview(inputPath: string, previewPath: string, thumbnailPath: string): Promise<PreviewResult> {
    // Copy PDF for preview
    await fs.copyFile(inputPath, previewPath);

    // Generate thumbnail from first page
    const tempImagePath = `${thumbnailPath}.temp.png`;
    
    await execAsync(`pdftoppm -png -f 1 -l 1 "${inputPath}" "${tempImagePath.replace('.temp.png', '')}"`);
    
    // Convert to JPEG thumbnail
    await sharp(`${tempImagePath.replace('.temp.png', '')}-1.png`)
      .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath);

    // Clean up temp files
    await fs.unlink(`${tempImagePath.replace('.temp.png', '')}-1.png`);

    // Get page count
    const { stdout } = await execAsync(`pdfinfo "${inputPath}" | grep Pages`);
    const pages = parseInt(stdout.match(/Pages:\s+(\d+)/)?.[1] || '1');

    return {
      previewPath,
      thumbnailPath,
      pages
    };
  }

  private async convertToPDF(filePath: string, mimeType: string): Promise<string> {
    const outputPath = `${filePath}.pdf`;
    
    try {
      if (mimeType.includes('word') || mimeType.includes('document')) {
        await execAsync(`libreoffice --headless --convert-to pdf --outdir "${path.dirname(outputPath)}" "${filePath}"`);
      } else if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
        await execAsync(`libreoffice --headless --convert-to pdf --outdir "${path.dirname(outputPath)}" "${filePath}"`);
      } else if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) {
        await execAsync(`libreoffice --headless --convert-to pdf --outdir "${path.dirname(outputPath)}" "${filePath}"`);
      } else {
        throw new Error(`Unsupported MIME type for PDF conversion: ${mimeType}`);
      }
      
      return outputPath;
    } catch (error) {
      console.error('PDF conversion failed:', error);
      throw new Error('PDF conversion failed');
    }
  }

  private async convertPDFToImage(pdfPath: string): Promise<string> {
    const imagePath = `${pdfPath}.png`;
    await execAsync(`pdftoppm -png -f 1 -l 1 "${pdfPath}" "${imagePath.replace('.png', '')}"`);
    return `${imagePath.replace('.png', '')}-1.png`;
  }

  private async extractTextFromPDF(pdfPath: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`pdftotext "${pdfPath}" -`);
      return stdout;
    } catch (error) {
      console.error('PDF text extraction failed:', error);
      return '';
    }
  }

  private isOCRApplicable(mimeType: string): boolean {
    return mimeType.includes('image/') || mimeType === 'application/pdf';
  }

  private isPreviewSupported(mimeType: string): boolean {
    return this.config.allowedMimeTypes.includes(mimeType);
  }

  private async indexForSearch(document: Partial<Document>, metadata: any): Promise<void> {
    // This would integrate with Elasticsearch or similar search engine
    // For now, just log that indexing would happen
    console.log(`Indexing document ${document.id} for search with metadata:`, {
      text: metadata.ocr?.text?.substring(0, 1000),
      classification: document.classification,
      tags: document.tags
    });
  }

  /**
   * Apply watermark to document
   */
  async applyWatermark(filePath: string, watermarkText: string, outputPath: string): Promise<void> {
    if (path.extname(filePath).toLowerCase() === '.pdf') {
      await this.applyPDFWatermark(filePath, watermarkText, outputPath);
    } else {
      await this.applyImageWatermark(filePath, watermarkText, outputPath);
    }
  }

  private async applyPDFWatermark(inputPath: string, watermarkText: string, outputPath: string): Promise<void> {
    // Using pdftk or similar tool to add watermark
    const watermarkPDF = await this.createWatermarkPDF(watermarkText);
    await execAsync(`pdftk "${inputPath}" multistamp "${watermarkPDF}" output "${outputPath}"`);
    await fs.unlink(watermarkPDF);
  }

  private async applyImageWatermark(inputPath: string, watermarkText: string, outputPath: string): Promise<void> {
    await sharp(inputPath)
      .composite([{
        input: Buffer.from(`
          <svg width="300" height="50">
            <text x="50%" y="50%" font-family="Arial" font-size="16" fill="rgba(255,255,255,0.7)" 
                  text-anchor="middle" alignment-baseline="central">${watermarkText}</text>
          </svg>
        `),
        gravity: 'center'
      }])
      .toFile(outputPath);
  }

  private async createWatermarkPDF(text: string): Promise<string> {
    const watermarkPath = path.join(this.config.tempPath, `watermark_${Date.now()}.pdf`);
    
    // Create a simple PDF with watermark text
    // This is a simplified version - in production, use a proper PDF library
    const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj

4 0 obj
<<
/Length 100
>>
stream
BT
/F1 24 Tf
306 396 Td
(${text}) Tj
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000269 00000 n 
0000000420 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
518
%%EOF`;

    await fs.writeFile(watermarkPath, pdfContent);
    return watermarkPath;
  }

  /**
   * Clean up expired temp files and quarantined files
   */
  async cleanup(): Promise<void> {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();

    // Clean temp directory
    const tempFiles = await fs.readdir(this.config.tempPath);
    for (const file of tempFiles) {
      const filePath = path.join(this.config.tempPath, file);
      const stats = await fs.stat(filePath);
      
      if (now - stats.mtime.getTime() > maxAge) {
        await fs.unlink(filePath);
      }
    }

    // Clean old quarantined files (after 30 days)
    const quarantineMaxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    const quarantineFiles = await fs.readdir(this.config.quarantinePath);
    
    for (const file of quarantineFiles) {
      if (file === 'quarantine.log') continue;
      
      const filePath = path.join(this.config.quarantinePath, file);
      const stats = await fs.stat(filePath);
      
      if (now - stats.mtime.getTime() > quarantineMaxAge) {
        await this.encryptionService.secureDelete(filePath);
      }
    }
  }
}